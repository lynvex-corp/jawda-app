-- Trilha de auditoria (activity_log), conforme docs/MODELO_DE_DADOS.md.
-- Não foi criada na aba de fundação (ABA 3) — é criada aqui porque o módulo
-- de NC (primeiro módulo de negócio a virar real) já depende dela para
-- registrar "criou/atualizou/cancelou NC" via trigger.

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid not null references profiles(id),
  actor_type text not null default 'user' check (actor_type in ('user','ai','system','internal_staff')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_code text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_org_created_idx on activity_log(org_id, created_at desc);
create index activity_log_org_entity_idx on activity_log(org_id, entity_type, entity_id);

alter table activity_log enable row level security;

create policy activity_log_select_org
  on activity_log for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Nada escreve aqui diretamente. Toda linha nasce de uma trigger SECURITY
-- DEFINER (dona da tabela, portanto ignora RLS por padrão do Postgres) presa
-- a uma tabela de negócio (ex.: ncs). Bloquear insert/update/delete para
-- authenticated/anon garante que a trilha só registra ações reais capturadas
-- no banco, nunca um payload livre vindo do cliente.
create policy activity_log_no_insert
  on activity_log for insert
  with check (false);

create policy activity_log_no_update
  on activity_log for update
  using (false);

create policy activity_log_no_delete
  on activity_log for delete
  using (false);
