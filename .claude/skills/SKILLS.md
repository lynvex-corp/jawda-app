# Skills do Claude Code para o Jáwda

> **Skills** são instruções que o Claude Code carrega automaticamente quando detecta que o contexto pede aquele conhecimento. Colocando na pasta `.claude/skills/` do repositório, ele passa a segui-las em toda aba.
>
> Este arquivo lista o conteúdo de cada skill. Crie um arquivo `.md` para cada uma em `.claude/skills/[nome-da-skill]/SKILL.md`.

---

## Skill 1 — Multi-tenant (fronteira mais crítica)

**Nome do arquivo:** `.claude/skills/jawda-multitenant/SKILL.md`

**Conteúdo:**

```markdown
---
name: jawda-multitenant
description: Regras de multi-tenancy do Jáwda. Use quando estiver escrevendo qualquer query, tabela, política de RLS, ou lógica que envolva dados de empresas clientes. Vale para TUDO no diretório src/ e supabase/.
---

# Multi-tenancy no Jáwda — regras que jamais podem ser violadas

## Princípio inegociável
Empresa A NUNCA vê dado de empresa B. Nem por bug, nem por erro de query,
nem por engenhosidade de user. Se você escrever código que possa quebrar
isso, PARE e me alerte antes de continuar.

## Regra 1: toda tabela de negócio tem org_id
Se estiver criando uma tabela nova para o Jáwda e ela guarda dado de
empresa cliente, ela DEVE ter:
- coluna `org_id uuid not null references organizations(id) on delete cascade`
- índice em `(org_id)`
- RLS ligado
- políticas SELECT/INSERT/UPDATE filtrando por `org_id = current_setting('app.current_org_id')::uuid`
- DELETE bloqueado (nada apaga; usar soft delete com motivo)

Exceção: apenas tabelas do painel administrativo (organizations, contracts,
internal_staff, internal_access_log) que são acessíveis pelo time interno.

## Regra 2: nunca filtrar por org_id no código do frontend
O filtro vem do banco, via RLS. O código do frontend NÃO deve fazer:

  where('org_id', 'eq', currentOrgId)

Isso é sinal de que o RLS não está funcionando. RLS bem configurado torna
esse filtro redundante — e se ele existir, uma alteração futura pode
esquecer de aplicar em algum lugar e vazar.

## Regra 3: teste sempre com dois users em orgs diferentes
Toda vez que criar CRUD novo, ao final do trabalho:
1. Popular dado como user da org A
2. Fazer login como user da org B
3. Confirmar que o dado da org A NÃO aparece em NENHUM lugar
4. Se aparecer: PARAR TUDO. É vazamento crítico.

## Regra 4: JOINs entre tabelas de orgs diferentes é bug
Se você precisar fazer JOIN entre duas tabelas, todas as tabelas
envolvidas devem estar na mesma org. Se em algum momento você precisar
de dado cross-org, você está fazendo função de time interno Lynvex,
não de user cliente.

## Regra 5: Storage também é multi-tenant
Arquivos em buckets do Supabase Storage seguem convenção de path:
  {org_id}/{modulo}/{entity_id}/{filename}
E a política do bucket lê `storage.foldername(name)[1]` e compara com
`current_setting('app.current_org_id')`. Nunca fazer upload sem incluir
o org_id no path.

## Regra 6: Time interno Lynvex é exceção controlada
internal_staff tem passe que atravessa orgs, mas cada travessia precisa
gerar registro em `internal_access_log` com motivo obrigatório. Sem
motivo, o RLS deve barrar. Não construir "modo super-user" que ignora
essa trilha.
```

---

## Skill 2 — Convenções de código do Jáwda

**Nome do arquivo:** `.claude/skills/jawda-conventions/SKILL.md`

**Conteúdo:**

```markdown
---
name: jawda-conventions
description: Convenções de código e estilo do Jáwda. Use quando estiver escrevendo qualquer arquivo TypeScript, React ou SQL no projeto.
---

# Convenções do Jáwda

## Nomenclatura
- Rotas: kebab-case (`nao-conformidades.tsx`, `planos-de-acao.tsx`)
- Componentes React: PascalCase, arquivos em kebab-case
- Interfaces TypeScript: PascalCase, SEM prefixo `I`
- Enums: string literals ao invés de enum
  ```ts
  // ruim
  enum Status { Aberto, Fechado }
  // bom
  type Status = 'aberto' | 'fechado'
  ```

## Estrutura de pastas
- `src/routes/` — rotas do TanStack Router (nunca aninhar mais de 1 nível)
- `src/components/[modulo]/` — componentes de cada módulo
- `src/components/app/` — componentes globais (sidebar, topbar, ai-assistant)
- `src/components/ui/` — shadcn/ui (NÃO ALTERAR, é código gerado)
- `src/lib/` — cliente supabase, tipos, utilitários
- `src/lib/queries/` — hooks TanStack Query por módulo
- `src/hooks/` — hooks React compartilhados
- `supabase/migrations/` — migrações SQL versionadas

## Design system
- Cores SEMPRE via variáveis do styles.css (oklch). NUNCA hardcode.
  ```tsx
  // ruim
  <div className="bg-[#1F4E8C]">
  // bom
  <div className="bg-brand text-brand-foreground">
  ```
- Tipografia: Inter, tamanhos do Tailwind
- Ícones: Lucide React
- Toasts: Sonner (com descrição sempre que houver contexto)

## Formulários
- react-hook-form + Zod para validação. Sem exceção.
- Nunca controlled inputs manuais.
- Erros em vermelho abaixo do campo, com role="alert".

## Estado do servidor
- TanStack Query para tudo que vem do Supabase.
- Nunca fetch direto em componente. Sempre via hook em src/lib/queries/.
- staleTime padrão: 30s. cacheTime: 5min.

## Comentários
- Só quando o "por quê" não é óbvio pelo código.
- Nada de `// TODO`, `// FIXME` — se tem TODO, cria issue ou não commita.
- Nada de comentário em português E inglês misturado. Padrão: **português**.

## Tamanho de arquivo
- >500 linhas é sinal de que precisa quebrar em partes.
- >1000 linhas é praticamente uma regra: quebre.
- Exceções conhecidas do protótipo serão refatoradas em sprints próprias.

## Idioma
- Nomes de rota, tabela e coluna: **inglês** (nao_conformidades vira ncs, planos_de_acao vira action_plans)
- Enums de valor de negócio no banco: **inglês** minúsculo com underscore ('aberto', 'em_tratativa')
- Labels e textos da UI: **português**
- Comentários no código: **português**
- Não existe "meio-português/meio-inglês" — separado.

## Zod schemas
- Um por módulo, em `src/lib/schemas/[modulo].ts`
- Mensagens de erro em português
- Reutilizar entre criar e editar

## Testes
- Sem framework de teste na v1. Testes acontecem manualmente em cada aba.
- Ao final de cada aba, o Claude Code deve executar um smoke test da funcionalidade
  antes de commitar.
```

---

## Skill 3 — Regras de negócio da ISO / gestão da qualidade

**Nome do arquivo:** `.claude/skills/jawda-quality-rules/SKILL.md`

**Conteúdo:**

```markdown
---
name: jawda-quality-rules
description: Regras específicas do domínio da gestão da qualidade e ISO 9001 no Jáwda. Use quando estiver implementando módulos de NC, Plano de Ação, Auditoria ou Indicadores.
---

# Regras de negócio da qualidade — Jáwda

## Não Conformidades (NC)

### Código
Formato: `[PREFIXO]_[ORIGEM]_[SEQ]_[ANO]`
- Prefixo: default `NC`, editável por empresa (campo `code_prefix_nc` na tabela organizations)
- Origem: sigla de 2 letras conforme a lista fixa
- Seq: contador GERAL por ano, reinicia em janeiro. NÃO separar por origem.
- Ano: 4 dígitos

Origens permitidas (não adicionar sem avisar):
- AI — Auditoria Interna
- AE — Auditoria Externa
- RP — Rotina do Processo
- DO — Documental
- RC — Reclamação de Cliente
- AC — Análise Crítica pela Direção
- IN — Incidente ou Acidente
- FO — Fornecedor
- ID — Indicador

### Gravidade e SLA
- Baixa: 10 dias úteis
- Média: 5 dias úteis
- Alta: 72 horas
- Crítica: 24 horas

SLA é configurável por empresa (tabela `organization_sla_settings`).

### Setores de Ocorrência (lista fixa)
Operação, Planejamento, Projeto, Comercial, Pós-Venda,
Administrativo, Financeiro, RH, Qualidade.

### Categorias (lista fixa)
- falha_qualidade — Falha na qualidade do produto ou serviço
- descumprimento_procedimento — Descumprimento de procedimento interno
- descumprimento_norma — Descumprimento de norma ou legislação
- comprometimento_seguranca — Comprometimento da segurança

### NC nunca reabre
Uma vez encerrada, não reabre. Se o problema volta, cria-se NC nova.
O vínculo com a NC anterior fica registrado no campo `previous_nc_id`.
Isso permite calcular reincidência sem reabrir registro.

### Análise de causa
Duas ferramentas na v1:
1. **5 Porquês** — resposta de um vira a pergunta do próximo, campo por campo.
   A resposta do 5º porquê é a causa raiz (preenchida automaticamente, editável).
2. **Diagrama de Causa e Efeito** — nunca chamar de "Ishikawa" na UI.
   6 categorias (Método, Máquina, Mão de obra, Material, Medição, Meio ambiente)
   + espaço para descrever o Problema/Efeito.
   Este NÃO gera causa raiz única — pode haver várias causas.

## Planos de Ação

### Código
Formato: `PA_[SEQ]_[ANO]`
Sequencial geral por ano.

### Tipos de ação
Na v1, apenas:
- **Contingência** (opcional, prazo governado de 2 dias úteis, isolada no topo do plano)
- **Corretiva** (obrigatória, uma ou várias, cada uma individual)

Sem preventiva, sem melhoria na v1.

### 5W2H em português
NUNCA usar termos em inglês na UI:
- What → O quê
- Why → Por quê
- Where → Onde
- When → Quando
- Who → Quem
- How → Como
- How much → Quanto custa

### Verificação de eficácia — os 3 caminhos
Quando reprova, quem verificou escolhe UM de 3:
1. "Executou mas não resolveu" → mantém causa, cria nova ação corretiva
2. "Causa raiz estava errada" → reabre 5 Porquês (análise antiga guardada), nova causa gera nova ação
3. "Não foi executada" → reabre a mesma ação com novo prazo

Os 3 caminhos convergem para nova verificação de eficácia.

### Limite de refação
Cada ação corretiva reprova e refaz UMA vez. Se reprovar de novo, ela
encerra em definitivo. Abre-se nova ação para continuar tratando a NC.

**Exceção:** se o motivo foi "causa errada", a NOVA ação (nascida da nova causa)
tem direito ao próprio ciclo de 1 refação. A troca de causa reinicia a contagem.

### Escalonamento hierárquico
- 1ª reprovação → aprovação da próxima tentativa: Gestor da Qualidade
- 2ª reprovação → aprovação: superior hierárquico do Gestor da Qualidade
- Cada tentativa registra na trilha quem verificou e quem aprovou

## Auditorias

### Interna vs Externa
- **Externa** = casca leve (só datas, auditores, escopo, upload do relatório).
  A execução acontece no sistema da certificadora.
- **Interna** = peso completo (plano, checklist, apontamentos, relatório).

### Campo "Evento"
Só existe se tipo=externa (Certificação, Monitoração, Recertificação).
Se tipo=interna, o campo NÃO aparece na UI.

### Normas na v1
Apenas ISO 9001 liberada. Outras normas aparecem no formulário como
opções BLOQUEADAS com aviso "Disponível apenas na opção Personalizado".
Não implementar o fluxo Personalizado ainda.

## Indicadores e KPIs

### Código
Formato: `IND_[MAN|DER|IMP]_[SEQ]_[ANO]`
- MAN = manual (lançamento periódico pelo user)
- DER = derivado (calculado a partir de outros dados do sistema)
- IMP = importado (planilha)

### Objetivo da qualidade obrigatório
Todo indicador precisa estar vinculado a um `quality_objective`. Sem isso,
não pode ser criado.

### Análise crítica obrigatória fora da meta
Quando uma medição fica fora da meta, o campo de análise crítica é
obrigatório. Não é possível salvar sem preencher.

### Gatilho de NC
Meta não atingida por N ciclos consecutivos (default 2, configurável por
indicador) sugere abrir NC com origem "ID" (Indicador).

### Alteração de meta preserva histórico
Ao mudar a meta em um período, o gráfico mostra a linha da meta antiga até
aquele período e a nova a partir dali. Nunca sobrescrever histórico.

## IA — o que ela pode e não pode

### Pode
- Sugerir texto (causa raiz, ação corretiva, análise crítica)
- Sugerir criar NC quando reclamação chega
- Consultar dados da empresa do user (com o crachá do user)

### Não pode
- Executar ação sem confirmação humana
- Ver dado de outra empresa
- Aprovar registro crítico sozinha (NC ou auditoria preenchida por IA
  precisa aprovação de superior)
- Responder assunto fora da norma/gestão da qualidade

### Marcação na trilha
Toda ação que envolveu IA fica marcada em `activity_log`:
- `actor_type = 'ai'` quando a IA gerou o texto
- Se depois foi aprovado por um humano, registrar segundo evento
  `actor_type = 'user'` com `action = 'approved_ai_content'`

Isso é o que protege o cliente na auditoria — "quem escreveu foi a IA,
quem aprovou foi fulano".
```

---

## Skill 4 — Padrão de Migrações e SQL

**Nome do arquivo:** `.claude/skills/jawda-migrations/SKILL.md`

**Conteúdo:**

```markdown
---
name: jawda-migrations
description: Padrão de escrever migrações SQL para o Supabase do Jáwda. Use sempre que criar ou alterar tabelas, políticas ou funções no banco.
---

# Padrão de migrações do Jáwda

## Nome do arquivo
`supabase/migrations/{YYYYMMDDHHMMSS}_{descricao_curta}.sql`

Exemplos:
- `20261120143000_foundation_tables.sql`
- `20261120144500_foundation_rls.sql`
- `20261121100000_ncs_table.sql`

## Imutabilidade
Migração aplicada NÃO se altera. Se precisar mudar, criar migração nova
(alter table, drop coluna, etc). Isso preserva o histórico do banco.

## Estrutura de uma migração de tabela

```sql
-- Migration: NCs table
-- Purpose: Cria a tabela de Não Conformidades com constraints e índices

create table ncs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- ... resto das colunas
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices sempre incluem org_id como primeiro campo dos compostos
create index ncs_org_idx on ncs(org_id);
create index ncs_org_status_idx on ncs(org_id, status);

-- Trigger de updated_at (usar a função utilitária já criada no foundation)
create trigger ncs_updated_at
  before update on ncs
  for each row
  execute function set_updated_at();
```

## Estrutura de uma migração de RLS

Sempre em migração SEPARADA da criação da tabela. Facilita revisar.

```sql
-- Migration: NCs RLS
-- Purpose: Isola NCs por org via Row Level Security

alter table ncs enable row level security;

-- SELECT: user só vê NCs da sua org atual
create policy ncs_select_org
  on ncs for select
  using (org_id = current_setting('app.current_org_id', true)::uuid);

-- INSERT: só cria em nome da própria org
create policy ncs_insert_org
  on ncs for insert
  with check (org_id = current_setting('app.current_org_id', true)::uuid);

-- UPDATE: só edita o que é da própria org
create policy ncs_update_org
  on ncs for update
  using (org_id = current_setting('app.current_org_id', true)::uuid);

-- DELETE: bloqueado (nada apaga; usa soft delete com cancel_reason)
create policy ncs_no_delete
  on ncs for delete
  using (false);
```

## Estrutura de uma migração de trigger

```sql
-- Migration: NC activity trigger
-- Purpose: Registra em activity_log toda ação em NCs

create or replace function log_nc_activity()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_log(org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, new.created_by, 'created', 'nc', new.id, new.code,
            jsonb_build_object('severity', new.severity, 'origin', new.origin));
  elsif tg_op = 'UPDATE' then
    -- registra mudanças relevantes
    if old.status is distinct from new.status then
      insert into activity_log(org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
      values (new.org_id, auth.uid(), 'status_changed', 'nc', new.id, new.code,
              jsonb_build_object('from', old.status, 'to', new.status));
    end if;
  end if;
  return new;
end;
$$;

create trigger nc_activity
  after insert or update on ncs
  for each row
  execute function log_nc_activity();
```

## Regras
1. NUNCA usar CASCADE em DELETE de tabela de negócio (dá para vazar dado)
2. SEMPRE índice em org_id
3. SEMPRE RLS ligado antes de qualquer INSERT vir da aplicação
4. Constraint CHECK em enums (não confiar só no TypeScript)
5. `security definer` em funções que precisam bypass de RLS controlado
6. `security invoker` (default) em funções que rodam com permissão do user
7. Testar TODA migração local antes de aplicar (supabase db reset local)

## Dicas
- Migrações longas → quebra em várias (cria tabela em uma, RLS em outra, seed em outra)
- Se precisar backfill de dado após adicionar coluna, faz em migração separada
- Nunca faz DROP COLUMN sem antes documentar o motivo no header da migração
- Extensões do Postgres já estão habilitadas: pgcrypto, uuid-ossp, pg_cron
```

---

## Onde os skills ficam no repositório

```
compliance-wizard-kit/  (repositório do Jáwda)
├── .claude/
│   └── skills/
│       ├── jawda-multitenant/SKILL.md
│       ├── jawda-conventions/SKILL.md
│       ├── jawda-quality-rules/SKILL.md
│       └── jawda-migrations/SKILL.md
├── docs/
│   ├── GUIA_DE_ARQUITETURA.md
│   ├── MODELO_DE_DADOS.md
│   └── CRONOGRAMA_MES_A_MES.md
├── supabase/
│   └── migrations/
└── src/
    └── ...
```

O Claude Code carrega os skills automaticamente quando trabalha no repositório. Você não precisa colar cada um nos prompts — eles ficam ativos o tempo todo.
