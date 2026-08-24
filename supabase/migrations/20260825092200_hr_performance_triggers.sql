-- Trilha de auditoria para Avaliação de Desempenho.

create or replace function public.log_performance_evaluation_activity()
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
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'programou_avaliacao', 'performance_evaluation', new.id,
      jsonb_build_object('employee_id', new.employee_id, 'avaliador_user_id', new.avaliador_user_id));
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'atualizou_status_avaliacao', 'performance_evaluation', new.id,
      jsonb_build_object('status_anterior', old.status, 'status_novo', new.status));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger performance_evaluations_activity_log
  after insert or update on performance_evaluations
  for each row execute function public.log_performance_evaluation_activity();

create or replace function public.log_performance_feedback_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;
  select org_id into v_org_id from performance_evaluations where id = new.evaluation_id;
  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (v_org_id, v_actor, 'registrou_devolutiva', 'performance_evaluation', new.evaluation_id, '{}'::jsonb);
  elsif tg_op = 'UPDATE' and new.generated_action_plan_id is not null and old.generated_action_plan_id is null then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (v_org_id, v_actor, 'gerou_plano_de_acao', 'performance_evaluation', new.evaluation_id,
      jsonb_build_object('action_plan_id', new.generated_action_plan_id));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger performance_feedback_activity_log
  after insert or update on performance_feedback
  for each row execute function public.log_performance_feedback_activity();
