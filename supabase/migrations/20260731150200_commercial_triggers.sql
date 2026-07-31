-- Trilha do módulo Comercial. Não usa `activity_log` (org_id not null,
-- FK para organizations) porque oportunidade e proposta não têm empresa
-- até o fechamento — mesma razão pela qual internal_access_log já existia
-- como log separado, staff-only, fora do activity_log por-organização
-- (seção 4 do Guia). commercial_activity_log segue o mesmo espírito.

create table commercial_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references internal_staff(id),
  action text not null,
  entity_type text not null check (entity_type in ('opportunity', 'proposal')),
  entity_id uuid not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index commercial_activity_log_entity_idx on commercial_activity_log(entity_type, entity_id);

alter table commercial_activity_log enable row level security;

create policy commercial_activity_log_select_staff
  on commercial_activity_log for select
  using (public.is_internal_staff());

-- Mesmo padrão de activity_log: nada escreve aqui diretamente, só triggers
-- SECURITY DEFINER presas às tabelas de negócio.
create policy commercial_activity_log_no_insert
  on commercial_activity_log for insert
  with check (false);

create policy commercial_activity_log_no_update
  on commercial_activity_log for update
  using (false);

create policy commercial_activity_log_no_delete
  on commercial_activity_log for delete
  using (false);

grant select on commercial_activity_log to authenticated;
grant all on commercial_activity_log to service_role;

-- =========================================================================
-- Oportunidades: fecha o estágio anterior automaticamente (o client nunca
-- seta stage_changed_at manualmente — mesma lógica de "cálculo em trigger,
-- não confiado do client" usada em SLA de NC) + trilha de criação/estágio/perda
-- =========================================================================

create or replace function public.set_opportunity_stage_changed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or old.stage is distinct from new.stage then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger opportunities_set_stage_changed_at
  before insert or update on opportunities
  for each row execute function public.set_opportunity_stage_changed_at();

create or replace function public.log_opportunity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    insert into commercial_activity_log (actor_id, action, entity_type, entity_id, detail)
    values (v_actor, 'criou_oportunidade', 'opportunity', new.id,
      jsonb_build_object('company_name_draft', new.company_name_draft, 'stage', new.stage));
  elsif tg_op = 'UPDATE' and old.stage is distinct from new.stage then
    if new.stage = 'fechado_perdido' then
      insert into commercial_activity_log (actor_id, action, entity_type, entity_id, detail)
      values (v_actor, 'perdeu_oportunidade', 'opportunity', new.id,
        jsonb_build_object('estagio_anterior', old.stage, 'motivo', new.lost_reason));
    else
      insert into commercial_activity_log (actor_id, action, entity_type, entity_id, detail)
      values (v_actor, 'mudou_estagio', 'opportunity', new.id,
        jsonb_build_object('estagio_anterior', old.stage, 'estagio_novo', new.stage));
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger opportunities_activity_log
  after insert or update on opportunities
  for each row execute function public.log_opportunity_change();

-- =========================================================================
-- Propostas: trilha de criação e envio
-- =========================================================================

create or replace function public.log_proposal_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    insert into commercial_activity_log (actor_id, action, entity_type, entity_id, detail)
    values (v_actor, 'criou_proposta', 'proposal', new.id,
      jsonb_build_object('opportunity_id', new.opportunity_id, 'total_monthly_value', new.total_monthly_value));
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'enviada' then
    insert into commercial_activity_log (actor_id, action, entity_type, entity_id, detail)
    values (v_actor, 'enviou_proposta', 'proposal', new.id,
      jsonb_build_object('opportunity_id', new.opportunity_id, 'number', new.number));
  end if;

  return coalesce(new, old);
end;
$$;

create trigger proposals_activity_log
  after insert or update on proposals
  for each row execute function public.log_proposal_change();
