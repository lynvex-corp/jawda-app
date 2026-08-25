-- Módulo Processos e Operação (Parte 1) — Documentos.
--
-- quality_policy segue o mesmo padrão de documento versionado (seção 21.5
-- do Guia de Arquitetura), já usado 5x em Estratégia — reaproveitando o
-- desenho de strategic_directives (20260824090400) em vez de recriar.
--
-- documents/document_revisions seguem o modelo de controle de documentos
-- do requisito 7.5 da ISO 9001: o registro "vivo" (documents) guarda só o
-- estado atual; toda revisão anterior fica preservada em
-- document_revisions, nunca sobrescrita.

create table quality_policy (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  status text not null default 'rascunho' check (status in ('rascunho', 'formalizada')),
  version_label text,
  content text,
  formalized_at timestamptz,
  formalized_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  check (
    status <> 'formalizada'
    or (version_label is not null and formalized_at is not null and formalized_by is not null)
  )
);

create unique index quality_policy_one_draft_per_org
  on quality_policy(org_id) where status = 'rascunho';
create index quality_policy_org_id_idx on quality_policy(org_id);

create table documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  code text not null,
  title text not null,
  type text not null
    check (type in ('lei', 'manual', 'norma', 'planilha', 'procedimento', 'outro')),
  current_revision int not null default 1,
  last_revision_date date,
  responsible_id uuid references profiles(id),
  elaborador_id uuid references profiles(id),
  status text not null default 'vigente'
    check (status in ('vigente', 'em_revisao', 'inutilizado_revogado')),
  file_url text,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (org_id, code)
);

create index documents_org_id_idx on documents(org_id);

-- Histórico de revisões — nunca sobrescrever uma revisão anterior. Escrita
-- só via RPC register_document_revision (20260825100200), que cuida do
-- insert aqui e do avanço de documents.current_revision atomicamente.
create table document_revisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  document_id uuid not null references documents(id) on delete cascade,
  revision_number int not null,
  content_or_file_url text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid(),
  unique (document_id, revision_number)
);

create index document_revisions_org_id_idx on document_revisions(org_id);
create index document_revisions_document_idx on document_revisions(document_id, revision_number);

-- Ata de Reunião — categoria própria, arquivada separada de `documents`.
create table meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  title text not null,
  meeting_date date not null,
  participants jsonb not null default '[]'::jsonb,
  agenda text,
  deliberations text,
  attachment_url text,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index meeting_minutes_org_id_idx on meeting_minutes(org_id);

-- Lista de Frequência.
create table attendance_lists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  event_title text not null,
  event_date date not null,
  participants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index attendance_lists_org_id_idx on attendance_lists(org_id);
