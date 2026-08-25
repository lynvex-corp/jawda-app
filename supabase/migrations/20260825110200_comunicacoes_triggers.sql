-- Geração de código sequencial por tipo (COM_INT_001, COM_EXT_001...),
-- trava de "comunicador é sempre o usuário logado" e trilha de auditoria.

create or replace function public.generate_communication_process_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := case when new.type = 'interna' then 'COM_INT' else 'COM_EXT' end;
  v_next int;
begin
  select coalesce(max((regexp_match(code, '_(\d+)$'))[1]::int), 0) + 1 into v_next
  from communication_processes
  where org_id = new.org_id and type = new.type;

  new.code := v_prefix || '_' || lpad(v_next::text, 3, '0');
  return new;
end;
$$;

create trigger communication_processes_generate_code
  before insert on communication_processes
  for each row execute function public.generate_communication_process_code();

create or replace function public.log_communication_processes_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return new;
  end if;

  insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
  values (new.org_id, v_actor, 'criou', 'communication_processes', new.id,
    jsonb_build_object('code', new.code));
  return new;
end;
$$;

create trigger communication_processes_activity_log
  after insert on communication_processes
  for each row execute function public.log_communication_processes_activity();

-- communicator_id "automático do usuário logado" (Parte 2 do prompt) —
-- nunca aceito do client, sempre sobrescrito aqui. Comunicação Imediata
-- marca sent_at na hora e ignora qualquer agendamento que tenha vindo
-- junto (a UI já desabilita esses campos quando o toggle está ligado —
-- isto é o reforço do lado do banco).
create or replace function public.enforce_communications_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.communicator_id := auth.uid();

  if new.is_immediate then
    new.sent_at := coalesce(new.sent_at, now());
    new.scheduled_datetime := null;
  end if;

  return new;
end;
$$;

create trigger communications_enforce_rules
  before insert on communications
  for each row execute function public.enforce_communications_rules();

create or replace function public.log_communications_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return new;
  end if;

  insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
  values (new.org_id, v_actor, 'enviou', 'communications', new.id,
    jsonb_build_object('is_immediate', new.is_immediate));
  return new;
end;
$$;

create trigger communications_activity_log
  after insert on communications
  for each row execute function public.log_communications_activity();
