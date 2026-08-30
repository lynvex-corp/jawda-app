# Jáwda — Guia de Arquitetura

> **Este documento é a lei do projeto.** Toda aba do Claude Code deve lê-lo antes de escrever qualquer linha. Nenhuma decisão de arquitetura pode contrariar o que está aqui sem alterar o próprio documento primeiro.
>
> **Versão:** 1.0 · **Data:** nov/2026 · **Autor:** Matheus Marinho (Lynvex) · **Consultor de arquitetura:** Claude

---

## 1. O que é o Jáwda

Plataforma SaaS multi-tenant de gestão da qualidade e conformidade, começando por ISO 9001, com escala planejada para 500 a 1.000 empresas.

São dois sistemas separados sobre o mesmo banco:

- **Painel do Cliente** (`app.jawda.com.br`) — onde cada empresa opera o próprio sistema de gestão.
- **Painel Administrativo** (`admin.jawda.com.br`) — onde a Lynvex provisiona empresas, cobra e acompanha.

## 2. Princípios inegociáveis

Toda decisão de código deve respeitar estes princípios. Quando houver conflito, o princípio prevalece.

**Um código, um banco, um deploy.** Nunca uma instalação por empresa. Isolamento entre empresas é garantido **dentro do banco**, por Row Level Security do Supabase, nunca por filtro no código da tela.

**Empresa nunca vê dado de outra.** Nem por bug, nem por erro de consulta, nem por engenhosidade de usuário. É a fronteira mais importante do sistema, e é o motivo de ele existir sobre o Supabase.

**Nada é apagado.** Registros excluídos vão para o histórico com quem apagou, quando e por quê. Motivo obrigatório. Só perfil alto exclui.

**A IA propõe, o humano decide.** Registros críticos preenchidos por IA (NC e auditoria) nascem em estado "aguardando aprovação" e só um perfil superior os torna oficiais. Toda ação da IA fica marcada na trilha.

**O contrato manda no acesso.** O contrato do cliente diz quais módulos ele vê e quais permanecem bloqueados. Financeiro empurra a empresa por uma escada de inadimplência: aviso — somente leitura — bloqueio, com cliente sempre podendo exportar dados.

**Trilha de auditoria em tudo que importa.** Toda ação que cria, altera ou encerra registro (NC, plano, auditoria, medição de indicador) fica registrada com autor, timestamp e detalhe.

## 3. Stack

Escolhida após análise do código-fonte do protótipo. **Não migrar para outra stack sem revisar este documento primeiro.**

**Frontend:** TanStack Start · React 19 · TypeScript · Tailwind CSS v4 (tokens em oklch) · shadcn/ui · Recharts · Zod · react-hook-form · Sonner (toasts) · Lucide (ícones)

**Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions) · Row Level Security como trava de multi-tenant

**Deploy:** Vercel, com todas as funções fixadas explicitamente na região São Paulo/Brasil (`gru1`, disponível no plano Pro) — não deixar no automático. O banco (Supabase) já está na mesma região, então aplicação e dado ficam fisicamente no Brasil. Migração para VPS Hostinger com EasyPanel segue no radar como evolução futura: custo mais previsível em escala (500-1.000 empresas), e necessária se algum contrato de cliente grande exigir literalmente "provedor de hospedagem brasileiro" e não apenas "processamento em território brasileiro" — a Vercel é empresa americana, então a região `gru1` resolve residência de dado mas pode não satisfazer essa exigência contratual mais rígida. Enquanto isso não acontecer, Vercel com região fixada é a decisão vigente para operar com cliente pagante real.

**Notificações:** e-mail transacional (Resend) + rotina agendada (Edge Function) varrendo prazos

**Pagamentos:** gateway automatizado (definir na sprint de financeiro — candidatos: Asaas ou Pagar.me)

## 4. Modelo multi-tenant

Existem três camadas de acesso, e elas mudam completamente o comportamento do sistema:

**Time interno Lynvex** — enxerga todas as empresas. Login separado, mesa admin. Cada uso do "passe" que atravessa empresas é registrado com motivo obrigatório.

**Dono/Admin da empresa cliente** — enxerga a própria empresa. Vê os módulos que o contrato liberou. Módulos não contratados aparecem com cadeado e "falar com a Jáwda".

**Usuários criados pelo dono da empresa** — enxergam o que o dono liberou por perfil e por escopo de unidade. Nunca podem ter mais poder que quem os criou.

### Hierarquia no banco

```
organizations (empresa cliente — 1 CNPJ = 1 organização)
  └── contract (o que ela comprou)
  │   └── contract_modules (quais módulos estão ligados)
  └── units (matriz, filial, obra) — hierarquia opcional
  └── users (pertencem à organização; um mesmo user pode estar em várias)
  │   └── user_units_access (a quais unidades esse user tem acesso)
  └── ncs, action_plans, audits, indicators, documents, ... (tudo carrega org_id)
  └── activity_log (trilha completa)

internal_staff (time Lynvex — fora das organizações)
internal_access_log (registro de quando atravessou pra qual empresa)
```

### Regra de RLS que ancora tudo

Toda tabela de dados de negócio tem `org_id NOT NULL`. Toda política de RLS filtra por `org_id = auth.jwt() ->> 'org_id'`. **Sem exceção.** A única exceção são as tabelas do painel administrativo, que são acessíveis apenas ao time interno Lynvex.

## 5. Personalização por empresa

**Apenas logo e cores.** Nada além disso. Sem subdomínio por empresa na v1 (fica para depois). Sem domínio próprio do cliente. Sem tela customizada por cliente. Sem campo customizado por cliente.

Motivo: qualquer coisa além disso quebra a escalabilidade. O primeiro cliente pede um campo especial, e dois anos depois você tem 15 versões do mesmo módulo.

Logo e cores ficam como dado da empresa e o sistema se pinta sozinho no carregamento. Um só código, mil identidades visuais, custo zero de manutenção.

## 6. Perfis e permissões

Lista fixa da Jáwda, não configurável pelo cliente na v1:

- **Administrador do Cliente** — enxerga tudo da empresa, cria usuários, aprova o que precisa aprovação.
- **Gestor da Qualidade** — enxerga tudo, aprova registros críticos preenchidos por IA, executa análise crítica.
- **Auditor** — foco no módulo Auditorias, checklist e apontamentos.
- **Gestor de Área** — vê e edita o que é da área dele.
- **Colaborador** — cria e trata o que é dele.
- **Somente Leitura** — visita apenas.

Cada usuário tem também um **escopo por unidade**: lista de unidades ou "todas, inclusive futuras". Sem esse "todas futuras", uma obra nova não aparece para quem deveria ver — armadilha comum que já está descartada aqui.

## 7. Ciclo de vida do cliente

**Provisionamento assistido:** o time Lynvex cria a empresa no painel admin, configura módulos e unidades, e convida o dono por e-mail. O dono cria a própria senha. **Nunca enviamos senha pronta.**

**Inadimplência em escada** (todos os prazos configuráveis no admin):
- **1º gatilho** — avisos por e-mail
- **2º gatilho** — banner de aviso no login
- **3º gatilho** — modo somente leitura
- **4º gatilho** — bloqueio de acesso

Cliente sempre pode exportar os dados dele, em qualquer degrau da escada. Não somos banco, e não somos sequestrador de dados.

**Cancelamento de módulo** — o dado permanece no banco, mas as telas ficam bloqueadas com "reative para acessar". Vínculos entre módulos degradam para rótulo, não quebram (ex.: NC que veio de auditoria vira "origem: AUD-2025-003 · módulo não contratado").

**Encerramento de contrato** — 6 meses de retenção antes da eliminação definitiva, previsto em contrato, com comprovante de exclusão.

## 8. Autenticação e sessão

- Login por e-mail e senha
- **2FA obrigatório para todos** — cliente e time interno
- Sem login via Google/Microsoft na v1
- Sessão não expira automaticamente
- Usuário some/desativa após 30 dias sem uso (registrado, não excluído)
- Colaborador que sai: desativação + tela obrigatória de redirecionar pendências para outro
- Um usuário pode pertencer a mais de uma empresa, com seletor no topo

## 9. Escopo da v1 (o que entra em 1 mês)

**Bloco Gestão da Qualidade completo:**
- Não Conformidades
- Planos de Ação
- Auditorias (interna com peso, externa como casca leve)
- Indicadores e KPIs

**Painel administrativo mínimo:**
- Cadastro de empresas + provisionamento
- Contratos e módulos habilitados
- Usuários e acessos (por empresa e o passe interno)
- Financeiro básico com escada de inadimplência

**Fica de fora da v1:**
Documentos · Riscos · Estratégia · Processos · Pessoas · Aquisição · Produção · Comunicações · Agente de IA real · Comercial e funil · Onboarding e consultoria · Suporte · Nota fiscal automática · WhatsApp · Subdomínio por empresa · App offline

O que fica de fora entra nos meses seguintes sobre a fundação, sem retrabalho.

## 10. Módulos da Gestão da Qualidade — regras críticas

### Não Conformidades
- Código: `NC_[ORIGEM]_[SEQ]_[ANO]` (ex.: `NC_AI_001_2026`)
- Contador **geral por ano** (não separa por origem)
- Prefixo `NC` editável pelo cliente
- 9 origens: AI, AE, RP, DO, RC, AC, IN, FO, ID
- 4 gravidades com SLA: Baixa 10d, Média 5d, Alta 72h, Crítica 24h (SLA configurável por empresa)
- Análise de causa: **5 Porquês** (resposta vira pergunta seguinte; 5ª resposta = causa raiz automática) e **Diagrama de Causa e Efeito** (nunca chamar de Ishikawa)
- NC encerrada **não reabre** — cria nova (vínculo com a antiga preservado no banco para reincidência na v2.0)
- **Nada apaga** — soft delete com motivo obrigatório

### Planos de Ação
- Código: `PA_[SEQ]_[ANO]`
- Só ações **corretivas** e **contingência** na v1 (sem preventiva ou melhoria)
- Contingência opcional, prazo governado de 2 dias úteis (configurável)
- Ações corretivas: cada uma individual, todos campos obrigatórios, 5W2H em português (O quê / Por quê / Onde / Quando / Quem / Como / Quanto custa) — **nunca em inglês na tela**
- Verificação de eficácia com **3 caminhos ao reprovar** (ver seção 11)
- Escalonamento hierárquico de aprovação por reprovação

### Auditorias
- Código: `AUD_[SEQ]_[ANO]`
- **Externa** = casca leve (só datas, auditores, escopo, upload do relatório — a execução vive no sistema da certificadora)
- **Interna** = peso completo (plano, checklist, apontamentos, relatório)
- ISO 9001 travada como padrão na v1; outras normas com aviso "Disponível apenas na opção Personalizado"
- Campo "Evento" **só aparece se tipo = Externa**
- Checklist com orientação por requisito, "anexar evidência" único campo opcional
- Relatório de auditoria interna permite co-branding (logo Jáwda + logo cliente)

### Indicadores e KPIs
- Código: `IND_[MAN|DER|IMP]_[SEQ]_[ANO]`
- Todo indicador vinculado a um **Objetivo da Qualidade** (obrigatório)
- 5 objetivos padrão da qualidade já cadastrados como base editável
- Análise crítica **obrigatória** quando medição fica fora da meta
- Meta não atingida por 2 ciclos consecutivos — sugere abrir NC com origem ID
- Alteração de meta preserva histórico (gráfico mostra linha antiga até a mudança, nova a partir dali)
- Biblioteca de 25+ indicadores prontos para adoção no onboarding

## 11. Fluxo de reprovação de eficácia (o mais delicado)

Quando a verificação de eficácia de uma ação corretiva reprova, quem verificou responde: **"Por que não foi eficaz?"** e escolhe 1 de 3:

- **Ação fraca** (executou mas não resolveu) — mantém a causa, cria nova ação corretiva
- **Causa errada** — reabre 5 Porquês (análise anterior fica visível como "1ª análise"), nova causa gera nova ação
- **Não executada** — reabre a mesma ação com novo prazo

Os três caminhos convergem para nova verificação de eficácia.

**Limite:** cada ação reprova e refaz **uma vez**. Se reprovar de novo, ela encerra como reprovada em definitivo e abre-se uma ação nova. **Exceção:** se o motivo foi "causa errada", a contagem reinicia — a ação nova ataca um problema diferente e tem direito ao próprio ciclo.

**Escalonamento paralelo:** 1ª reprovação — Gestor da Qualidade aprova a próxima tentativa. Se persistir — superior hierárquico. Cada tentativa registra na trilha quem verificou e quem aprovou.

**A NC permanece aberta durante todo o ciclo.** Só encerra quando uma ação aprova na eficácia.

**Nada é apagado.** Cada ciclo vira camada visível de histórico.

## 12. IA — arquitetura de agente

**Um agente único, não um agente por empresa.** Um agente por empresa recriaria o problema dos "mil sistemas": mil agentes para manter, um evolui, os outros não.

**Modelo do kit:** quando um usuário faz uma pergunta, o sistema monta na hora um "kit" com o crachá do usuário (permissões, empresa, unidade) + acesso aos dados daquela empresa (com a mesma trava de RLS) + acervo das normas contratadas. O agente responde com esse kit. No fim, descarta.

**Escopo do agente:** especialista na norma. Só fala sobre a norma. Recusa assuntos fora — mais barato e mais confiável.

**Contexto imediato, não acervo indexado.** Não indexar o acervo documental inteiro de cada cliente (caro demais). A IA trabalha com o **contexto imediato da tarefa na tela** — ex.: no 5W2H, sugere ações corretivas com base no problema que originou o plano.

**Base de conhecimento das normas** — escrita com **palavras próprias**. Nunca copiar o texto literal das normas ISO (direito autoral).

**Regra de autoria e aprovação:**
- Registro escrito à mão pelo humano nunca precisa de aprovação extra (autoria já assumida)
- Registro preenchido por IA em **NC ou auditoria** (críticos) exige aprovação de superior — nasce em "aguardando aprovação"
- Registro não crítico preenchido por IA segue direto após aceitação da pessoa
- Toda ação por IA fica marcada na trilha: "redigido pela IA, aprovado por [nome]"

**Consumo carimbado por empresa** — permite cobrança por uso e limite por plano.

**IA na v1 fica ligável mas não implementada** — a arquitetura já nasce preparada (função de chamada, contabilização por empresa, marcação na trilha), mas a integração com o modelo LLM real fica para uma sprint posterior. O comportamento simulado do protótipo continua funcionando enquanto isso.

## 13. Notificações

- **Dentro do sistema** (sino, badge)
- **E-mail transacional** (Resend) — cada usuário escolhe o que recebe
- Rotina automática (Edge Function agendada) varrendo prazos:
  - NC próxima de vencer SLA
  - Plano de ação atrasado
  - Auditoria programada nos próximos 7 dias
  - Indicador sem medição no período
  - Documento com revisão vencida
- **WhatsApp** fica para v2 — arquitetura de mensagens já contempla essa saída futura

## 14. Armazenamento

- Limite por plano, com upgrade pago
- Medidor visível ao cliente (X GB de Y GB), aviso em 80%
- **Nunca bloquear upload de evidência** ao estourar limite — sinalizar forte e acionar comercial
- Compressão de imagem no dispositivo antes do upload (foto de canteiro sai de 4MB para 400KB)

## 15. Uso em campo

Navegador responsivo, **mobile-first no formulário de NC** (poucos campos, foto direto da câmera, reenvio automático quando a conexão volta). App instalável PWA fica para evolução futura.

## 16. Migração de dados na entrada

Cliente novo não chega vazio, mas também não migra histórico completo. O que entra:

- **Estruturado:** só o que está em aberto (NCs abertas, planos em execução, apontamentos pendentes) e documentos vigentes (manual, procedimentos)
- **Como arquivo anexado:** histórico encerrado, acessível mas não consultável em relatório
- **Recomendado:** 12 meses de medição de indicadores para os gráficos não nascerem vazios

Presets de configuração por segmento (construção civil, indústria) para acelerar quando o volume de clientes crescer.

## 17. Padrões de código

**Nomenclatura**
- Rotas: `nao-conformidades.tsx`, `planos-de-acao.tsx` (kebab-case, seguindo o que já existe)
- Componentes: PascalCase, arquivos em kebab-case
- Interfaces: `PascalCase` sem prefixo `I`
- Enums no TypeScript: string literals em vez de enum (padrão do projeto)

**Estrutura de pastas**
- `src/routes/` — rotas do TanStack Router
- `src/components/[modulo]/` — componentes específicos de cada módulo
- `src/components/app/` — componentes globais (sidebar, topbar, ai-assistant)
- `src/components/ui/` — shadcn/ui (não alterar, é código gerado)
- `src/lib/` — store, mock-data, tipos, utilitários
- `src/hooks/` — React hooks compartilhados

**Design system** — todas as cores como variáveis semânticas em `styles.css` (oklch), nunca hardcode de cor no componente. Isso é o que sustenta o white-label.

**Formulários** — react-hook-form + Zod para validação. Sem exceção.

**Estado do servidor** — TanStack Query. Nunca fetch direto no componente.

**Toasts** — Sonner. Padrão: sucesso em verde, warning em âmbar, erro em vermelho, com descrição sempre que houver.

**Arquivo com mais de 500 linhas** — sinal de que precisa ser quebrado. Sinal, não regra absoluta. Já existem exceções conhecidas no protótipo que serão refatoradas.

## 18. Regras de segurança

- **Senhas nunca em plaintext.** Supabase Auth cuida disso.
- **Nunca expor senha para admin do sistema.** Nem no painel administrativo — quem esquece redefine, quem precisa ajudar acessa como cliente com registro na trilha.
- **CSRF, XSS, SQL injection** — TanStack Start + Supabase mitigam por padrão. Nunca construir SQL na mão no cliente.
- **Todas as chaves em variáveis de ambiente.** Nunca commitar `.env`.
- **RLS ativo em toda tabela.** Uma tabela sem RLS é um vazamento esperando acontecer.
- **Rate limiting** nas Edge Functions críticas (autenticação, IA, exportação).

## 19. Padrão de trabalho com Claude Code

Modelo de abas descartáveis. **Uma aba por entrega fechada**, nunca uma aba por módulo inteiro.

Toda aba nova começa lendo este documento (via referência no prompt inicial da aba).

Boas quebras de aba:
- "Plugar Supabase e migrar Auth"
- "Criar tabelas de fundação + RLS"
- "Persistir NC no banco (dashboard, lista, detalhe, criação)"
- "Persistir Plano de Ação + verificação de eficácia com 3 caminhos"

Quebras ruins:
- "Fazer o módulo de auditoria" (grande demais)
- "Ajustar coisinhas" (vago demais)

Cada aba entrega uma coisa funcional, testável, com commit próprio. Se a entrega ficar grande, quebra em duas antes de começar.

## 20. O que jamais fazer

- Adicionar campo ou lógica que dependa de empresa/unidade sem passar por `org_id`
- Copiar texto literal de normas ISO no acervo da IA
- Fazer o agente executar ação sem confirmação humana
- Deletar registro (usar soft delete com motivo)
- Enviar senha por e-mail (mandar link de definição)
- Colocar chave de API no código do frontend
- Ignorar RLS em qualquer tabela de negócio
- Fazer um agente por empresa

---

## 21. Padrões consolidados durante a execução (Abas 4 a 7)

Estas decisões surgiram na prática, durante a construção real do bloco Gestão da Qualidade, e viram padrão daqui em diante — inclusive para o Painel Admin.

### 21.1 — GRANT explícito em toda tabela nova (crítico)

O projeto está com **table auto-exposure desligado** no PostgREST. Isso significa que RLS sozinha não basta: toda tabela nova precisa também de `GRANT` explícito para os papéis `authenticated` e `service_role`, senão a API retorna "permission denied" mesmo com a política de RLS correta.

Esse bug já apareceu duas vezes (Aba 4 e Aba 5) e na segunda vez quebrou login de qualquer usuário real silenciosamente — o tipo de erro que passa despercebido até alguém tentar usar de verdade.

**Regra permanente:** toda migração que cria tabela nova encerra com:
```sql
grant select, insert, update on table_name to authenticated;
grant all on table_name to service_role;
-- delete NUNCA é concedido a authenticated (nada apaga)
```
Incluir isso na Skill `jawda-migrations` como passo obrigatório do checklist, não como nota de rodapé.

### 21.2 — Buckets de Storage não nascem sozinhos com a tabela

Nenhuma aba anterior à Aba 6 criou bucket nenhum, apesar de o passo a passo do Supabase já prever `evidencias`, `documentos` e `logos-empresas`. Toda vez que um módulo passa a usar upload de arquivo (evidência de NC, checklist de auditoria, logo da empresa), a aba responsável precisa **conferir explicitamente** se o bucket e a política dele já existem antes de assumir que sim.

**Regra permanente:** toda aba que envolve upload de arquivo inclui, como primeiro passo de verificação, checar se o bucket relevante existe e tem política de RLS coerente com o padrão `{org_id}/{modulo}/{entity_id}/{filename}`. Se não existir, criar nesta mesma aba, documentado.

### 21.3 — Agenda da auditoria nasce no detalhe, não na criação

Na Aba 6, o wizard de criação de auditoria interna deixou de ter etapa de "Plano de Auditoria" embutida. A agenda (dias, horários, processos, auditores) se monta na própria tela de **detalhe**, na aba Plano, depois que a auditoria já existe.

Isso é comportamento correto e não uma simplificação a ser revertida: auditoria interna raramente nasce com plano fechado — o gestor da qualidade cria a auditoria com data e escopo, e vai encaixando a agenda conforme fecha com os auditores e processos. Forçar isso no wizard de criação era fricção sem ganho real.

**Regra permanente:** wizards de criação carregam só o essencial para o registro nascer (identidade, tipo, escopo, datas). Configuração detalhada e operacional vive na tela de detalhe, após a criação.

### 21.4 — Apontamento de auditoria é gancho puro, sem tratativa própria

O apontamento gerado no checklist da auditoria interna **não duplica** campos de causa, correção ou evidência de tratamento. Esses campos existem só na NC (e no Plano de Ação) gerados a partir dele. O apontamento serve só para identificar o achado e linkar bidirecionalmente com o registro que efetivamente trata o problema.

Essa é a arquitetura correta, não uma simplificação: se o apontamento tivesse campos de tratativa próprios, o sistema teria dois lugares tratando o mesmo problema, e na primeira divergência entre eles (apontamento diz uma coisa, NC diz outra) o relatório de auditoria ficaria inconsistente com a evidência real.

**Regra permanente:** todo "gancho" que gera um registro em outro módulo (apontamento — NC, indicador fora da meta — NC, reclamação — NC) armazena só o necessário para criar o registro de destino e a referência bidirecional (`generated_nc_id`, chip visual dos dois lados). Nunca duplica campos de tratativa.

### 21.5 — Histórico versionado com RPC de fechamento de vigência

Para casos onde um valor muda ao longo do tempo mas o histórico precisa ser preservado (a meta de um indicador, por exemplo), o padrão que se consolidou na Aba 7 foi:

- Uma tabela `*_history` separada da tabela principal, com `valid_from` e `valid_until`
- Uma função RPC (`update_indicator_target` foi o primeiro caso) que, ao registrar um novo valor, **fecha a vigência anterior** (`valid_until = now()`) e **abre a nova** (`valid_from = now()`, `valid_until = null`)
- No gráfico/visualização, reconstruir a linha do tempo juntando os períodos de vigência — no caso dos indicadores, usando `type="stepAfter"` para o valor "saltar" exatamente no momento da mudança, sem gap visual

**Regra permanente:** qualquer campo de configuração que influencia análise histórica (metas, SLA por gravidade, tolerância) segue este padrão de tabela de histórico + RPC de fechamento de vigência, em vez de sobrescrever o valor na tabela principal.

### 21.6 — Nunca inserir manualmente numa tabela de log que já tem trigger (regra generalizada — bug recorrente)

Este bug já apareceu **duas vezes** em abas diferentes (Aba 8, na RPC de provisionamento escrevendo direto em `activity_log`; Aba 12, no mesmo padrão em `commercial_activity_log`) porque da primeira vez foi documentado como caso específico em vez de regra geral. Generalizando agora para não acontecer uma terceira vez:

**O problema:** quando uma tabela de negócio (`ncs`, `opportunities`, `contracts`, etc.) já tem um trigger `AFTER INSERT/UPDATE` que escreve automaticamente na tabela de log correspondente, qualquer função ou RPC que também tente inserir manualmente naquela mesma tabela de log — "pra garantir" ou "pra registrar algo a mais" — cria uma escrita redundante que esbarra em GRANT/RLS (porque funções chamadas pelo cliente muitas vezes não têm o mesmo nível de permissão que o trigger, que roda como `security definer`) e derruba o fluxo inteiro silenciosamente.

**Regra permanente:** antes de escrever `insert into activity_log(...)` ou `insert into [qualquer]_log(...)` dentro de uma função ou RPC, primeiro verificar se a tabela que está sendo mutada por essa função já tem um trigger de log associado. Se tiver, **não inserir de novo** — o trigger já cobre. Só inserir manualmente em tabela de log quando a ação não tiver trigger correspondente nenhum (por exemplo, ações que não mutam uma tabela específica, como "staff acessou como cliente").

Antes de criar qualquer RPC nova que mexe em tabela de negócio, checar explicitamente: "essa tabela já tem trigger de log? Se sim, minha função não deve inserir em log nenhum — só fazer o insert/update da tabela principal e deixar o trigger cuidar do resto."

### 21.7 — Toda lista suspensa em ordem alfabética (regra global de UI)

Regra estabelecida nos documentos de requisitos oficiais (Estratégia, Processos e Operação): **toda lista suspensa (dropdown/select), em qualquer tela do sistema, deve apresentar suas opções em ordem alfabética.** Sem exceção, salvo quando a ordem tem significado semântico explícito (ex.: níveis de gravidade Baixa–Crítica, meses do ano, etapas sequenciais de um fluxo) — nesses casos a ordem lógica prevalece e deve ser comentada no código.

Isso afeta código já escrito: os selects de NC (origem, setor, categoria), Auditorias (tipo, evento), Indicadores (frequência, fonte) e todos os outros devem ser auditados e reordenados quando forem tocados. Não é preciso uma sprint dedicada só para isso, mas toda vez que uma tela com dropdown for editada por qualquer motivo, aproveitar para alfabetizar as opções que não têm ordem semântica.

Para dropdowns populados a partir do banco, ordenar na query (`order by label`). Para dropdowns de valores fixos no código, manter o array já em ordem alfabética na fonte.

### 21.8 — Toda exportação segue padrão de documento institucional

Regra estabelecida no feedback oficial do módulo Estratégia: **todo artefato exportável do sistema (PDF, relatório, ata, proposta, ficha) deve seguir um padrão de documento com cabeçalho institucional** contendo, no mínimo: logo da empresa cliente (white-label, o mesmo logo já usado na personalização), nome da empresa, título do documento, data de geração, e identificação de quem gerou. Rodapé com numeração de página e uma marca discreta de que foi gerado pelo Jáwda.

Isso vale para tudo que sai do sistema para o mundo externo: relatório de auditoria, ata de análise crítica, proposta comercial, ficha de avaliação de desempenho, exportação de indicadores, exportação de NC, etc. O objetivo é duplo: o cliente apresenta documentos com a própria identidade (reforça o white-label e o valor percebido), e o documento tem aparência formal o suficiente para servir como evidência em auditoria de certificação.

**Implementação recomendada:** criar um componente/template único de "cabeçalho e rodapé de documento exportável" reutilizável, que leia o logo e os dados da empresa do contexto atual, em vez de cada módulo montar seu próprio cabeçalho. Isso garante consistência visual e um único ponto de manutenção. Quando o primeiro módulo implementar exportação real, esse template deve nascer como peça compartilhada, não local.

### 21.9 — Redirect URLs do Supabase Auth são allowlist manual, fora do código (fácil de esquecer numa migração de domínio)

Descoberto auditando o convite de dono de empresa (ABA 8): `auth.admin.inviteUserByEmail`/`generateLink` aceitam um `redirectTo` explícito no código, mas o servidor do Supabase **ignora silenciosamente** qualquer valor que não esteja cadastrado em Authentication → URL Configuration → Redirect URLs do projeto — sem erro, sem aviso, só cai de volta pra Site URL configurada. Confirmado testando contra o projeto real: `https://app.jawda.com.br` e até uma URL forjada (`evil-attacker.example.com`) voltaram ambos redirecionados pro Site URL, só `https://jawda-app.vercel.app` (já cadastrado) passou.

**Pegadinha adicional, também confirmada testando contra o projeto real:** o padrão cadastrado no allowlist (`https://app.jawda.com.br/**`) só casa com URLs que têm algo depois do domínio — `https://app.jawda.com.br` (sem barra final) cai no Site URL, `https://app.jawda.com.br/` (com barra) passa. Por isso `getClientAppUrl()` (jawda-admin, `src/lib/server/client-app-url.ts`) normaliza a barra final antes de usar o valor como `redirectTo`, em vez de confiar que `CLIENT_APP_URL` sempre vai vir formatada certo.

**Por que isso importa:** é proteção padrão contra open-redirect, então não dá pra "resolver só no código" — mudar o `redirectTo` de qualquer fluxo de e-mail do Supabase Auth (convite, recuperação de senha, magic link de impersonation) exige **duas mudanças em paralelo**: o `redirectTo` no código E o cadastro da URL correspondente no dashboard do Supabase, ou o código simplesmente não tem efeito nenhum.

**Estado atual (2026-08-30):** Site URL aponta para `https://jawda-app.vercel.app`, e `https://app.jawda.com.br/**` já foi pré-cadastrado no allowlist de Redirect URLs — mesmo o domínio ainda não estando em uso em produção — justamente para não ser esquecido no dia da migração de domínio.

**Regra permanente:** toda vez que o domínio de produção do jawda-app mudar de novo (troca de provedor, novo domínio, etc.), atualizar **Site URL** e **Redirect URLs** no dashboard do Supabase (Authentication → URL Configuration) no mesmo momento — isso não é coberto por nenhum deploy, `.env`, ou migração de banco, então não aparece em nenhum diff de código pra lembrar de fazer.

---

## Versionamento deste documento

Toda alteração de arquitetura precisa passar por este documento antes de virar código. Se o Claude Code for programar algo que contradiz este documento, ele deve parar e apontar a contradição, não implementar.

**Revisão registrada em:** fim das Abas 4-7 (padrões 21.1 a 21.5), depois estendida na Aba 12 (21.6), depois antes da migração dos módulos novos (21.7 e 21.8), e agora com a revisão da seção 3 sobre hospedagem (Vercel com região `gru1` fixada, aprovado para produção real, com VPS Hostinger mantido como evolução futura), e agora com a descoberta da allowlist de Redirect URLs do Supabase Auth (21.9).

**Próxima revisão prevista:** ao final da migração da Estratégia (Aba 16), para consolidar o que a primeira migração de módulo novo ensinar.
