-- Trilha de auditoria + regra de opções do quiz (até 3, uma correta) para
-- Gestão de Aprendizagem.

create or replace function public.log_training_activity()
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
    values (new.org_id, v_actor, 'criou', 'training', new.id, jsonb_build_object('nome', new.nome));
  elsif tg_op = 'UPDATE' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'atualizou', 'training', new.id, jsonb_build_object('nome', new.nome));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trainings_activity_log
  after insert or update on trainings
  for each row execute function public.log_training_activity();

create or replace function public.log_training_session_activity()
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
    values (new.org_id, v_actor, 'programou_turma', 'training_session', new.id,
      jsonb_build_object('training_id', new.training_id, 'data_planejada', new.data_planejada));
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'atualizou_status_turma', 'training_session', new.id,
      jsonb_build_object('status_anterior', old.status, 'status_novo', new.status));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger training_sessions_activity_log
  after insert or update on training_sessions
  for each row execute function public.log_training_session_activity();

-- Avaliação de eficácia por participante: preenche eficacia_avaliada_em
-- automaticamente (não confia em valor vindo do client) e loga.
create or replace function public.log_training_participant_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
begin
  if new.eficacia is not null and old.eficacia is null then
    new.eficacia_avaliada_em := now();
  end if;

  if v_actor is null then
    return new;
  end if;

  if new.eficacia is distinct from old.eficacia and new.eficacia is not null then
    select org_id into v_org_id from training_sessions where id = new.training_session_id;
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (v_org_id, v_actor, 'avaliou_eficacia', 'training_participant', new.id,
      jsonb_build_object('employee_id', new.employee_id, 'eficacia', new.eficacia));
  end if;

  return new;
end;
$$;

create trigger training_participants_before_update
  before update on training_participants
  for each row execute function public.log_training_participant_activity();

create or replace function public.log_awareness_publication_activity()
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
  values (new.org_id, v_actor, 'publicou', 'awareness_publication', new.id,
    jsonb_build_object('tipo', new.tipo, 'titulo', new.titulo));
  return new;
end;
$$;

create trigger awareness_publications_activity_log
  after insert on awareness_publications
  for each row execute function public.log_awareness_publication_activity();

-- Regra do prompt: quiz de Perguntas e Respostas tem até 3 opções, uma
-- correta (nunca mais de uma marcada ao mesmo tempo).
create or replace function public.enforce_quiz_option_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if tg_op = 'INSERT' then
    select count(*) into v_count from awareness_quiz_options where publication_id = new.publication_id;
    if v_count >= 3 then
      raise exception 'Cada publicação de Perguntas e Respostas tem no máximo 3 opções';
    end if;
  end if;

  if new.is_correct then
    update awareness_quiz_options
      set is_correct = false
      where publication_id = new.publication_id and id <> new.id and is_correct;
  end if;

  return new;
end;
$$;

create trigger awareness_quiz_options_enforce_rules
  before insert on awareness_quiz_options
  for each row execute function public.enforce_quiz_option_rules();

create or replace function public.log_awareness_acknowledgment_activity()
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
    return new;
  end if;
  select org_id into v_org_id from awareness_publications where id = new.publication_id;
  insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
  values (v_org_id, v_actor, 'confirmou_ciencia', 'awareness_publication', new.publication_id,
    jsonb_build_object('employee_id', new.employee_id));
  return new;
end;
$$;

create trigger awareness_acknowledgments_activity_log
  after insert on awareness_acknowledgments
  for each row execute function public.log_awareness_acknowledgment_activity();
