-- Módulo Processos e Operação (Parte 2) — Comunicações.
--
-- communication_processes é o "plano" (o que se comunica, com quem, como,
-- quando) — mapeia as seções Interna/Externa do protótipo original.
-- communications é o disparo real de uma comunicação (pode ou não vir de
-- um processo cadastrado). communication_reads registra quem confirmou
-- ciência de uma comunicação recebida.

create table communication_processes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  type text not null check (type in ('interna', 'externa')),
  description text not null,
  form text not null check (form in (
    'aplicativo_mensagem', 'comunicacao_impressa', 'comunicacao_informal',
    'comunicacao_virtual', 'dialogo_seguranca', 'email', 'quadro_aviso',
    'reuniao_analise_critica', 'reuniao_rotina'
  )),
  communicator_id uuid references profiles(id),
  when_type text not null check (when_type in ('data_especifica', 'sob_demanda')),
  scheduled_date date,
  target_profiles jsonb not null default '[]'::jsonb,
  -- Gerado pelo trigger communication_processes_generate_code
  -- (20260825110200) — sequencial por tipo, nunca escolhido pelo client.
  code text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (org_id, code),
  check (when_type <> 'data_especifica' or scheduled_date is not null)
);

create index communication_processes_org_id_idx on communication_processes(org_id);

-- Disparo real de comunicação. communicator_id é forçado para o usuário
-- logado pelo trigger (20260825110200) — nunca aceito do client, por
-- especificação ("automático do usuário logado").
create table communications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  communication_process_id uuid references communication_processes(id),
  type text not null check (type in ('interna', 'externa')),
  description text not null,
  communicator_id uuid not null references profiles(id) default auth.uid(),
  scheduled_datetime timestamptz,
  is_immediate boolean not null default false,
  external_name text,
  external_emails text[],
  target_profiles jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index communications_org_id_idx on communications(org_id);
create index communications_process_idx on communications(communication_process_id);

create table communication_reads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  communication_id uuid not null references communications(id) on delete cascade,
  recipient_user_id uuid not null references profiles(id) default auth.uid(),
  acknowledged_at timestamptz,
  unique (communication_id, recipient_user_id)
);

create index communication_reads_org_id_idx on communication_reads(org_id);
create index communication_reads_communication_idx on communication_reads(communication_id);
