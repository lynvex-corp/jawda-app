-- Módulo Estratégia (Aba 16, sub-aba 2/5) — Partes Interessadas (ISO 9001
-- 4.2). Mesmo padrão de documento versionado da Análise de Cenário
-- (swot_analyses/swot_cards, 20260823110000): stakeholder_analyses é o
-- "documento", stakeholders são as linhas de uma versão.
--
-- Mapa de influência × interesse do protótipo (src/components/estrategia/
-- partes-interessadas.tsx: sliders de influência/interesse, campo
-- categoria) fica de fora — v2.0, conforme Parte 2 do prompt desta aba. Só
-- persistem nome/requisitos/expectativas; a tela mostra aviso bloqueado no
-- lugar do mapa, no padrão visual do ModuleGate
-- (src/components/app/module-gate.tsx).

create table stakeholder_analyses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  status text not null default 'rascunho' check (status in ('rascunho', 'formalizada')),
  version_label text,
  formalized_at timestamptz,
  formalized_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  check (
    status <> 'formalizada'
    or (version_label is not null and formalized_at is not null and formalized_by is not null)
  )
);

create unique index stakeholder_analyses_one_draft_per_org
  on stakeholder_analyses(org_id) where status = 'rascunho';
create index stakeholder_analyses_org_id_idx on stakeholder_analyses(org_id);

create table stakeholders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  stakeholder_analysis_id uuid not null references stakeholder_analyses(id) on delete cascade,
  nome text not null,
  requisitos text,
  expectativas text,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index stakeholders_org_id_idx on stakeholders(org_id);
create index stakeholders_analysis_idx on stakeholders(stakeholder_analysis_id);
