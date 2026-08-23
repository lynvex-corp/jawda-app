-- Módulo Estratégia (Aba 16, sub-aba 1/5) — Análise de Cenário (SWOT).
-- docs/GUIA_DE_ARQUITETURA.md seção 10 (bloco de Estratégia) e seção 21.5
-- (histórico versionado). Duas tabelas:
--
--   swot_analyses — o "documento" formal versionado. Só um rascunho aberto
--     por organização por vez (unique index parcial abaixo); "Formalizar"
--     e "Nova versão" são RPCs (20260823110200_estrategia_swot_triggers.sql),
--     não UPDATE/INSERT livre — mesmo espírito de update_indicator_target.
--   swot_cards — cada item da matriz, pertence a UMA versão (rascunho ou
--     formalizada). Cards recém-chegados de uma NC marcada como
--     ameaça/fraqueza nascem em 'nao_classificado' (gancho real, trigger em
--     ncs — seção 21.4 do Guia: gancho puro, sem tratativa própria aqui,
--     source_nc_id é só a referência).
--
-- Sem unit_id: SWOT é um documento único por organização (nível
-- corporativo), não por unidade — mesmo desenho de quality_objectives /
-- indicators (seção 10, sem escopo de unidade).

create table swot_analyses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  status text not null default 'rascunho' check (status in ('rascunho', 'formalizada')),
  version_label text,
  contexto_interno text,
  contexto_externo text,
  formalized_at timestamptz,
  formalized_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  check (
    status <> 'formalizada'
    or (version_label is not null and formalized_at is not null and formalized_by is not null)
  )
);

-- Só um rascunho aberto por organização por vez (regra funcional da Parte 1
-- do prompt). Trava aqui, não só no app — INSERT concorrente de um segundo
-- rascunho estoura essa constraint.
create unique index swot_analyses_one_draft_per_org
  on swot_analyses(org_id) where status = 'rascunho';
create index swot_analyses_org_id_idx on swot_analyses(org_id);

create table swot_cards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  swot_analysis_id uuid not null references swot_analyses(id) on delete cascade,
  quadrant text not null default 'nao_classificado' check (quadrant in (
    'forca', 'fraqueza', 'oportunidade', 'ameaca', 'nao_classificado'
  )),
  category text,
  description text not null,
  -- Gancho NC → SWOT (seção 21.4 do Guia): preenchido só quando o card
  -- nasceu automaticamente de uma NC marcada como ameaça/fraqueza no
  -- wizard (ncs.swot_forwarded). Referência bidirecional: o lado NC já
  -- existe (ncs.swot_forwarded), este é o chip visual do lado SWOT.
  source_nc_id uuid references ncs(id),
  -- Gancho SWOT → Plano de Ação, mesmo padrão de audit_findings.
  -- generated_nc_id/generated_action_plan_id (seção 21.4): preenchido pelo
  -- app em 2 passos (insere o plano, depois aponta aqui) — nunca duplica
  -- campo de tratativa nesta tabela.
  generated_action_plan_id uuid references action_plans(id),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid()
);

create index swot_cards_org_id_idx on swot_cards(org_id);
create index swot_cards_analysis_idx on swot_cards(swot_analysis_id);
create index swot_cards_source_nc_idx on swot_cards(source_nc_id) where source_nc_id is not null;
