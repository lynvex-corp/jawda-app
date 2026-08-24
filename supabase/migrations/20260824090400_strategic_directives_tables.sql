-- Módulo Estratégia (Aba 17, sub-aba 7/7) — Missão, Visão, Valores e
-- Propósito. Documento versionado, 5ª repetição do padrão já usado em
-- swot_analyses/stakeholder_analyses/scope_documents (seção 21.5).

create table strategic_directives (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  status text not null default 'rascunho' check (status in ('rascunho', 'formalizada')),
  version_label text,
  missao text,
  visao text,
  proposito text,
  formalized_at timestamptz,
  formalized_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  check (
    status <> 'formalizada'
    or (version_label is not null and formalized_at is not null and formalized_by is not null)
  )
);

create unique index strategic_directives_one_draft_per_org
  on strategic_directives(org_id) where status = 'rascunho';
create index strategic_directives_org_id_idx on strategic_directives(org_id);

create table strategic_values (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  strategic_directive_id uuid not null references strategic_directives(id) on delete cascade,
  nome text not null,
  descricao text,
  item_order int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid()
);

create index strategic_values_org_id_idx on strategic_values(org_id);
create index strategic_values_directive_idx on strategic_values(strategic_directive_id, item_order);
