# Jáwda — Cronograma mês a mês

> Este cronograma é a peça que amarra o que vai virar código. Ele traduz o Guia de Arquitetura em entregas semanais concretas. Não é promessa de prazo — é ordem de construção. Se algo escorregar, escorrega mantendo a ordem.

## Princípio da ordem

A ordem existe por uma razão simples: **a fundação vem antes das telas.** Todo módulo construído sobre uma fundação sólida herda multi-tenant, segurança e trilha de graça. Todo módulo construído antes da fundação teria que ser refeito.

## Mês 1 — Gestão da Qualidade em produção

Ao final deste mês você tem um produto vendável de ISO 9001. Não é MVP, é o núcleo completo do bloco que você já escolheu como carro-chefe.

### Semana 1 — Fundação (visualmente parece que nada aconteceu)

**Aba 1 — Bootstrap do repositório** (meio dia)
- Copiar protótipo para pasta nova
- Criar repositório privado no GitHub
- Adicionar docs/ e .claude/skills/
- Primeiro commit e push

**Aba 2 — Fundação do banco** (1 a 2 dias)
- Migrações de tabelas fundação (organizations, units, profiles, user_organizations, user_units_access, internal_staff, internal_access_log)
- RLS em todas as tabelas
- Funções auxiliares (set_current_org, get_current_org, handle_new_user)

**Aba 3 — Autenticação real** (1 a 2 dias)
- Cliente Supabase browser + server
- Login por e-mail e senha
- 2FA obrigatório (TOTP)
- Guard de rota
- Topbar com user real
- Seletor de empresa (quando user pertence a várias)
- Seed de organização de teste

**Ao final da semana 1:** você consegue criar user, ativar 2FA, entrar no sistema, mudar de empresa (se tiver várias). Nenhum dado de negócio ainda persiste, mas a casca está firme.

### Semana 2 — Não Conformidades com dado real

**Aba 4 — Migração da tabela de NC** (2 a 3 dias)
- Migração da tabela ncs
- RLS
- Hooks TanStack Query (useNCs, useNC, useCreateNC, useUpdateNC, useCancelNC)
- Substituir mock em cada componente de NC
- Geração de código NC_ORIGEM_SEQ_ANO
- Trigger de activity_log
- Teste com 2 orgs (crítico — RLS)

**Aba 5 — Setores, categorias e origens configuráveis por empresa** (1 dia)
- Prefixo da NC editável na empresa
- Confirmar que setores/categorias funcionam do jeito certo

**Ao final da semana 2:** NC persiste no banco, código sai certo, RLS funciona, cada empresa vê só as suas.

### Semana 3 — Planos de Ação com fluxo de eficácia completo

**Aba 6 — Planos de Ação + verificação de eficácia** (3 a 4 dias)
- Migração da tabela action_plans e action_plan_verifications
- RLS
- Hooks TanStack Query
- Substituir mock nos componentes
- **Implementar corretamente o fluxo de 3 caminhos** (ação fraca / causa errada / não executada) — não estava no protótipo
- Escalonamento hierárquico de aprovação
- Trilha com camadas visíveis do histórico
- Testar TODOS os caminhos e limites

**Aba 7 — Notificações e e-mail transacional** (2 dias)
- Configurar Resend
- Edge Function agendada varrendo prazos
- Sino no topbar com badge
- Preferências de notificação por usuário

**Ao final da semana 3:** Não Conformidades e Planos de Ação inteiramente funcionais com dado real, incluindo o fluxo completo de eficácia. E-mails de prazo saindo.

### Semana 4 — Auditorias + Indicadores + Painel Admin mínimo

**Aba 8 — Auditorias** (3 dias)
- Migração da tabela audits e audit_findings (apontamentos)
- RLS
- **Quebrar o arquivo de 2.061 linhas** de auditorias/detalhe.tsx em partes menores — este é o momento
- Hooks TanStack Query
- Externa como casca leve, interna como peso
- Apontamentos gerando NCs e planos de verdade
- Relatório com preview

**Aba 9 — Indicadores** (2 dias)
- Migração de quality_objectives, indicators e measurements
- RLS
- Objetivos da qualidade obrigatórios como pai
- Análise crítica obrigatória fora da meta
- Gatilho de 2 ciclos sugerindo NC (origem ID)
- Biblioteca de indicadores sugeridos no onboarding

**Aba 10 — Painel Admin básico** (2 dias)
- Endereço admin.jawda.com.br (mesmo banco, deploy separado ou rota isolada)
- Cadastro de empresas
- Provisionamento de módulos e unidades
- Convite do dono por e-mail
- Contratos com escada de inadimplência
- Gateway de pagamento (começar homologação — vai demorar uns dias com o gateway)

**Ao final da semana 4 / mês 1:** você tem um sistema vendável. Consegue cadastrar cliente pelo admin, provisionar acesso, cobrar, e o cliente opera Gestão da Qualidade completa.

## Mês 2 — Estratégia + Processos e Operações

Depois de rodar o mês 1 na sua produção interna e receber os primeiros clientes de teste, a prioridade se divide em duas frentes.

### Bloco Estratégia
- Análise de Cenário / SWOT (recebendo os cards das NCs marcadas como ameaça/fraqueza)
- Partes Interessadas
- Escopo do Sistema
- Riscos e Oportunidades
- Mudanças no SG

### Bloco Processos e Operações
- Processos e Fluxos
- Documentos (o que os clientes mais sentem falta — é o módulo que mais retém)
- Aquisição / Fornecedores
- Comunicações

**Deixar para o mês 3:** Produção e Serviços (depende de conhecer melhor o cliente do segmento industrial).

## Mês 3 — Pessoas + Treinamentos + Admin completo

### Bloco Pessoas
- Cargos e Perfis
- Gestão de Aprendizagem
- Avaliação de Performance
- Matriz de treinamentos

### Blocos operacionais/admin
- Treinamentos da Plataforma (o "curso" que ensina o cliente a usar)
- Usuários e Permissões (versão completa)
- Configurações do cliente
- Suporte (o módulo, não o SLA)

**A partir daqui:** o roadmap segue por prioridade comercial, não mais por escopo pré-definido.

## Frentes que correm em paralelo

Algumas coisas não são "sprint de módulo" mas precisam acontecer durante o mês 1 sob risco de virar gargalo depois:

**Checklist da norma redigido com palavras próprias** (você mesmo, não Claude Code)
- Você tem a expertise
- Não pode copiar texto literal da ISO por direito autoral
- Vai virar conteúdo do módulo Auditorias e do agente de IA depois
- Comece na semana 1 e faça um pouco por dia

**Gateway de pagamento** (semana 3 do mês 1)
- Homologação depende de terceiro
- Boleto e cartão exigem análise de crédito e documentos
- Se deixar para o fim do mês, atrasa a primeira cobrança

**Textos institucionais** (qualquer semana)
- Termo de uso
- Política de privacidade (LGPD)
- Contrato modelo
- E-mails transacionais (boas-vindas, senha, cobrança)

## Riscos deste cronograma

**O mês 1 está apertado.** Auditorias sozinho já é o módulo mais pesado do sistema, e vai encavalar com o admin básico. Se algo escorregar, escorrega Indicadores para a semana 1 do mês 2 — o cliente consegue operar sem eles no primeiro momento.

**O gateway pode atrasar independente de você.** Comece cedo. Se atrasar mesmo, cobre manualmente os primeiros clientes por Pix e boleto avulso enquanto a integração não fica pronta.

**Usuários ilimitados com IA inclusa é risco de custo.** Precisa de limite por empresa antes do primeiro cliente pagante, senão margem some. Já está previsto no admin, só não pode ser esquecido.

**O checklist da norma é gargalo escondido.** Escrever com palavras próprias 40+ requisitos leva tempo. Comece já.

## Sinais de que está indo bem

- Ao final da semana 1: um user novo consegue se cadastrar, ativar 2FA, logar e ver o dashboard vazio
- Ao final da semana 2: você consegue criar NC como user da empresa A, logar como B, e não ver nada da A
- Ao final da semana 3: uma ação corretiva reprova pelos 3 caminhos e cada um leva ao lugar certo, com trilha completa
- Ao final da semana 4: você consegue cadastrar uma empresa nova pelo admin, e ela loga e opera

## Sinais de que precisa ajustar

- Semana 2 sem NC persistindo: fundação está mais complicada do que devia. Peça para o Claude Code focar em um caminho feliz antes dos edge cases.
- Semana 3 sem o fluxo de 3 caminhos funcionando: o mais provável é que o modelo de dados de action_plan_verifications esteja apertado. Vale rever a migração.
- Semana 4 sem admin: o admin pode ser adiado. Nos primeiros 10 clientes, você provisiona no braço usando o Supabase Studio direto.

## Depois do mês 3

O caminho natural é IA de verdade (integração com modelo LLM real, aproveitando toda a arquitetura de kit por empresa que já está preparada), depois PWA/offline para uso em campo, e por fim o painel comercial e o site institucional.

Nada disso está no escopo dos 3 primeiros meses porque nada disso é bloqueador de venda. IA simulada continua funcionando para demonstração, campo funciona no mobile browser, e a venda inicial é consultiva — não precisa de site institucional para acontecer.
