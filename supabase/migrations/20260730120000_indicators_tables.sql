-- Módulo Indicadores e KPIs (ABA 7). Segue docs/GUIA_DE_ARQUITETURA.md seção 10
-- ("Indicadores e KPIs") e docs/MODELO_DE_DADOS.md (seção a documentar depois
-- desta aba, mesmo espírito de ncs/action_plans/audits).
--
-- 5 tabelas novas:
--   quality_objectives      — objetivo da qualidade (6.2a: coerência com a Política)
--   indicators               — cabeçalho do indicador, sempre vinculado a um objetivo
--   indicator_measurements    — medição periódica, com análise crítica quando fora da meta
--   indicator_target_history  — arquivo de metas anteriores (gráfico com 2 linhas)
--   critical_analysis_periods — consolidação da análise crítica por período
--
-- Nenhuma tem unit_id: o desenho do prompt desta aba não previu escopo por
-- unidade para indicadores (diferente de ncs), então RLS filtra só por
-- org_id — sem user_has_unit_access.
--
-- org_id ganha `default (auth.jwt() ->> 'org_id')::uuid` diretamente aqui
-- (não numa migração de correção posterior, como aconteceu com `ncs` em
-- 20260729140400) — aprendizado das ABAs 4/5/6 aplicado desde o início.

create table quality_objectives (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  name text not null,
  description text,
  -- Justificativa obrigatória de coerência com a Política da Qualidade
  -- (requisito 6.2a da ISO 9001) — por isso NOT NULL, diferente de description.
  coherence_with_policy text not null,
  deadline date,
  -- Nullable: os 6 objetivos padrão nascem sem responsável nem autor humano
  -- (inseridos por trigger no provisionamento da organização — ver
  -- 20260730120300_indicators_seed.sql). O usuário atribui depois.
  responsible_id uuid references profiles(id),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid()
);

create index quality_objectives_org_id_idx on quality_objectives(org_id);
create index quality_objectives_org_status_idx on quality_objectives(org_id, status);

create table indicators (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  code text not null,                       -- IND_[MAN|DER|IMP]_[SEQ]_[ANO] — gerado por trigger
  name text not null,
  description text,
  -- Todo indicador é obrigatoriamente vinculado a um objetivo da qualidade
  -- (regra central do módulo — sem objetivo, o wizard nem deixa avançar).
  quality_objective_id uuid not null references quality_objectives(id),
  process text,
  source text not null check (source in ('manual', 'derived', 'imported')),
  derived_source text,                      -- só relevante quando source='derived'
  formula text not null,
  unit text not null,
  frequency text not null check (frequency in (
    'daily', 'weekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual'
  )),
  target_value numeric not null,
  polarity text not null check (polarity in (
    'higher_is_better', 'lower_is_better', 'target_range'
  )),
  target_range_min numeric,
  target_range_max numeric,
  tolerance_percentage numeric not null default 10,
  auto_nc_after_cycles int not null default 2 check (auto_nc_after_cycles > 0),
  responsible_measurement_id uuid not null references profiles(id),
  responsible_analysis_id uuid not null references profiles(id),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (org_id, code),
  check (
    polarity <> 'target_range'
    or (target_range_min is not null and target_range_max is not null)
  )
);

create index indicators_org_id_idx on indicators(org_id);
create index indicators_org_status_idx on indicators(org_id, status);
create index indicators_org_objective_idx on indicators(org_id, quality_objective_id);

create table indicator_measurements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  indicator_id uuid not null references indicators(id) on delete cascade,
  period_reference text not null,           -- ex '2026-01' (mensal) — formato livre por frequência
  value numeric not null,
  observation text,
  -- Obrigatória quando fora da meta (validado no app E travado aqui por
  -- CHECK — mesma filosofia de defesa em profundidade do cancel_reason em
  -- ncs). out_of_target é calculado por trigger antes deste CHECK rodar.
  critical_analysis text,
  evidence_files jsonb not null default '[]',
  source text not null default 'manual' check (source in ('manual', 'imported', 'derived')),
  out_of_target boolean not null default false,
  ai_suggested_analysis boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (indicator_id, period_reference),
  check (not out_of_target or critical_analysis is not null)
);

create index indicator_measurements_org_id_idx on indicator_measurements(org_id);

create table indicator_target_history (
  id uuid primary key default gen_random_uuid(),
  indicator_id uuid not null references indicators(id) on delete cascade,
  target_value numeric not null,
  target_range_min numeric,
  target_range_max numeric,
  polarity text not null check (polarity in (
    'higher_is_better', 'lower_is_better', 'target_range'
  )),
  valid_from date not null,
  valid_until date,                         -- null = meta vigente
  changed_by uuid references profiles(id) default auth.uid(),
  changed_at timestamptz not null default now()
);

create index indicator_target_history_indicator_idx on indicator_target_history(indicator_id, valid_from);

create table critical_analysis_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  period_label text not null,               -- ex '1º semestre 2026'
  start_date date not null,
  end_date date not null,
  overall_analysis text,
  direction_decisions text,
  ai_suggested_analysis boolean not null default false,
  ai_approved_by uuid references profiles(id),
  ai_approved_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'consolidated', 'exported')),
  generated_at timestamptz,
  generated_by uuid references profiles(id),
  unique (org_id, period_label),
  check (end_date >= start_date)
);

create index critical_analysis_periods_org_id_idx on critical_analysis_periods(org_id);

-- Contador de código por organização e ano, sequencial GERAL (não separa por
-- fonte MAN/DER/IMP) — mesmo mecanismo de nc_code_counters.
create table indicator_code_counters (
  org_id uuid not null references organizations(id) on delete cascade,
  year int not null,
  next_seq int not null default 1,
  primary key (org_id, year)
);

-- Vínculo NC ↔ indicador de origem (gancho da seção 10 do Guia: "meta não
-- atingida por N ciclos consecutivos → sugere abrir NC com origem ID").
-- Vai em `ncs` (não em `indicators`) porque um indicador pode gerar várias
-- NCs ao longo da vida (cada nova sequência de N ciclos fora), enquanto uma
-- NC só tem uma origem — o inverso do padrão já usado em
-- audit_findings.generated_nc_id (lá o finding é evento único, aqui o
-- indicador é entidade recorrente). Nullable: a imensa maioria das NCs não
-- vem de indicador.
alter table ncs add column indicator_id uuid references indicators(id);
create index ncs_indicator_id_idx on ncs(indicator_id) where indicator_id is not null;
