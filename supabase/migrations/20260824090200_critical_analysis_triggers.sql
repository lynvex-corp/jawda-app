-- Trilha de auditoria + regras de negócio + RPCs da Análise Crítica pela
-- Direção.

-- =========================================================================
-- Trava de conteúdo + anulação (mesma lição de
-- 20260823131200_estrategia_scope_fix_immutable_vigente, aplicada desde o
-- início desta vez: nunca deixar um UPDATE mudar o conteúdo de uma ata que
-- já não está em 'programada'/'em_andamento', exceto a transição de
-- anulação em si).
-- =========================================================================

create or replace function public.enforce_critical_analysis_meeting_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- Conteúdo travado assim que a ata sai de rascunho de execução —
  -- 'aguardando_aprovacao'/'concluida'/'anulada' não editam mais os campos
  -- abaixo, exceto a própria mudança de status tratada nos blocos seguintes.
  if old.status in ('aguardando_aprovacao', 'concluida', 'anulada') then
    if new.scheduled_date is distinct from old.scheduled_date
       or new.periodicity is distinct from old.periodicity
       or new.previous_meeting_reference is distinct from old.previous_meeting_reference
       or new.deliberations is distinct from old.deliberations
       or new.start_datetime is distinct from old.start_datetime
       or new.end_datetime is distinct from old.end_datetime
    then
      raise exception 'Esta ata não está mais em execução — não é possível editar o conteúdo';
    end if;
  end if;

  if new.status = 'anulada' and old.status <> 'anulada' then
    if old.status <> 'concluida' then
      raise exception 'Só é possível anular uma ata concluída';
    end if;
    if new.annulment_reason is null or btrim(new.annulment_reason) = '' then
      raise exception 'Informe o motivo da anulação';
    end if;

    select role into v_role
    from user_organizations
    where user_id = auth.uid() and org_id = new.org_id and is_active;

    if v_role is null or v_role <> 'admin' then
      raise exception 'Somente o Administrador do Cliente (Alta Direção) pode anular uma ata';
    end if;

    new.annulled_by := coalesce(new.annulled_by, auth.uid());
    new.annulled_at := coalesce(new.annulled_at, now());
  end if;

  return new;
end;
$$;

create trigger critical_analysis_meetings_enforce_rules
  before update on critical_analysis_meetings
  for each row execute function public.enforce_critical_analysis_meeting_rules();

create or replace function public.log_critical_analysis_meeting_activity()
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
    values (new.org_id, v_actor, 'programou', 'critical_analysis_meeting', new.id,
      jsonb_build_object('scheduled_date', new.scheduled_date, 'periodicity', new.periodicity));
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status <> old.status then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor,
      case new.status
        when 'em_andamento' then 'iniciou_execucao'
        when 'aguardando_aprovacao' then 'enviou_para_aprovacao'
        when 'concluida' then 'concluiu'
        when 'anulada' then 'anulou'
        else 'atualizou'
      end,
      'critical_analysis_meeting', new.id,
      jsonb_build_object('status_anterior', old.status, 'status_novo', new.status,
        'motivo', new.annulment_reason));
  end if;

  return coalesce(new, old);
end;
$$;

create trigger critical_analysis_meetings_activity_log
  after insert or update on critical_analysis_meetings
  for each row execute function public.log_critical_analysis_meeting_activity();

-- =========================================================================
-- Aprovação por participante: só o próprio usuário aprova a própria linha,
-- só enquanto a ata está aguardando aprovação.
-- =========================================================================

create or replace function public.enforce_critical_analysis_participant_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meeting_status text;
begin
  if new.approved is true and old.approved is not true then
    if new.user_id <> auth.uid() then
      raise exception 'Só o próprio participante pode confirmar sua aprovação';
    end if;

    select status into v_meeting_status
    from critical_analysis_meetings where id = new.meeting_id;

    if v_meeting_status <> 'aguardando_aprovacao' then
      raise exception 'A ata só pode ser aprovada enquanto estiver aguardando aprovação';
    end if;

    new.approved_at := coalesce(new.approved_at, now());
  end if;

  return new;
end;
$$;

create trigger critical_analysis_participants_enforce_approval
  before update on critical_analysis_participants
  for each row execute function public.enforce_critical_analysis_participant_approval();

-- Quando todo mundo aprova, a reunião conclui sozinha (regra do prompt
-- desta aba). SECURITY DEFINER para poder atualizar
-- critical_analysis_meetings mesmo que o participante que acabou de
-- aprovar não tenha, por si, permissão de update na tabela de reuniões
-- (aqui tem, por org_can_write, mas o padrão é o mesmo de qualquer
-- trigger que precisa agir além do que o RLS do chamador cobriria).
create or replace function public.check_critical_analysis_conclusion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_all_approved boolean;
begin
  if new.approved is true and old.approved is not true then
    select bool_and(approved) into v_all_approved
    from critical_analysis_participants
    where meeting_id = new.meeting_id;

    if v_all_approved then
      update critical_analysis_meetings
        set status = 'concluida'
        where id = new.meeting_id and status = 'aguardando_aprovacao';
    end if;
  end if;

  return new;
end;
$$;

create trigger critical_analysis_participants_check_conclusion
  after update on critical_analysis_participants
  for each row execute function public.check_critical_analysis_conclusion();

create or replace function public.log_critical_analysis_participant_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
begin
  if v_actor is null or new.approved is not true or old.approved is true then
    return new;
  end if;

  select org_id into v_org_id from critical_analysis_meetings where id = new.meeting_id;

  insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
  values (v_org_id, v_actor, 'aprovou_participacao', 'critical_analysis_meeting', new.meeting_id,
    jsonb_build_object('participant_id', new.id));

  return new;
end;
$$;

create trigger critical_analysis_participants_activity_log
  after update on critical_analysis_participants
  for each row execute function public.log_critical_analysis_participant_activity();

-- =========================================================================
-- Ações de saída: trilha + gancho com Plano de Ação (mesmo padrão de
-- swot_cards/risks_opportunities — seção 21.4 do Guia).
-- =========================================================================

create or replace function public.log_critical_analysis_action_item_activity()
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

  select org_id into v_org_id from critical_analysis_meetings where id = coalesce(new.meeting_id, old.meeting_id);

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (v_org_id, v_actor, 'criou', 'critical_analysis_action_item', new.id,
      jsonb_build_object('type', new.type));
    return new;
  end if;

  if tg_op = 'UPDATE' and new.generated_action_plan_id is not null and old.generated_action_plan_id is null then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (v_org_id, v_actor, 'gerou_plano_de_acao', 'critical_analysis_action_item', new.id,
      jsonb_build_object('action_plan_id', new.generated_action_plan_id));
  end if;

  return coalesce(new, old);
end;
$$;

create trigger critical_analysis_action_items_activity_log
  after insert or update on critical_analysis_action_items
  for each row execute function public.log_critical_analysis_action_item_activity();

-- =========================================================================
-- RPCs
-- =========================================================================

-- "Regra de conclusão" do prompt: só avança pra aguardando_aprovacao
-- quando TODAS as pautas selecionadas têm analyzed_content preenchido.
create or replace function public.submit_critical_analysis_for_approval(p_meeting_id uuid)
returns critical_analysis_meetings
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result critical_analysis_meetings;
begin
  if exists (
    select 1 from critical_analysis_agenda_items
    where meeting_id = p_meeting_id and (analyzed_content is null or btrim(analyzed_content) = '')
  ) then
    raise exception 'Todas as pautas selecionadas precisam ter o conteúdo analisado preenchido';
  end if;

  if not exists (select 1 from critical_analysis_participants where meeting_id = p_meeting_id) then
    raise exception 'Adicione ao menos um participante antes de enviar para aprovação';
  end if;

  update critical_analysis_meetings
    set status = 'aguardando_aprovacao', end_datetime = coalesce(end_datetime, now())
    where id = p_meeting_id and status = 'em_andamento'
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Ata não encontrada, sem acesso, ou não está em andamento';
  end if;

  return v_result;
end;
$$;

create or replace function public.approve_critical_analysis_participation(p_meeting_id uuid)
returns critical_analysis_participants
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result critical_analysis_participants;
begin
  update critical_analysis_participants
    set approved = true
    where meeting_id = p_meeting_id and user_id = auth.uid()
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Você não está na lista de participantes desta ata';
  end if;

  return v_result;
end;
$$;

create or replace function public.annul_critical_analysis(p_meeting_id uuid, p_reason text)
returns critical_analysis_meetings
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result critical_analysis_meetings;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Informe o motivo da anulação';
  end if;

  update critical_analysis_meetings
    set status = 'anulada', annulment_reason = p_reason
    where id = p_meeting_id and status = 'concluida'
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Ata não encontrada, sem acesso, ou não está concluída';
  end if;

  return v_result;
end;
$$;
