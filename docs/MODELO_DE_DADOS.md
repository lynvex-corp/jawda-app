# Jáwda — Modelo de Dados Inicial (referência)

> Este é o **desenho** das tabelas principais. O Claude Code vai transformar isso em migrações SQL versionadas na primeira aba. **Não rode este arquivo diretamente.** Ele serve como especificação para o Claude Code seguir e como referência para revisar depois.

## Tabelas de fundação (auth + multi-tenant)

### `organizations` — a empresa cliente

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,               -- razão social
  trade_name text,                        -- nome fantasia
  cnpj text not null unique,
  logo_url text,
  brand_color text,                       -- hex, para white-label
  status text not null default 'active'   -- active, aware, read_only, blocked, terminated
    check (status in ('active','aware','read_only','blocked','terminated')),
  code_prefix_nc text default 'NC',       -- prefixo editável do código de NC
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### `units` — matriz, filial, obra

```sql
create table units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  parent_unit_id uuid references units(id),  -- hierarquia opcional (matriz > filial > obra)
  status text not null default 'active'
    check (status in ('active','archived')),
  created_at timestamptz default now()
);

create index on units(org_id);
```

### `users` — usuários da plataforma

```sql
-- Supabase Auth cria auth.users automaticamente.
-- Esta tabela é o "perfil" no domínio do Jáwda.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  status text not null default 'active'
    check (status in ('active','inactive','invited')),
  last_activity_at timestamptz,
  created_at timestamptz default now()
);

-- Um mesmo usuário pode pertencer a várias empresas
create table user_organizations (
  user_id uuid not null references profiles(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null
    check (role in ('admin','quality_manager','auditor','area_manager','collaborator','viewer')),
  units_scope text not null default 'all'
    check (units_scope in ('all','specific')),   -- 'all' = todas inclusive futuras
  is_active boolean not null default true,
  invited_at timestamptz,
  activated_at timestamptz,
  primary key (user_id, org_id)
);

-- Quais unidades específicas o user acessa (usado se units_scope = 'specific')
create table user_units_access (
  user_id uuid not null references profiles(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  primary key (user_id, org_id, unit_id)
);
```

### `internal_staff` — time Lynvex

```sql
-- Tabela SEPARADA do fluxo de empresas.
-- Time interno tem passe que atravessa todas as organizações.

create table internal_staff (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null
    check (role in ('super_admin','commercial','financial','operations','consulting','support')),
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Registra cada vez que atravessa para uma empresa
create table internal_access_log (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references internal_staff(id),
  org_id uuid not null references organizations(id),
  reason text not null,           -- motivo obrigatório
  accessed_at timestamptz default now(),
  session_ended_at timestamptz
);
```

## Contrato e módulos

```sql
create table contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  plan text not null check (plan in ('essencial','profissional','enterprise')),
  billing_cycle text not null check (billing_cycle in ('monthly','annual','annual_monthly')),
  monthly_value numeric(10,2) not null,
  start_date date not null,
  end_date date,
  index_type text default 'IPCA',  -- índice de reajuste
  next_readjustment_date date,
  storage_limit_gb integer not null default 50,
  ai_monthly_credits integer,       -- null = ilimitado com limite soft
  status text not null default 'active'
    check (status in ('active','overdue','suspended','cancelled')),
  created_at timestamptz default now()
);

-- Quais módulos estão ligados neste contrato
create table contract_modules (
  contract_id uuid not null references contracts(id) on delete cascade,
  module text not null
    check (module in (
      'non_conformity','action_plan','audit','indicators','documents',
      'risks','strategy','processes','people','acquisition','production',
      'communications'
    )),
  enabled boolean not null default false,
  extra_monthly_value numeric(10,2) default 0,
  activated_at timestamptz,
  primary key (contract_id, module)
);

-- Normas contratadas (add-on)
create table contract_norms (
  contract_id uuid not null references contracts(id) on delete cascade,
  norm text not null check (norm in ('iso_9001','iso_14001','iso_45001','lgpd')),
  enabled boolean not null default false,
  extra_monthly_value numeric(10,2) default 0,
  primary key (contract_id, norm)
);
```

## Módulo Não Conformidades

> **Atualizado na ABA 4** (migração de NC para dado real) para refletir o
> schema efetivamente aplicado em `supabase/migrations/20260729140100_ncs_table.sql`,
> que agora é a fonte da verdade — este desenho original previa 3 pontos
> diferentes do que a UI já construída (`src/components/nao-conformidades/`)
> exigia, e foi ajustado para não quebrar telas existentes:
>
> - **`status`** ganhou o valor `em_analise`. O desenho original tinha 5
>   estados; a UI do Kanban distingue "Em Classificação" de "Em Análise" como
>   duas colunas separadas (antes e depois da ferramenta de causa raiz — 5
>   Porquês/Ishikawa), então faltava um estado pra cobrir isso.
> - **`category`** trocou os 4 valores originais (estilo "natureza do
>   desvio": `falha_qualidade`, `descumprimento_procedimento`, ...) pelas 5
>   categorias por área que o wizard já oferece (`qualidade`, `seguranca`,
>   `meio_ambiente`, `regulatorio`, `financeiro`). Nenhuma tela usava os
>   valores originais. Campo também deixou de ser obrigatório, como já era
>   nos dados mockados.
> - **`local`** é campo novo, texto livre sem CHECK. A UI distingue "Local de
>   ocorrência" (Produção/Administrativo/Serviço/...) de "Setor de
>   Ocorrência" (`sector`, que já batia com o desenho original) — são dois
>   campos diferentes na tela, e só um estava previsto aqui.

```sql
create table ncs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid references units(id),
  code text not null,                     -- NC_AI_001_2026 — gerado por trigger, nunca pelo client
  origin text not null check (origin in (
    'auditoria_interna','auditoria_externa','rotina_processo','documental',
    'reclamacao_cliente','analise_critica_direcao','incidente_acidente',
    'fornecedor','indicador'
  )),
  description text not null,
  severity text not null check (severity in ('baixa','media','alta','critica')),
  category text check (category in (
    'qualidade','seguranca','meio_ambiente','regulatorio','financeiro'
  )),
  sector text check (sector in (
    'operacao','planejamento','projeto','comercial','pos_venda',
    'administrativo','financeiro','rh','qualidade'
  )),
  local text,                              -- texto livre — ver nota acima
  occurred_at timestamptz,                 -- data da ocorrência (etapa 1 do wizard)
  responsible_id uuid references profiles(id) default auth.uid(),
  status text not null default 'aberto' check (status in (
    'aberto','em_analise','em_tratativa','aguardando_verificacao','encerrado','cancelado'
  )),
  sla_deadline timestamptz not null,       -- calculado por trigger a partir da gravidade
  is_recurrent boolean not null default false,
  previous_nc_id uuid references ncs(id),  -- vínculo NC-nova ↔ NC-antiga (reincidência)
  swot_forwarded boolean not null default false,  -- se foi marcada como ameaça/fraqueza
  ai_authored boolean not null default false,     -- foi preenchida pela IA?
  ai_approved_by uuid references profiles(id),    -- quem aprovou (se foi da IA)
  ai_approved_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id),
  cancel_reason text,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique(org_id, code),
  check (status <> 'cancelado' or cancel_reason is not null)
);

create index on ncs(org_id);
create index on ncs(org_id, status);
create index on ncs(org_id, unit_id);
```

Segue a mesma lógica para `audits`, `indicators`, etc — o Claude Code vai criar essas tabelas na sprint de cada módulo. Se a tela já
construída exigir um campo ou enum diferente do desenhado aqui, o padrão é o
mesmo desta seção: ajustar o schema pra bater com a UI real, documentar o
desvio e atualizar este arquivo — nunca forçar a UI a se adequar a um
desenho especulativo que não foi testado contra tela nenhuma.

## Módulo Planos de Ação

> **Adicionado na ABA 5**, junto com a implementação correta do fluxo de
> reprovação de eficácia (seção 11 do Guia de Arquitetura). Fonte da
> verdade: `supabase/migrations/20260729150000_action_plans_table.sql` e
> `..._triggers.sql`.

O protótipo tratava "plano" e "ação corretiva" como a mesma linha 1:1
(`PlanoAcao` em `src/lib/mock-data.ts`) — simplificação que este desenho
corrige com 3 tabelas normalizadas:

- **`action_plans`** — o cabeçalho: vínculo com a NC de origem (`nc_id`,
  opcional — plano pode ser avulso ou vir de outros módulos via
  `origin_type`), contingência (opcional, prazo governado em dias úteis
  calculado em JS no wizard, não em trigger — não é campo de segurança como
  o SLA de NC). Código `PA_[SEQ]_[ANO]`, contador dedicado igual `ncs`.
  `status` é um *rollup* calculado por trigger a partir das ações
  corretivas: `concluido` assim que qualquer uma aprova na eficácia,
  `em_avaliacao`/`em_execucao` conforme a mais adiantada em andamento.

- **`action_plan_corrective_actions`** — cada ação corretiva individual,
  5W2H completo em português (seção 10 do Guia — sem campo "departamento",
  que só existia como agrupamento visual do protótipo). Uma ação nasce com
  o plano (`escalation_level = 0`, sem aprovação extra — autoria humana
  direta) ou como consequência de uma reprovação de eficácia
  (`parent_action_id` aponta pra ação superada, `restart_reason` guarda
  qual dos 3 caminhos a originou). Nada é apagado: a ação superada
  continua na tabela com `status = 'encerrada'` e `closure_reason`
  preenchido.

- **`action_plan_verifications`** — cada tentativa de verificação de
  eficácia de uma ação corretiva específica, limitada a 2 por ação
  (enforced em trigger via `count`, não dá pra expressar em `CHECK`
  simples). Guarda o motivo da reprovação (um dos 3 caminhos da seção 11),
  nova causa raiz (caminho "causa errada"), novo prazo, e quem aprovou a
  próxima tentativa (escalonamento).

O motor dos 3 caminhos (`handle_effectiveness_verification`, trigger AFTER
INSERT em `action_plan_verifications`) decide sozinho o que fazer:

| Motivo da reprovação | Efeito |
|---|---|
| não executada, 1ª vez nesta linha | reabre a MESMA ação, novo prazo |
| não executada, 2ª vez (estourou o limite) | encerra em definitivo, nasce ação nova |
| ação fraca | SEMPRE encerra e nasce ação nova, mantendo a causa raiz |
| causa errada | SEMPRE encerra e nasce ação nova, com causa raiz nova — reinicia a contagem de tentativas por construção (linha nova, id novo) |

Toda ação resultante de uma reprovação nasce em
`status = 'aguardando_aprovacao'`: o escalonamento hierárquico trava o
avanço até liberado. Nível 1 (1ª reprovação) exige `quality_manager`;
nível 2+ exige `admin` — mapeamento pragmático para "superior hierárquico
do Gestor da Qualidade" da seção 11, já que `user_organizations` não tem
coluna de hierarquia/gestor direto no modelo fixo de perfis da seção 6.

A NC de origem entra em `em_tratativa` assim que o plano é criado (trigger
`sync_nc_status_on_action_plan_created`) e **não fecha sozinha** quando uma
ação aprova na eficácia — a seção 11 diz que ela *pode* encerrar nesse
momento, não que encerra automaticamente; a UI oferece o encerramento via
diálogo de confirmação.

```sql
create table action_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid references units(id),
  code text not null,                      -- PA_[SEQ]_[ANO]
  nc_id uuid references ncs(id),
  origin_type text not null default 'nao_conformidade' check (origin_type in (
    'nao_conformidade','auditoria_interna','auditoria_externa','risco_oportunidade',
    'analise_critica','reclamacao_cliente','melhoria_continua','estrategia'
  )),
  problem_description text not null,
  contingency_description text,
  contingency_responsible_id uuid references profiles(id),
  contingency_deadline timestamptz,
  contingency_executed_at timestamptz,
  status text not null default 'planejado' check (status in (
    'planejado','em_execucao','em_avaliacao','concluido','atrasado','cancelado'
  )),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id),
  cancel_reason text,
  unique (org_id, code)
);

create table action_plan_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid references units(id),
  action_plan_id uuid not null references action_plans(id) on delete cascade,
  seq int not null,
  parent_action_id uuid references action_plan_corrective_actions(id),
  restart_reason text check (restart_reason in ('acao_fraca','causa_errada','nao_executada')),
  escalation_level int not null default 0,
  required_approval_role text check (required_approval_role in ('quality_manager','admin')),
  what_description text not null,          -- O quê
  why_justification text not null,         -- Por quê (causa raiz)
  where_location text not null,            -- Onde
  who_responsible_id uuid not null references profiles(id),  -- Quem
  how_method text not null,                -- Como
  how_much_cost numeric(10,2) not null default 0,             -- Quanto custa
  when_start timestamptz not null default now(),
  when_end timestamptz not null,           -- Quando
  status text not null default 'planejada' check (status in (
    'aguardando_aprovacao','planejada','em_execucao','aguardando_verificacao',
    'aprovada','encerrada'
  )),
  closure_reason text check (closure_reason in (
    'eficaz','acao_fraca','causa_errada','reprovada_definitiva'
  )),
  percent_complete int not null default 0,
  executed_at timestamptz,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (action_plan_id, seq)
);

create table action_plan_verifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  corrective_action_id uuid not null references action_plan_corrective_actions(id) on delete cascade,
  attempt_number int not null,             -- máx. 2 por ação, enforced em trigger
  verified_by uuid not null references profiles(id) default auth.uid(),
  verified_at timestamptz not null default now(),
  result text not null check (result in ('eficaz','nao_eficaz')),
  reason text check (reason in ('acao_fraca','causa_errada','nao_executada')),
  notes text,
  new_root_cause text,                     -- obrigatório se reason = causa_errada
  new_deadline timestamptz,                -- obrigatório se result = nao_eficaz
  escalation_level_required int,
  required_approval_role text check (required_approval_role in ('quality_manager','admin')),
  next_attempt_approved_by uuid references profiles(id),
  next_attempt_approved_at timestamptz,
  resulting_action_id uuid references action_plan_corrective_actions(id),
  created_at timestamptz not null default now(),
  unique (corrective_action_id, attempt_number)
);
```

## Trilha de auditoria (activity log)

```sql
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  actor_id uuid not null references profiles(id),
  actor_type text not null default 'user' check (actor_type in ('user','ai','system','internal_staff')),
  action text not null,                    -- 'created','updated','deleted','approved',...
  entity_type text not null,               -- 'nc','action_plan','audit',...
  entity_id uuid,
  entity_code text,                        -- código para exibição
  detail jsonb,                            -- payload livre da mudança
  created_at timestamptz default now()
);

create index on activity_log(org_id, created_at desc);
create index on activity_log(org_id, entity_type, entity_id);
```

## Políticas de RLS (o ponto mais crítico)

O padrão que **toda tabela de negócio** vai seguir:

```sql
alter table ncs enable row level security;

-- Usuário só vê NCs da sua organização
create policy nc_select_org
  on ncs for select
  using (org_id = current_setting('app.current_org_id')::uuid);

create policy nc_insert_org
  on ncs for insert
  with check (org_id = current_setting('app.current_org_id')::uuid);

create policy nc_update_org
  on ncs for update
  using (org_id = current_setting('app.current_org_id')::uuid);

-- DELETE é bloqueado (nada apaga)
create policy nc_no_delete
  on ncs for delete
  using (false);
```

**Detalhe importante:** `current_setting('app.current_org_id')` é preenchido pelo JWT do Supabase Auth via um custom claim. O Claude Code vai criar o hook de autenticação que injeta isso.

Para o time interno Lynvex, existe uma política adicional que permite acesso multi-org **desde que o acesso esteja logado em `internal_access_log`**.

## Storage — políticas

Para o bucket `evidencias`:

```sql
create policy evidencias_select
  on storage.objects for select
  using (
    bucket_id = 'evidencias'
    and (storage.foldername(name))[1] = current_setting('app.current_org_id')
  );
```

O path do arquivo vai seguir o padrão `{org_id}/nc/{nc_id}/{filename}`, garantindo isolamento por empresa via convenção de path + RLS.

## Migrações versionadas

Convenção:

```
supabase/migrations/
  20261115000000_foundation_tables.sql
  20261115010000_foundation_rls.sql
  20261116000000_ncs_table.sql
  20261116010000_ncs_rls.sql
  20261118000000_action_plans_table.sql
  ...
```

Cada aba do Claude Code que mexe no banco cria uma migração nova. Nunca alterar migração antiga (imutabilidade).

---

## Ordem de execução (para o Claude Code)

1. Foundation: organizations, units, profiles, user_organizations, user_units_access, internal_staff, internal_access_log
2. Contratos: contracts, contract_modules, contract_norms
3. Trilha: activity_log
4. Módulos, um por sprint: ncs → action_plans → audits → indicators
5. Storage buckets + policies

Todas as tabelas com RLS ligado desde o dia 1. **Nenhuma exceção.**
