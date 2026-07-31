-- Módulo Painel Administrativo (ABA 8). Fundação de contrato que
-- docs/MODELO_DE_DADOS.md já desenhava ("Contrato e módulos") mas que
-- NENHUMA aba anterior aplicou de fato — conferido direto no banco antes
-- desta migração (information_schema.tables não tinha contracts,
-- contract_modules nem contract_norms). O prompt desta aba assumia que já
-- existiam "da fundação"; não existiam. Criadas aqui, do zero, seguindo o
-- desenho especulativo do MODELO_DE_DADOS.md com pequenos ajustes.

create table contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  plan text not null check (plan in ('essencial', 'profissional', 'enterprise')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'annual', 'annual_monthly')),
  monthly_value numeric(10, 2) not null,
  start_date date not null,
  end_date date,
  index_type text default 'IPCA',
  next_readjustment_date date,
  storage_limit_gb integer not null default 50,
  ai_monthly_credits integer,
  status text not null default 'active' check (status in ('active', 'overdue', 'suspended', 'cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid references internal_staff(id),
  check (end_date is null or end_date >= start_date)
);

-- Só um contrato ativo por organização por vez — renovação/upgrade encerra
-- o antigo (status <> 'active') antes de abrir o novo. Histórico preservado
-- (nada apaga), só a unicidade do "vigente" é travada aqui.
create unique index contracts_org_active_idx on contracts(org_id) where status = 'active';
create index contracts_org_id_idx on contracts(org_id);

create table contract_modules (
  contract_id uuid not null references contracts(id) on delete cascade,
  module text not null check (module in (
    'non_conformity', 'action_plan', 'audit', 'indicators', 'documents',
    'risks', 'strategy', 'processes', 'people', 'acquisition', 'production',
    'communications'
  )),
  enabled boolean not null default false,
  extra_monthly_value numeric(10, 2) default 0,
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (contract_id, module)
);

create table contract_norms (
  contract_id uuid not null references contracts(id) on delete cascade,
  norm text not null check (norm in ('iso_9001', 'iso_14001', 'iso_45001', 'lgpd')),
  enabled boolean not null default false,
  extra_monthly_value numeric(10, 2) default 0,
  updated_at timestamptz not null default now(),
  primary key (contract_id, norm)
);
