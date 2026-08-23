-- Módulo Estratégia (Aba 16, sub-aba 3/5) — Escopo do Sistema (ISO 9001 4.3).
-- Mesmo espírito de documento versionado de swot_analyses (20260823110000),
-- mas com um estado a mais: rascunho → aguardando_aprovacao → vigente. Só
-- "Alta Direção" aprova (mapeado para o papel fixo 'admin' — Administrador
-- do Cliente — já que a lista de perfis da seção 6 do Guia não tem um
-- papel "Alta Direção" separado). Terminologia "Item Não Aplicável" em
-- toda a UI (nunca "exclusão" — feedback explícito do prompt desta aba).

create table scope_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  declaracao_texto text not null,
  status text not null default 'rascunho' check (status in (
    'rascunho', 'aguardando_aprovacao', 'vigente'
  )),
  revision_number int not null,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (org_id, revision_number),
  check (status <> 'vigente' or (approved_by is not null and approved_at is not null))
);

-- Só uma revisão em andamento por organização por vez (rascunho ou
-- aguardando_aprovacao) — mesma trava de swot_analyses. Podem existir
-- várias linhas 'vigente' ao longo do tempo (histórico); "a vigente atual"
-- é a de maior revision_number entre elas — nunca se edita a antiga
-- diretamente, uma nova revisão sempre nasce como linha nova.
create unique index scope_documents_one_open_per_org
  on scope_documents(org_id) where status in ('rascunho', 'aguardando_aprovacao');
create index scope_documents_org_id_idx on scope_documents(org_id);

create table scope_not_applicable_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  scope_document_id uuid not null references scope_documents(id) on delete cascade,
  requirement_description text not null,
  justification text,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index scope_not_applicable_items_org_id_idx on scope_not_applicable_items(org_id);
create index scope_not_applicable_items_doc_idx on scope_not_applicable_items(scope_document_id);
