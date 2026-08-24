-- Módulo Pessoas (Aba 18, sub-aba 1/3) — Cargos e Perfis. Dado mais
-- sensível migrado até agora: inclui ASO (dado de saúde) e documentos
-- pessoais em employee_attachments. Seção 18 do Guia pede régua de
-- segurança mais alta que qualquer módulo anterior — ver
-- 20260825090100 (RLS) para a decisão completa.
--
-- "Cargo" (job_positions) é conceito de RH, não tem nenhuma relação com
-- user_organizations.role (perfil de acesso/permissão). Uma pessoa
-- (employees) pode opcionalmente estar vinculada a um usuário do sistema
-- (linked_user_id) para a visão "vejo só o meu", mas isso não faz dela
-- ganhar ou perder permissão nenhuma — são dois sistemas paralelos.

create table job_positions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  nome text not null,
  requisitos_tecnicos text,
  requisitos_desejaveis text,
  responsabilidades_autoridades text,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index job_positions_org_id_idx on job_positions(org_id);

create table job_position_trainings (
  id uuid primary key default gen_random_uuid(),
  job_position_id uuid not null references job_positions(id) on delete cascade,
  training_name text not null,
  is_required boolean not null default true
);

create index job_position_trainings_position_idx on job_position_trainings(job_position_id);

create table employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  nome text not null,
  matricula text,
  email text,
  admissao date,
  job_position_id uuid references job_positions(id),
  setor text,
  situacao_competencia text not null default 'atende' check (situacao_competencia in (
    'atende', 'atende_parcialmente', 'nao_atende'
  )),
  -- Vínculo opcional com um usuário real do sistema, só para a política de
  -- RLS "vejo só o meu registro" do perfil comum (seção 18 do prompt desta
  -- aba). Não existia antes desta aba — adicionado aqui.
  linked_user_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index employees_org_id_idx on employees(org_id);
create index employees_org_position_idx on employees(org_id, job_position_id);
-- No máximo um registro de funcionário por usuário vinculado (evita
-- ambiguidade na tela de autoatendimento "meu registro").
create unique index employees_linked_user_idx on employees(linked_user_id) where linked_user_id is not null;

create table employee_attachments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  category text not null check (category in (
    'certificado_escolaridade', 'diploma', 'curso_extra', 'aso', 'outros'
  )),
  file_url text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references profiles(id) default auth.uid(),
  source text not null default 'dossie' check (source in ('dossie', 'acao_competencia'))
);

create index employee_attachments_employee_idx on employee_attachments(employee_id);

create table competency_actions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  methodology text not null,
  expected_date date not null,
  completion_date date,
  status text not null default 'aberta' check (status in ('aberta', 'concluida')),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid(),
  check (status <> 'concluida' or completion_date is not null)
);

create index competency_actions_employee_idx on competency_actions(employee_id);

create table lgpd_acceptances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  user_id uuid not null references profiles(id) default auth.uid(),
  accepted_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table awareness_terms_signatures (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  signed_at timestamptz not null default now(),
  valid_until date not null,
  content_snapshot text not null
);

create index awareness_terms_signatures_employee_idx
  on awareness_terms_signatures(employee_id, signed_at desc);
