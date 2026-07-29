-- Fundação multi-tenant: organizations, units, profiles, user_organizations,
-- user_units_access, internal_staff, internal_access_log.
-- Ordem e colunas seguem docs/MODELO_DE_DADOS.md.

create table organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  cnpj text not null unique,
  logo_url text,
  brand_color text,
  status text not null default 'active'
    check (status in ('active','aware','read_only','blocked','terminated')),
  code_prefix_nc text default 'NC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  parent_unit_id uuid references units(id),
  status text not null default 'active'
    check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

create index units_org_id_idx on units(org_id);

-- Perfil no domínio do Jáwda para cada auth.users.
-- active_org_id: NÃO está no MODELO_DE_DADOS.md original. Adicionada porque
-- o mecanismo de RLS escolhido (JWT custom claim via Auth Hook) precisa de
-- uma fonte determinística de "qual organização está ativa agora" para
-- usuários que pertencem a mais de uma empresa (seção 8 do Guia de
-- Arquitetura: "Um usuário pode pertencer a mais de uma empresa, com
-- seletor no topo"). Sem essa coluna o hook não tem como decidir o claim
-- org_id quando há ambiguidade.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  status text not null default 'active'
    check (status in ('active','inactive','invited')),
  active_org_id uuid references organizations(id) on delete set null,
  last_activity_at timestamptz,
  created_at timestamptz not null default now()
);

-- Um mesmo usuário pode pertencer a várias empresas.
create table user_organizations (
  user_id uuid not null references profiles(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null
    check (role in ('admin','quality_manager','auditor','area_manager','collaborator','viewer')),
  units_scope text not null default 'all'
    check (units_scope in ('all','specific')),
  is_active boolean not null default true,
  invited_at timestamptz,
  activated_at timestamptz,
  primary key (user_id, org_id)
);

create index user_organizations_org_id_idx on user_organizations(org_id);

-- Quais unidades específicas o user acessa (usado se units_scope = 'specific').
create table user_units_access (
  user_id uuid not null references profiles(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  primary key (user_id, org_id, unit_id)
);

create index user_units_access_org_id_idx on user_units_access(org_id);

-- Time interno Lynvex. Tabela separada do fluxo de empresas.
create table internal_staff (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null
    check (role in ('super_admin','commercial','financial','operations','consulting','support')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Registra cada vez que o time interno atravessa para uma empresa.
create table internal_access_log (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references internal_staff(id),
  org_id uuid not null references organizations(id),
  reason text not null,
  accessed_at timestamptz not null default now(),
  session_ended_at timestamptz
);

create index internal_access_log_org_id_idx on internal_access_log(org_id);
create index internal_access_log_staff_id_idx on internal_access_log(staff_id);
