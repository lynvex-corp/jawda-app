-- Módulo Pessoas (Aba 18, sub-aba 3/3) — Avaliação de Desempenho.
--
-- Decisão de modelagem do prompt: "avaliador" não é papel do sistema de
-- permissões (user_organizations.role) — é um vínculo por avaliação
-- (performance_evaluations.avaliador_user_id). A visibilidade de quem
-- avalia quem nasce desse vínculo, não de um papel fixo — ver RLS em
-- 20260825092100.

create table performance_cycles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  periodicidade text not null check (periodicidade in ('anual', 'bienal', 'semestral', 'trimestral')),
  meta_minima numeric not null default 7,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index performance_cycles_org_id_idx on performance_cycles(org_id);

create table performance_evaluations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  employee_id uuid not null references employees(id),
  cycle_id uuid not null references performance_cycles(id),
  avaliador_user_id uuid not null references profiles(id),
  status text not null default 'programada' check (status in (
    'programada', 'em_andamento', 'concluida'
  )),
  scheduled_at timestamptz not null default now(),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index performance_evaluations_org_id_idx on performance_evaluations(org_id);
create index performance_evaluations_employee_idx on performance_evaluations(employee_id);
create index performance_evaluations_avaliador_idx on performance_evaluations(avaliador_user_id);

create table performance_cha_answers (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references performance_evaluations(id) on delete cascade,
  bloco text not null check (bloco in ('conhecimento', 'habilidades', 'atitudes')),
  pergunta_index int not null check (pergunta_index between 0 and 4),
  nota int not null check (nota between 1 and 10),
  detalhamento text,
  unique (evaluation_id, bloco, pergunta_index)
);

create index performance_cha_answers_evaluation_idx on performance_cha_answers(evaluation_id);

create table performance_decision_matrix (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references performance_evaluations(id) on delete cascade unique,
  alto_potencial int not null check (alto_potencial between 1 and 3),
  cultura int not null check (cultura between 1 and 3),
  tecnico int not null check (tecnico between 1 and 3),
  recomendacao text
);

create table performance_feedback (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references performance_evaluations(id) on delete cascade unique,
  devolutiva_registro text not null,
  devolutiva_data date not null default current_date,
  -- Gancho Devolutiva → Plano de Ação, mesmo padrão de 2 passos usado em
  -- Estratégia (seção 21.4). origin_type='avaliacao_desempenho' já existe
  -- no enum de action_plans desde a Aba A.
  generated_action_plan_id uuid references action_plans(id)
);
