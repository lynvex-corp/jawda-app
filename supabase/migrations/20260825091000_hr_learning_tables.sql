-- Módulo Pessoas (Aba 18, sub-aba 2/3) — Gestão de Aprendizagem. Não guarda
-- dado de saúde nem documento pessoal (isso é só em employee_attachments,
-- Parte 1) — trilha e RLS seguem o padrão comum de módulo de negócio
-- (org_id + org_can_write), sem o travamento extra de employees.

create table trainings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  nome text not null,
  carga_horaria numeric,
  instrutor_fornecedor text,
  modalidade text not null check (modalidade in ('ead', 'externo', 'interno', 'misto')),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index trainings_org_id_idx on trainings(org_id);

-- "Aplicabilidade por cargo" (substitui o antigo "exigido" do protótipo) —
-- célula marcada da matriz linhas=cargos, colunas=treinamentos.
create table training_applicability (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings(id) on delete cascade,
  job_position_id uuid not null references job_positions(id) on delete cascade,
  unique (training_id, job_position_id)
);

create index training_applicability_training_idx on training_applicability(training_id);
create index training_applicability_position_idx on training_applicability(job_position_id);

create table training_sessions (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references trainings(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  data_planejada date not null,
  data_realizacao date,
  status text not null default 'planejada' check (status in ('planejada', 'realizada', 'cancelada')),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid()
);

create index training_sessions_org_id_idx on training_sessions(org_id);
create index training_sessions_training_idx on training_sessions(training_id);

create table training_participants (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references training_sessions(id) on delete cascade,
  employee_id uuid not null references employees(id),
  presente boolean not null default false,
  -- Avaliação de eficácia POR PARTICIPANTE (não por sessão inteira).
  eficacia text check (eficacia in ('eficaz', 'nao_eficaz')),
  eficacia_avaliada_em timestamptz,
  unique (training_session_id, employee_id)
);

create index training_participants_session_idx on training_participants(training_session_id);
create index training_participants_employee_idx on training_participants(employee_id);

create table awareness_publications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  tipo text not null check (tipo in ('informe', 'perguntas_respostas')),
  titulo text not null,
  conteudo text not null,
  -- Array de roles (user_organizations.role) ou 'todos' — nunca os 2
  -- sistemas de "perfil" (RH vs. permissão) se misturam em outro lugar
  -- deste módulo, mas aqui é intencional: público-alvo de comunicado É
  -- sobre quem vê a publicação, que faz sentido segmentar por perfil de
  -- acesso mesmo.
  publico_alvo text[] not null default array['todos'],
  published_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index awareness_publications_org_id_idx on awareness_publications(org_id);

create table awareness_quiz_options (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references awareness_publications(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  item_order int not null default 0
);

create index awareness_quiz_options_publication_idx on awareness_quiz_options(publication_id, item_order);

create table awareness_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references awareness_publications(id) on delete cascade,
  employee_id uuid not null references employees(id),
  acknowledged_at timestamptz not null default now(),
  unique (publication_id, employee_id)
);

create index awareness_acknowledgments_publication_idx on awareness_acknowledgments(publication_id);
create index awareness_acknowledgments_employee_idx on awareness_acknowledgments(employee_id);
