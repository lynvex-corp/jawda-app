-- Módulo Estratégia (Aba 16, sub-aba 4/5) — Riscos e Oportunidades (ISO
-- 9001 6.1). O desenho de dados do prompt desta aba não incluía um campo
-- `code`, mas o protótipo (src/components/riscos/page.tsx) usa R-001/O-003
-- como identificador principal em toda a tela (matriz, tabela, tooltip,
-- vínculo em Plano de Ação) — sem ele a tela fica sem como referenciar um
-- registro. Adicionado seguindo o mesmo mecanismo de contador atômico de
-- nc_code_counters/action_plan_code_counters (seção 10 do Guia), mas sem
-- reset anual (o protótipo nunca reseta a numeração por ano para este
-- módulo).
--
-- area: enum já em ordem alfabética na origem (seção 21.7 do Guia).

create table risks_opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  code text not null,
  origin_swot_card_id uuid references swot_cards(id),
  type text not null check (type in ('risco', 'oportunidade')),
  area text not null check (area in (
    'comercial', 'normativo', 'operacao', 'projeto', 'qualidade', 'rh', 'suprimentos', 'ti'
  )),
  description text not null,
  probability int not null check (probability between 1 and 5),
  impact int not null check (impact between 1 and 5),
  risk_score int generated always as (probability * impact) stored,
  action_description text,
  decision text check (decision in ('evitar', 'assumir', 'eliminar_fonte', 'compartilhar')),
  -- Gancho Risco/Oportunidade → Plano de Ação, mesmo padrão de
  -- swot_cards.generated_action_plan_id (seção 21.4).
  generated_action_plan_id uuid references action_plans(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (org_id, code)
);

create index risks_opportunities_org_id_idx on risks_opportunities(org_id);
create index risks_opportunities_org_type_idx on risks_opportunities(org_id, type);
create index risks_opportunities_origin_swot_idx
  on risks_opportunities(origin_swot_card_id) where origin_swot_card_id is not null;

create table risk_opportunity_code_counters (
  org_id uuid primary key references organizations(id) on delete cascade,
  next_seq int not null default 1
);

-- Histórico append-only de reavaliação ("ponto fantasma" na matriz —
-- mostra de onde o risco veio antes de mudar de posição). Sem org_id
-- próprio: RLS resolve via join com risks_opportunities, mesmo padrão de
-- indicator_target_history (não tem unit_id/org_id, filho único de
-- indicators). Sem UPDATE nem DELETE — cada reavaliação é um snapshot novo,
-- nunca se corrige um snapshot antigo.
create table risk_reassessments (
  id uuid primary key default gen_random_uuid(),
  risk_id uuid not null references risks_opportunities(id) on delete cascade,
  probability int not null check (probability between 1 and 5),
  impact int not null check (impact between 1 and 5),
  reassessed_at timestamptz not null default now(),
  reassessed_by uuid not null references profiles(id) default auth.uid()
);

create index risk_reassessments_risk_idx on risk_reassessments(risk_id, reassessed_at);
