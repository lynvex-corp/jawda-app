# JÃWDA â Guia de Arquitetura

> **Este documento Ã© a lei do projeto.** Toda aba do Claude Code deve lÃª-lo antes de escrever qualquer linha. Nenhuma decisÃ£o de arquitetura pode contrariar o que estÃ¡ aqui sem alterar o prÃ³prio documento primeiro.
>
> **VersÃ£o:** 1.0 Â· **Data:** nov/2026 Â· **Autor:** Matheus Marinho (Lynvex) Â· **Consultor de arquitetura:** Claude

---

## 1. O que Ã© o JÃ¡wda

Plataforma SaaS multi-tenant de gestÃ£o da qualidade e conformidade, comeÃ§ando por ISO 9001, com escala planejada para 500 a 1.000 empresas.

SÃ£o dois sistemas separados sobre o mesmo banco:

- **Painel do Cliente** (`app.jawda.com.br`) â onde cada empresa opera o prÃ³prio sistema de gestÃ£o.
- **Painel Administrativo** (`admin.jawda.com.br`) â onde a Lynvex provisiona empresas, cobra e acompanha.

## 2. PrincÃ­pios inegociÃ¡veis

Toda decisÃ£o de cÃ³digo deve respeitar estes princÃ­pios. Quando houver conflito, o princÃ­pio prevalece.

**Um cÃ³digo, um banco, um deploy.** Nunca uma instalaÃ§Ã£o por empresa. Isolamento entre empresas Ã© garantido **dentro do banco**, por Row Level Security do Supabase, nunca por filtro no cÃ³digo da tela.

**Empresa nunca vÃª dado de outra.** Nem por bug, nem por erro de consulta, nem por engenhosidade de usuÃ¡rio. Ã a fronteira mais importante do sistema, e Ã© o motivo de ele existir sobre o Supabase.

**Nada Ã© apagado.** Registros excluÃ­dos vÃ£o para o histÃ³rico com quem apagou, quando e por quÃª. Motivo obrigatÃ³rio. SÃ³ perfil alto exclui.

**A IA propÃµe, o humano decide.** Registros crÃ­ticos preenchidos por IA (NC e auditoria) nascem em estado "aguardando aprovaÃ§Ã£o" e sÃ³ um perfil superior os torna oficiais. Toda aÃ§Ã£o da IA fica marcada na trilha.

**O contrato manda no acesso.** O contrato do cliente diz quais mÃ³dulos ele vÃª e quais permanecem bloqueados. Financeiro empurra a empresa por uma escada de inadimplÃªncia: aviso â somente leitura â bloqueio, com cliente sempre podendo exportar dados.

**Trilha de auditoria em tudo que importa.** Toda aÃ§Ã£o que cria, altera ou encerra registro (NC, plano, auditoria, mediÃ§Ã£o de indicador) fica registrada com autor, timestamp e detalhe.

## 3. Stack

Escolhida apÃ³s anÃ¡lise do cÃ³digo-fonte do protÃ³tipo. **NÃ£o migrar para outra stack sem revisar este documento primeiro.**

**Frontend:** TanStack Start Â· React 19 Â· TypeScript Â· Tailwind CSS v4 (tokens em oklch) Â· shadcn/ui Â· Recharts Â· Zod Â· react-hook-form Â· Sonner (toasts) Â· Lucide (Ã­cones)

**Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions) Â· Row Level Security como trava de multi-tenant

**Deploy:** Vercel, com todas as funÃ§Ãµes fixadas explicitamente na regiÃ£o SÃ£o Paulo/Brasil (`gru1`, disponÃ­vel no plano Pro) â nÃ£o deixar no automÃ¡tico. O banco (Supabase) jÃ¡ estÃ¡ na mesma regiÃ£o, entÃ£o aplicaÃ§Ã£o e dado ficam fisicamente no Brasil. MigraÃ§Ã£o para VPS Hostinger com EasyPanel segue no radar como evoluÃ§Ã£o futura: custo mais previsÃ­vel em escala (500-1.000 empresas), e necessÃ¡ria se algum contrato de cliente grande exigir literalmente "provedor de hospedagem brasileiro" e nÃ£o apenas "processamento em territÃ³rio brasileiro" â a Vercel Ã© empresa americana, entÃ£o a regiÃ£o `gru1` resolve residÃªncia de dado mas pode nÃ£o satisfazer essa exigÃªncia contratual mais rÃ­gida. Enquanto isso nÃ£o acontecer, Vercel com regiÃ£o fixada Ã© a decisÃ£o vigente para operar com cliente pagante real.

**NotificaÃ§Ãµes:** e-mail transacional (Resend) + rotina agendada (Edge Function) varrendo prazos

**Pagamentos:** gateway automatizado (definir na sprint de financeiro â candidatos: Asaas ou Pagar.me)

## 4. Modelo multi-tenant

Existem trÃªs camadas de acesso, e elas mudam completamente o comportamento do sistema:

**Time interno Lynvex** â enxerga todas as empresas. Login separado, mesa admin. Cada uso do "passe" que atravessa empresas Ã© registrado com motivo obrigatÃ³rio.

**Dono/Admin da empresa cliente** â enxerga a prÃ³pria empresa. VÃª os mÃ³dulos que o contrato liberou. MÃ³dulos nÃ£o contratados aparecem com cadeado e "falar com a JÃ¡wda".

**UsuÃ¡rios criados pelo dono da empresa** â enxergam o que o dono liberou por perfil e por escopo de unidade. Nunca podem ter mais poder que quem os criou.

### Hierarquia no banco

```
organizations (empresa cliente â 1 CNPJ = 1 organizaÃ§Ã£o)
  âââ contract (o que ela comprou)
  â   âââ contract_modules (quais mÃ³dulos estÃ£o ligados)
  âââ units (matriz, filial, obra) â hierarquia opcional
  âââ users (pertencem Ã  organizaÃ§Ã£o; um mesmo user pode estar em vÃ¡rias)
  â   âââ user_units_access (a quais unidades esse user tem acesso)
  âââ ncs, action_plans, audits, indicators, documents, ... (tudo carrega org_id)
  âââ activity_log (trilha completa)

internal_staff (time Lynvex â fora das organizaÃ§Ãµes)
internal_access_log (registro de quando atravessou pra qual empresa)
```

### Regra de RLS que ancora tudo

Toda tabela de dados de negÃ³cio tem `org_id NOT NULL`. Toda polÃ­tica de RLS filtra por `org_id = auth.jwt() ->> 'org_id'`. **Sem exceÃ§Ã£o.** A Ãºnica exceÃ§Ã£o sÃ£o as tabelas do painel administrativo, que sÃ£o acessÃ­veis apenas ao time interno Lynvex.

## 5. PersonalizaÃ§Ã£o por empresa

**Apenas logo e cores.** Nada alÃ©m disso. Sem subdomÃ­nio por empresa na v1 (fica para depois). Sem domÃ­nio prÃ³prio do cliente. Sem tela customizada por cliente. Sem campo customizado por cliente.

Motivo: qualquer coisa alÃ©m disso quebra a escalabilidade. O primeiro cliente pede um campo especial, e dois anos depois vocÃª tem 15 versÃµes do mesmo mÃ³dulo.

Logo e cores ficam como dado da empresa e o sistema se pinta sozinho no carregamento. Um sÃ³ cÃ³digo, mil identidades visuais, custo zero de manutenÃ§Ã£o.

## 6. Perfis e permissÃµes

Lista fixa da JÃ¡wda, nÃ£o configurÃ¡vel pelo cliente na v1:

- **Administrador do Cliente** â enxerga tudo da empresa, cria usuÃ¡rios, aprova o que precisa aprovaÃ§Ã£o.
- **Gestor da Qualidade** â enxerga tudo, aprova registros crÃ­ticos preenchidos por IA, executa anÃ¡lise crÃ­tica.
- **Auditor** â foco no mÃ³dulo Auditorias, checklist e apontamentos.
- **Gestor de Ãrea** â vÃª e edita o que Ã© da Ã¡rea dele.
- **Colaborador** â cria e trata o que Ã© dele.
- **Somente Leitura** â visita apenas.

Cada usuÃ¡rio tem tambÃ©m um **escopo por unidade**: lista de unidades ou "todas, inclusive futuras". Sem esse "todas futuras", uma obra nova nÃ£o aparece para quem deveria ver â armadilha comum que jÃ¡ estÃ¡ descartada aqui.

## 7. Ciclo de vida do cliente

**Provisionamento assistido:** o time Lynvex cria a empresa no painel admin, configura mÃ³dulos e unidades, e convida o dono por e-mail. O dono cria a prÃ³pria senha. **Nunca enviamos senha pronta.**

**InadimplÃªncia em escada** (todos os prazos configurÃ¡veis no admin):
- **1Âº gatilho** â avisos por e-mail
- **2Âº gatilho** â banner de aviso no login
- **3Âº gatilho** â modo somente leitura
- **4Âº gatilho** â bloqueio de acesso

Cliente sempre pode exportar os dados dele, em qualquer degrau da escada. NÃ£o somos banco, e nÃ£o somos sequestrador de dados.

**Cancelamento de mÃ³dulo** â o dado permanece no banco, mas as telas ficam bloqueadas com "reative para acessar". VÃ­nculos entre mÃ³dulos degradam para rÃ³tulo, nÃ£o quebram (ex.: NC que veio de auditoria vira "origem: AUD-2025-003 Â· mÃ³dulo nÃ£o contratado").

**Encerramento de contrato** â 6 meses de retenÃ§Ã£o antes da eliminaÃ§Ã£o definitiva, previsto em contrato, com comprovante de exclusÃ£o.

## 8. AutenticaÃ§Ã£o e sessÃ£o

- Login por e-mail e senha
- **2FA obrigatÃ³rio para todos** â cliente e time interno
- Sem login via Google/Microsoft na v1
- SessÃ£o nÃ£o expira automaticamente
- UsuÃ¡rio some/desativa apÃ³s 30 dias sem uso (registrado, nÃ£o excluÃ­do)
- Colaborador que sai: desativaÃ§Ã£o + tela obrigatÃ³ria de redirecionar pendÃªncias para outro
- Um usuÃ¡rio pode pertencer a mais de uma empresa, com seletor no topo

## 9. Escopo da v1 (o que entra em 1 mÃªs)

**Bloco GestÃ£o da Qualidade completo:**
- NÃ£o Conformidades
- Planos de AÃ§Ã£o
- Auditorias (interna com peso, externa como casca leve)
- Indicadores e KPIs

**Painel administrativo mÃ­nimo:**
- Cadastro de empresas + provisionamento
- Contratos e mÃ³dulos habilitados
- UsuÃ¡rios e acessos (por empresa e o passe interno)
- Financeiro bÃ¡sico com escada de inadimplÃªncia

**Fica de fora da v1:**
Documentos Â· Riscos Â· EstratÃ©gia Â· Processos Â· Pessoas Â· AquisiÃ§Ã£o Â· ProduÃ§Ã£o Â· ComunicaÃ§Ãµes Â· Agente de IA real Â· Comercial e funil Â· Onboarding e consultoria Â· Suporte Â· Nota fiscal automÃ¡tica Â· WhatsApp Â· SubdomÃ­nio por empresa Â· App offline

O que fica de fora entra nos meses seguintes sobre a fundaÃ§Ã£o, sem retrabalho.

## 10. MÃ³dulos da GestÃ£o da Qualidade â regras crÃ­ticas

### NÃ£o Conformidades
- CÃ³digo: `NC_[ORIGEM]_[SEQ]_[ANO]` (ex.: `NC_AI_001_2026`)
- Contador **geral por ano** (nÃ£o separa por origem)
- Prefixo `NC` editÃ¡vel pelo cliente
- 9 origens: AI, AE, RP, DO, RC, AC, IN, FO, ID
- 4 gravidades com SLA: Baixa 10d, MÃ©dia 5d, Alta 72h, CrÃ­tica 24h (SLA configurÃ¡vel por empresa)
- AnÃ¡lise de causa: **5 PorquÃªs** (resposta vira pergunta seguinte; 5Âª resposta = causa raiz automÃ¡tica) e **Diagrama de Causa e Efeito** (nunca chamar de Ishikawa)
- NC encerrada **nÃ£o reabre** â cria nova (vÃ­nculo com a antiga preservado no banco para reincidÃªncia na v2.0)
- **Nada apaga** â soft delete com motivo obrigatÃ³rio

### Planos de AÃ§Ã£o
- CÃ³digo: `PA_[SEQ]_[ANO]`
- SÃ³ aÃ§Ãµes **corretivas** e **contingÃªncia** na v1 (sem preventiva ou melhoria)
- ContingÃªncia opcional, prazo governado de 2 dias Ãºteis (configurÃ¡vel)
- AÃ§Ãµes corretivas: cada uma individual, todos campos obrigatÃ³rios, 5W2H em portuguÃªs (O quÃª / Por quÃª / Onde / Quando / Quem / Como / Quanto custa) â **nunca em inglÃªs na tela**
- VerificaÃ§Ã£o de eficÃ¡cia com **3 caminhos ao reprovar** (ver seÃ§Ã£o 11)
- Escalonamento hierÃ¡rquico de aprovaÃ§Ã£o por reprovaÃ§Ã£o

### Auditorias
- CÃ³digo: `AUD_[SEQ]_[ANO]`
- **Externa** = casca leve (sÃ³ datas, auditores, escopo, upload do relatÃ³rio â a execuÃ§Ã£o vive no sistema da certificadora)
- **Interna** = peso completo (plano, checklist, apontamentos, relatÃ³rio)
- ISO 9001 travada como padrÃ£o na v1; outras normas com aviso "DisponÃ­vel apenas na opÃ§Ã£o Personalizado"
- Campo "Evento" **sÃ³ aparece se tipo = Externa**
- Checklist com orientaÃ§Ã£o por requisito, "anexar evidÃªncia" Ãºnico campo opcional
- RelatÃ³rio de auditoria interna permite co-branding (logo JÃ¡wda + logo cliente)

### Indicadores e KPIs
- CÃ³digo: `IND_[MAN|DER|IMP]_[SEQ]_[ANO]`
- Todo indicador vinculado a um **Objetivo da Qualidade** (obrigatÃ³rio)
- 5 objetivos padrÃ£o da qualidade jÃ¡ cadastrados como base editÃ¡vel
- AnÃ¡lise crÃ­tica **obrigatÃ³ria** quando mediÃ§Ã£o fica fora da meta
- Meta nÃ£o atingida por 2 ciclos consecutivos â sugere abrir NC com origem ID
- AlteraÃ§Ã£o de meta preserva histÃ³rico (grÃ¡fico mostra linha antiga atÃ© a mudanÃ§a, nova a partir dali)
- Biblioteca de 25+ indicadores prontos para adoÃ§Ã£o no onboarding

## 11. Fluxo de reprovaÃ§Ã£o de eficÃ¡cia (o mais delicado)

Quando a verificaÃ§Ã£o de eficÃ¡cia de uma aÃ§Ã£o corretiva reprova, quem verificou responde: **"Por que nÃ£o foi eficaz?"** e escolhe 1 de 3:

- **AÃ§Ã£o fraca** (executou mas nÃ£o resolveu) â mantÃ©m a causa, cria nova aÃ§Ã£o corretiva
- **Causa errada** â reabre 5 PorquÃªs (anÃ¡lise anterior fica visÃ­vel como "1Âª anÃ¡lise"), nova causa gera nova aÃ§Ã£o
- **NÃ£o executada** â reabre a mesma aÃ§Ã£o com novo prazo

Os trÃªs caminhos convergem para nova verificaÃ§Ã£o de eficÃ¡cia.

**Limite:** cada aÃ§Ã£o reprova e refaz **uma vez**. Se reprovar de novo, ela encerra como reprovada em definitivo e abre-se uma aÃ§Ã£o nova. **ExceÃ§Ã£o:** se o motivo foi "causa errada", a contagem reinicia â a aÃ§Ã£o nova ataca um problema diferente e tem direito ao prÃ³prio ciclo.

**Escalonamento paralelo:** 1Âª reprovaÃ§Ã£o â Gestor da Qualidade aprova a prÃ³xima tentativa. Se persistir â superior hierÃ¡rquico. Cada tentativa registra na trilha quem verificou e quem aprovou.

**A NC permanece aberta durante todo o ciclo.** SÃ³ encerra quando uma aÃ§Ã£o aprova na eficÃ¡cia.

**Nada Ã© apagado.** Cada ciclo vira camada visÃ­vel de histÃ³rico.

## 12. IA â arquitetura de agente

**Um agente Ãºnico, nÃ£o um agente por empresa.** Um agente por empresa recriaria o problema dos "mil sistemas": mil agentes para manter, um evolui, os outros nÃ£o.

**Modelo do kit:** quando um usuÃ¡rio faz uma pergunta, o sistema monta na hora um "kit" com o crachÃ¡ do usuÃ¡rio (permissÃµes, empresa, unidade) + acesso aos dados daquela empresa (com a mesma trava de RLS) + acervo das normas contratadas. O agente responde com esse kit. No fim, descarta.

**Escopo do agente:** especialista na norma. SÃ³ fala sobre a norma. Recusa assuntos fora â mais barato e mais confiÃ¡vel.

**Contexto imediato, nÃ£o acervo indexado.** NÃ£o indexar o acervo documental inteiro de cada cliente (caro demais). A IA trabalha com o **contexto imediato da tarefa na tela** â ex.: no 5W2H, sugere aÃ§Ãµes corretivas com base no problema que originou o plano.

**Base de conhecimento das normas** â escrita com **palavras prÃ³prias**. Nunca copiar o texto literal das normas ISO (direito autoral).

**Regra de autoria e aprovaÃ§Ã£o:**
- Registro escrito Ã  mÃ£o pelo humano nunca precisa de aprovaÃ§Ã£o extra (autoria jÃ¡ assumida)
- Registro preenchido por IA em **NC ou auditoria** (crÃ­ticos) exige aprovaÃ§Ã£o de superior â nasce em "aguardando aprovaÃ§Ã£o"
- Registro nÃ£o crÃ­tico preenchido por IA segue direto apÃ³s aceitaÃ§Ã£o da pessoa
- Toda aÃ§Ã£o por IA fica marcada na trilha: "redigido pela IA, aprovado por [nome]"

**Consumo carimbado por empresa** â permite cobranÃ§a por uso e limite por plano.

**IA na v1 fica ligÃ¡vel mas nÃ£o implementada** â a arquitetura jÃ¡ nasce preparada (funÃ§Ã£o de chamada, contabilizaÃ§Ã£o por empresa, marcaÃ§Ã£o na trilha), mas a integraÃ§Ã£o com o modelo LLM real fica para uma sprint posterior. O comportamento simulado do protÃ³tipo continua funcionando enquanto isso.

## 13. NotificaÃ§Ãµes

- **Dentro do sistema** (sino, badge)
- **E-mail transacional** (Resend) â cada usuÃ¡rio escolhe o que recebe
- Rotina automÃ¡tica (Edge Function agendada) varrendo prazos:
  - NC prÃ³xima de vencer SLA
  - Plano de aÃ§Ã£o atrasado
  - Auditoria programada nos prÃ³ximos 7 dias
  - Indicador sem mediÃ§Ã£o no perÃ­odo
  - Documento com revisÃ£o vencida
- **WhatsApp** fica para v2 â arquitetura de mensagens jÃ¡ contempla essa saÃ­da futura

## 14. Armazenamento

- Limite por plano, com upgrade pago
- Medidor visÃ­vel ao cliente (X GB de Y GB), aviso em 80%
- **Nunca bloquear upload de evidÃªncia** ao estourar limite â sinalizar forte e acionar comercial
- CompressÃ£o de imagem no dispositivo antes do upload (foto de canteiro sai de 4MB para 400KB)

## 15. Uso em campo

Navegador responsivo, **mobile-first no formulÃ¡rio de NC** (poucos campos, foto direto da cÃ¢mera, reenvio automÃ¡tico quando a conexÃ£o volta). App instalÃ¡vel PWA fica para evoluÃ§Ã£o futura.

## 16. MigraÃ§Ã£o de dados na entrada

Cliente novo nÃ£o chega vazio, mas tambÃ©m nÃ£o migra histÃ³rico completo. O que entra:

- **Estruturado:** sÃ³ o que estÃ¡ em aberto (NCs abertas, planos em execuÃ§Ã£o, apontamentos pendentes) e documentos vigentes (manual, procedimentos)
- **Como arquivo anexado:** histÃ³rico encerrado, acessÃ­vel mas nÃ£o consultÃ¡vel em relatÃ³rio
- **Recomendado:** 12 meses de mediÃ§Ã£o de indicadores para os grÃ¡ficos nÃ£o nascerem vazios

Presets de configuraÃ§Ã£o por segmento (construÃ§Ã£o civil, indÃºstria) para acelerar quando o volume de clientes crescer.

## 17. PadrÃµes de cÃ³digo

**Nomenclatura**
- Rotas: `nao-conformidades.tsx`, `planos-de-acao.tsx` (kebab-case, seguindo o que jÃ¡ existe)
- Componentes: PascalCase, arquivos em kebab-case
- Interfaces: `PascalCase` sem prefixo `I`
- Enums no TypeScript: string literals em vez de enum (padrÃ£o do projeto)

**Estrutura de pastas**
- `src/routes/` â rotas do TanStack Router
- `src/components/[modulo]/` â componentes especÃ­ficos de cada mÃ³dulo
- `src/components/app/` â componentes globais (sidebar, topbar, ai-assistant)
- `src/components/ui/` â shadcn/ui (nÃ£o alterar, Ã© cÃ³digo gerado)
- `src/lib/` â store, mock-data, tipos, utilitÃ¡rios
- `src/hooks/` â React hooks compartilhados

**Design system** â todas as cores como variÃ¡veis semÃ¢nticas em `styles.css` (oklch), nunca hardcode de cor no componente. Isso Ã© o que sustenta o white-label.

**FormulÃ¡rios** â react-hook-form + Zod para validaÃ§Ã£o. Sem exceÃ§Ã£o.

**Estado do servidor** â TanStack Query. Nunca fetch direto no componente.

**Toasts** â Sonner. PadrÃ£o: sucesso em verde, warning em Ã¢mbar, erro em vermelho, com descriÃ§Ã£o sempre que houver.

**Arquivo com mais de 500 linhas** â sinal de que precisa ser quebrado. Sinal, nÃ£o regra absoluta. JÃ¡ existem exceÃ§Ãµes conhecidas no protÃ³tipo que serÃ£o refatoradas.

## 18. Regras de seguranÃ§a

- **Senhas nunca em plaintext.** Supabase Auth cuida disso.
- **Nunca expor senha para admin do sistema.** Nem no painel administrativo â quem esquece redefine, quem precisa ajudar acessa como cliente com registro na trilha.
- **CSRF, XSS, SQL injection** â TanStack Start + Supabase mitigam por padrÃ£o. Nunca construir SQL na mÃ£o no cliente.
- **Todas as chaves em variÃ¡veis de ambiente.** Nunca commitar `.env`.
- **RLS ativo em toda tabela.** Uma tabela sem RLS Ã© um vazamento esperando acontecer.
- **Rate limiting** nas Edge Functions crÃ­ticas (autenticaÃ§Ã£o, IA, exportaÃ§Ã£o).

## 19. PadrÃ£o de trabalho com Claude Code

Modelo de abas descartÃ¡veis. **Uma aba por entrega fechada**, nunca uma aba por mÃ³dulo inteiro.

Toda aba nova comeÃ§a lendo este documento (via referÃªncia no prompt inicial da aba).

Boas quebras de aba:
- "Plugar Supabase e migrar Auth"
- "Criar tabelas de fundaÃ§Ã£o + RLS"
- "Persistir NC no banco (dashboard, lista, detalhe, criaÃ§Ã£o)"
- "Persistir Plano de AÃ§Ã£o + verificaÃ§Ã£o de eficÃ¡cia com 3 caminhos"

Quebras ruins:
- "Fazer o mÃ³dulo de auditoria" (grande demais)
- "Ajustar coisinhas" (vago demais)

Cada aba entrega uma coisa funcional, testÃ¡vel, com commit prÃ³prio. Se a entrega ficar grande, quebra em duas antes de comeÃ§ar.

## 20. O que jamais fazer

- Adicionar campo ou lÃ³gica que dependa de empresa/unidade sem passar por `org_id`
- Copiar texto literal de normas ISO no acervo da IA
- Fazer o agente executar aÃ§Ã£o sem confirmaÃ§Ã£o humana
- Deletar registro (usar soft delete com motivo)
- Enviar senha por e-mail (mandar link de definiÃ§Ã£o)
- Colocar chave de API no cÃ³digo do frontend
- Ignorar RLS em qualquer tabela de negÃ³cio
- Fazer um agente por empresa

---

## 21. PadrÃµes consolidados durante a execuÃ§Ã£o (Abas 4 a 7)

Estas decisÃµes surgiram na prÃ¡tica, durante a construÃ§Ã£o real do bloco GestÃ£o da Qualidade, e viram padrÃ£o daqui em diante â inclusive para o Painel Admin.

### 21.1 â GRANT explÃ­cito em toda tabela nova (crÃ­tico)

O projeto estÃ¡ com **table auto-exposure desligado** no PostgREST. Isso significa que RLS sozinha nÃ£o basta: toda tabela nova precisa tambÃ©m de `GRANT` explÃ­cito para os papÃ©is `authenticated` e `service_role`, senÃ£o a API retorna "permission denied" mesmo com a polÃ­tica de RLS correta.

Esse bug jÃ¡ apareceu duas vezes (Aba 4 e Aba 5) e na segunda vez quebrou login de qualquer usuÃ¡rio real silenciosamente â o tipo de erro que passa despercebido atÃ© alguÃ©m tentar usar de verdade.

**Regra permanente:** toda migraÃ§Ã£o que cria tabela nova encerra com:
```sql
grant select, insert, update on table_name to authenticated;
grant all on table_name to service_role;
-- delete NUNCA Ã© concedido a authenticated (nada apaga)
```
Incluir isso na Skill `jawda-migrations` como passo obrigatÃ³rio do checklist, nÃ£o como nota de rodapÃ©.

### 21.2 â Buckets de Storage nÃ£o nascem sozinhos com a tabela

Nenhuma aba anterior Ã  Aba 6 criou bucket nenhum, apesar de o passo a passo do Supabase jÃ¡ prever `evidencias`, `documentos` e `logos-empresas`. Toda vez que um mÃ³dulo passa a usar upload de arquivo (evidÃªncia de NC, checklist de auditoria, logo da empresa), a aba responsÃ¡vel precisa **conferir explicitamente** se o bucket e a polÃ­tica dele jÃ¡ existem antes de assumir que sim.

**Regra permanente:** toda aba que envolve upload de arquivo inclui, como primeiro passo de verificaÃ§Ã£o, checar se o bucket relevante existe e tem polÃ­tica de RLS coerente com o padrÃ£o `{org_id}/{modulo}/{entity_id}/{filename}`. Se nÃ£o existir, criar nesta mesma aba, documentado.

### 21.3 â Agenda da auditoria nasce no detalhe, nÃ£o na criaÃ§Ã£o

Na Aba 6, o wizard de criaÃ§Ã£o de auditoria interna deixou de ter etapa de "Plano de Auditoria" embutida. A agenda (dias, horÃ¡rios, processos, auditores) se monta na prÃ³pria tela de **detalhe**, na aba Plano, depois que a auditoria jÃ¡ existe.

Isso Ã© comportamento correto e nÃ£o uma simplificaÃ§Ã£o a ser revertida: auditoria interna raramente nasce com plano fechado â o gestor da qualidade cria a auditoria com data e escopo, e vai encaixando a agenda conforme fecha com os auditores e processos. ForÃ§ar isso no wizard de criaÃ§Ã£o era fricÃ§Ã£o sem ganho real.

**Regra permanente:** wizards de criaÃ§Ã£o carregam sÃ³ o essencial para o registro nascer (identidade, tipo, escopo, datas). ConfiguraÃ§Ã£o detalhada e operacional vive na tela de detalhe, apÃ³s a criaÃ§Ã£o.

### 21.4 â Apontamento de auditoria Ã© gancho puro, sem tratativa prÃ³pria

O apontamento gerado no checklist da auditoria interna **nÃ£o duplica** campos de causa, correÃ§Ã£o ou evidÃªncia de tratamento. Esses campos existem sÃ³ na NC (e no Plano de AÃ§Ã£o) gerados a partir dele. O apontamento serve sÃ³ para identificar o achado e linkar bidirecionalmente com o registro que efetivamente trata o problema.

Essa Ã© a arquitetura correta, nÃ£o uma simplificaÃ§Ã£o: se o apontamento tivesse campos de tratativa prÃ³prios, o sistema teria dois lugares tratando o mesmo problema, e na primeira divergÃªncia entre eles (apontamento diz uma coisa, NC diz outra) o relatÃ³rio de auditoria ficaria inconsistente com a evidÃªncia real.

**Regra permanente:** todo "gancho" que gera um registro em outro mÃ³dulo (apontamento â NC, indicador fora da meta â NC, reclamaÃ§Ã£o â NC) armazena sÃ³ o necessÃ¡rio para criar o registro de destino e a referÃªncia bidirecional (`generated_nc_id`, chip visual dos dois lados). Nunca duplica campos de tratativa.

### 21.5 â HistÃ³rico versionado com RPC de fechamento de vigÃªncia

Para casos onde um valor muda ao longo do tempo mas o histÃ³rico precisa ser preservado (a meta de um indicador, por exemplo), o padrÃ£o que se consolidou na Aba 7 foi:

- Uma tabela `*_history` separada da tabela principal, com `valid_from` e `valid_until`
- Uma funÃ§Ã£o RPC (`update_indicator_target` foi o primeiro caso) que, ao registrar um novo valor, **fecha a vigÃªncia anterior** (`valid_until = now()`) e **abre a nova** (`valid_from = now()`, `valid_until = null`)
- No grÃ¡fico/visualizaÃ§Ã£o, reconstruir a linha do tempo juntando os perÃ­odos de vigÃªncia â no caso dos indicadores, usando `type="stepAfter"` para o valor "saltar" exatamente no momento da mudanÃ§a, sem gap visual

**Regra permanente:** qualquer campo de configuraÃ§Ã£o que influencia anÃ¡lise histÃ³rica (metas, SLA por gravidade, tolerÃ¢ncia) segue este padrÃ£o de tabela de histÃ³rico + RPC de fechamento de vigÃªncia, em vez de sobrescrever o valor na tabela principal.

### 21.6 â Nunca inserir manualmente numa tabela de log que jÃ¡ tem trigger (regra generalizada â bug recorrente)

Este bug jÃ¡ apareceu **duas vezes** em abas diferentes (Aba 8, na RPC de provisionamento escrevendo direto em `activity_log`; Aba 12, no mesmo padrÃ£o em `commercial_activity_log`) porque da primeira vez foi documentado como caso especÃ­fico em vez de regra geral. Generalizando agora para nÃ£o acontecer uma terceira vez:

**O problema:** quando uma tabela de negÃ³cio (`ncs`, `opportunities`, `contracts`, etc.) jÃ¡ tem um trigger `AFTER INSERT/UPDATE` que escreve automaticamente na tabela de log correspondente, qualquer funÃ§Ã£o ou RPC que tambÃ©m tente inserir manualmente naquela mesma tabela de log â "pra garantir" ou "pra registrar algo a mais" â cria uma escrita redundante que esbarra em GRANT/RLS (porque funÃ§Ãµes chamadas pelo cliente muitas vezes nÃ£o tÃªm o mesmo nÃ­vel de permissÃ£o que o trigger, que roda como `security definer`) e derruba o fluxo inteiro silenciosamente.

**Regra permanente:** antes de escrever `insert into activity_log(...)` ou `insert into [qualquer]_log(...)` dentro de uma funÃ§Ã£o ou RPC, primeiro verificar se a tabela que estÃ¡ sendo mutada por essa funÃ§Ã£o jÃ¡ tem um trigger de log associado. Se tiver, **nÃ£o inserir de novo** â o trigger jÃ¡ cobre. SÃ³ inserir manualmente em tabela de log quando a aÃ§Ã£o nÃ£o tiver trigger correspondente nenhum (por exemplo, aÃ§Ãµes que nÃ£o mutam uma tabela especÃ­fica, como "staff acessou como cliente").

Antes de criar qualquer RPC nova que mexe em tabela de negÃ³cio, checar explicitamente: "essa tabela jÃ¡ tem trigger de log? Se sim, minha funÃ§Ã£o nÃ£o deve inserir em log nenhum â sÃ³ fazer o insert/update da tabela principal e deixar o trigger cuidar do resto."

### 21.7 â Toda lista suspensa em ordem alfabÃ©tica (regra global de UI)

Regra estabelecida nos documentos de requisitos oficiais (EstratÃ©gia, Processos e OperaÃ§Ã£o): **toda lista suspensa (dropdown/select), em qualquer tela do sistema, deve apresentar suas opÃ§Ãµes em ordem alfabÃ©tica.** Sem exceÃ§Ã£o, salvo quando a ordem tem significado semÃ¢ntico explÃ­cito (ex.: nÃ­veis de gravidade BaixaâCrÃ­tica, meses do ano, etapas sequenciais de um fluxo) â nesses casos a ordem lÃ³gica prevalece e deve ser comentada no cÃ³digo.

Isso afeta cÃ³digo jÃ¡ escrito: os selects de NC (origem, setor, categoria), Auditorias (tipo, evento), Indicadores (frequÃªncia, fonte) e todos os outros devem ser auditados e reordenados quando forem tocados. NÃ£o Ã© preciso uma sprint dedicada sÃ³ para isso, mas toda vez que uma tela com dropdown for editada por qualquer motivo, aproveitar para alfabetizar as opÃ§Ãµes que nÃ£o tÃªm ordem semÃ¢ntica.

Para dropdowns populados a partir do banco, ordenar na query (`order by label`). Para dropdowns de valores fixos no cÃ³digo, manter o array jÃ¡ em ordem alfabÃ©tica na fonte.

### 21.8 â Toda exportaÃ§Ã£o segue padrÃ£o de documento institucional

Regra estabelecida no feedback oficial do mÃ³dulo EstratÃ©gia: **todo artefato exportÃ¡vel do sistema (PDF, relatÃ³rio, ata, proposta, ficha) deve seguir um padrÃ£o de documento com cabeÃ§alho institucional** contendo, no mÃ­nimo: logo da empresa cliente (white-label, o mesmo logo jÃ¡ usado na personalizaÃ§Ã£o), nome da empresa, tÃ­tulo do documento, data de geraÃ§Ã£o, e identificaÃ§Ã£o de quem gerou. RodapÃ© com numeraÃ§Ã£o de pÃ¡gina e uma marca discreta de que foi gerado pelo JÃ¡wda.

Isso vale para tudo que sai do sistema para o mundo externo: relatÃ³rio de auditoria, ata de anÃ¡lise crÃ­tica, proposta comercial, ficha de avaliaÃ§Ã£o de desempenho, exportaÃ§Ã£o de indicadores, exportaÃ§Ã£o de NC, etc. O objetivo Ã© duplo: o cliente apresenta documentos com a prÃ³pria identidade (reforÃ§a o white-label e o valor percebido), e o documento tem aparÃªncia formal o suficiente para servir como evidÃªncia em auditoria de certificaÃ§Ã£o.

**ImplementaÃ§Ã£o recomendada:** criar um componente/template Ãºnico de "cabeÃ§alho e rodapÃ© de documento exportÃ¡vel" reutilizÃ¡vel, que leia o logo e os dados da empresa do contexto atual, em vez de cada mÃ³dulo montar seu prÃ³prio cabeÃ§alho. Isso garante consistÃªncia visual e um Ãºnico ponto de manutenÃ§Ã£o. Quando o primeiro mÃ³dulo implementar exportaÃ§Ã£o real, esse template deve nascer como peÃ§a compartilhada, nÃ£o local.

### 21.9 — Redirect URLs do Supabase Auth são allowlist manual, fora do código (fácil de esquecer numa migração de domínio)

Descoberto auditando o convite de dono de empresa (ABA 8): `auth.admin.inviteUserByEmail`/`generateLink` aceitam um `redirectTo` explícito no código, mas o servidor do Supabase **ignora silenciosamente** qualquer valor que não esteja cadastrado em Authentication → URL Configuration → Redirect URLs do projeto — sem erro, sem aviso, só cai de volta pra Site URL configurada. Confirmado testando contra o projeto real: `https://app.jawda.com.br` e até uma URL forjada (`evil-attacker.example.com`) voltaram ambos redirecionados pro Site URL, só `https://jawda-app.vercel.app` (já cadastrado) passou.

**Por que isso importa:** é proteção padrão contra open-redirect, então não dá pra "resolver só no código" — mudar o `redirectTo` de qualquer fluxo de e-mail do Supabase Auth (convite, recuperação de senha, magic link de impersonation) exige **duas mudanças em paralelo**: o `redirectTo` no código E o cadastro da URL correspondente no dashboard do Supabase, ou o código simplesmente não tem efeito nenhum.

**Estado atual (2026-08-30):** Site URL e allowlist apontam para `https://jawda-app.vercel.app`. O domínio custom usado como *fallback* no código (`CLIENT_APP_URL`, ver `jawda-admin/src/lib/server/invite-owner.ts` e `impersonate.ts`), `https://app.jawda.com.br`, **ainda não está na allowlist** — hoje isso não quebra nada (cai de volta pro `.vercel.app`, que funciona), mas é exatamente o tipo de coisa que passa despercebida até o dia da migração de domínio.

**Regra permanente:** toda vez que o domínio de produção do jawda-app mudar (migração pra `app.jawda.com.br`, troca de provedor, etc.), atualizar **Site URL** e **Redirect URLs** no dashboard do Supabase (Authentication → URL Configuration) no mesmo momento — isso não é coberto por nenhum deploy, `.env`, ou migração de banco, então não aparece em nenhum diff de código pra lembrar de fazer.

---

## Versionamento deste documento

Toda alteraÃ§Ã£o de arquitetura precisa passar por este documento antes de virar cÃ³digo. Se o Claude Code for programar algo que contradiz este documento, ele deve parar e apontar a contradiÃ§Ã£o, nÃ£o implementar.

**RevisÃ£o registrada em:** fim das Abas 4-7 (padrÃµes 21.1 a 21.5), depois estendida na Aba 12 (21.6), depois antes da migraÃ§Ã£o dos mÃ³dulos novos (21.7 e 21.8), e agora com a revisÃ£o da seÃ§Ã£o 3 sobre hospedagem (Vercel com regiÃ£o `gru1` fixada, aprovado para produÃ§Ã£o real, com VPS Hostinger mantido como evoluÃ§Ã£o futura), e agora com a descoberta da allowlist de Redirect URLs do Supabase Auth (21.9).

**PrÃ³xima revisÃ£o prevista:** ao final da migraÃ§Ã£o da EstratÃ©gia (Aba 16), para consolidar o que a primeira migraÃ§Ã£o de mÃ³dulo novo ensinar.
