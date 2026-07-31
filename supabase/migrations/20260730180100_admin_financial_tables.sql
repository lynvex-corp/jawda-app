-- Estrutura financeira do Painel Admin (ABA 8). Só a ESTRUTURA de dados +
-- visualização read-only na ficha da empresa — a operação de cobrança
-- (régua de inadimplência rodando de verdade, gateway de pagamento) fica
-- para uma aba de Financeiro dedicada, como o prompt desta aba já avisa.

-- Catálogo de planos — não é multi-tenant (não tem org_id), é dado global
-- da Lynvex. RLS restrita a internal_staff (seção do prompt: "TODAS com RLS
-- restrita a internal_staff" cobre as 4 tabelas financeiras, incluindo esta).
create table plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('essencial', 'profissional', 'enterprise')),
  name text not null,
  base_monthly_value numeric(10, 2) not null,
  included_users integer not null,
  included_units integer not null,
  included_storage_gb integer not null,
  included_modules text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  contract_id uuid not null references contracts(id),
  competence date not null,
  issued_at date not null default current_date,
  due_date date not null,
  amount numeric(10, 2) not null,
  status text not null default 'pending' check (status in ('paid', 'pending', 'overdue', 'cancelled')),
  payment_method text check (payment_method in ('boleto', 'pix', 'credit_card', 'bank_transfer')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references internal_staff(id),
  check (due_date >= issued_at)
);

create index invoices_org_id_idx on invoices(org_id);
create index invoices_org_status_idx on invoices(org_id, status);

create table payment_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid references invoices(id),
  event_type text not null check (event_type in (
    'invoice_created', 'payment_received', 'payment_failed', 'status_changed', 'manual_note'
  )),
  detail jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references internal_staff(id)
);

create index payment_events_org_id_idx on payment_events(org_id);

-- Estado da escada de inadimplência por org (seção 7 do Guia): regular →
-- aviso → somente_leitura → bloqueado. Uma linha por org (PK = org_id),
-- criada automaticamente no provisionamento (trigger na migração seguinte).
-- Prazos configuráveis por org, como o Guia exige ("todos os prazos
-- configuráveis no admin").
create table delinquency_state (
  org_id uuid primary key references organizations(id) on delete cascade,
  level text not null default 'regular' check (level in ('regular', 'aviso', 'somente_leitura', 'bloqueado')),
  entered_at timestamptz not null default now(),
  aviso_after_days integer not null default 5,
  somente_leitura_after_days integer not null default 15,
  bloqueado_after_days integer not null default 30,
  updated_at timestamptz not null default now(),
  updated_by uuid references internal_staff(id)
);

insert into plans (code, name, base_monthly_value, included_users, included_units, included_storage_gb, included_modules) values
  ('essencial', 'Essencial', 890.00, 10, 2, 20, array['non_conformity', 'action_plan']),
  ('profissional', 'Profissional', 1690.00, 30, 5, 50, array['non_conformity', 'action_plan', 'audit', 'indicators']),
  ('enterprise', 'Enterprise', 2990.00, 100, 20, 200, array['non_conformity', 'action_plan', 'audit', 'indicators', 'documents', 'risks']);
