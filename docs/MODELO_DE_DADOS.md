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

Segue a mesma lógica para `action_plans`, `audits`, `indicators`, etc — o Claude Code vai criar essas tabelas na sprint de cada módulo. Se a tela já
construída exigir um campo ou enum diferente do desenhado aqui, o padrão é o
mesmo desta seção: ajustar o schema pra bater com a UI real, documentar o
desvio e atualizar este arquivo — nunca forçar a UI a se adequar a um
desenho especulativo que não foi testado contra tela nenhuma.

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
