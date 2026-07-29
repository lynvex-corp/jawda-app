-- Geração de código, integridade entre as 3 tabelas, o motor do fluxo de
-- reprovação de eficácia (seção 11 do Guia) e trilha de auditoria para
-- `action_plans`. Tudo em trigger de banco, mesmo espírito de
-- 20260729140300_ncs_triggers.sql: regra de negócio no banco, não no
-- serviço, porque o banco não pode ser contornado por bug ou engenhosidade
-- de client.

/* ============================================================
 * Código PA_[SEQ]_[ANO] — mesmo mecanismo de ncs (contador dedicado,
 * UPSERT atômico).
 * ============================================================ */

create or replace function public.set_action_plan_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
  v_prefix text := 'PA';
begin
  insert into action_plan_code_counters (org_id, year, next_seq)
  values (new.org_id, v_year, 2)
  on conflict (org_id, year) do update set next_seq = action_plan_code_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  new.code := format('%s_%s_%s', v_prefix, lpad(v_seq::text, 3, '0'), v_year);
  return new;
end;
$$;

create trigger action_plans_before_insert
  before insert on action_plans
  for each row execute function public.set_action_plan_code();

-- Plano vinculado a uma NC entra em tratativa assim que existe — a NC "fica
-- em tratativa enquanto houver ação sem aprovação de eficácia" (seção 11).
-- Só avança 'aberto'/'em_analise' -> 'em_tratativa'; nunca regride um
-- status mais avançado (encerrado/cancelado) de volta.
create or replace function public.sync_nc_status_on_action_plan_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nc_id is not null then
    update ncs set status = 'em_tratativa'
    where id = new.nc_id and status in ('aberto', 'em_analise');
  end if;
  return new;
end;
$$;

create trigger action_plans_sync_nc_status
  after insert on action_plans
  for each row execute function public.sync_nc_status_on_action_plan_created();

/* ============================================================
 * action_plan_corrective_actions — integridade (org_id/unit_id herdados do
 * plano, nunca confiados do client), numeração sequencial e guarda de
 * transição de status.
 * ============================================================ */

create or replace function public.set_corrective_action_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_unit_id uuid;
begin
  select org_id, unit_id into v_org_id, v_unit_id from action_plans where id = new.action_plan_id;
  if v_org_id is null then
    raise exception 'action_plan_id inválido.';
  end if;
  new.org_id := v_org_id;
  new.unit_id := v_unit_id;

  if new.seq is null then
    select coalesce(max(seq), 0) + 1 into new.seq
    from action_plan_corrective_actions
    where action_plan_id = new.action_plan_id;
  end if;

  -- Toda ação com escalonamento (nasceu de uma reprovação) precisa do papel
  -- exigido calculado — mas se quem chamou (a função que trata a
  -- reprovação, abaixo) já mandou explícito, respeita.
  if new.escalation_level > 0 and new.required_approval_role is null then
    new.required_approval_role := case when new.escalation_level <= 1 then 'quality_manager' else 'admin' end;
  end if;

  return new;
end;
$$;

create trigger action_plan_corrective_actions_before_insert
  before insert on action_plan_corrective_actions
  for each row execute function public.set_corrective_action_defaults();

-- Guarda de transição de status + aprovação de escalonamento. Único ponto
-- de UPDATE client-side nesta tabela (o resto das mudanças de status vêm da
-- função handle_effectiveness_verification, chamada pela trigger de
-- action_plan_verifications, que grava direto sem passar pelas mesmas
-- travas porque já é a própria lógica de negócio rodando como dono da
-- tabela).
create or replace function public.guard_corrective_action_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- Aprovação da próxima tentativa (escalonamento hierárquico, seção 11).
  if new.approved_by is not null and old.approved_by is null then
    if old.status <> 'aguardando_aprovacao' then
      raise exception 'Só é possível aprovar uma ação que está aguardando aprovação.';
    end if;

    select role into v_role
    from user_organizations
    where user_id = auth.uid() and org_id = new.org_id and is_active;

    if new.required_approval_role = 'quality_manager' and coalesce(v_role, '') not in ('quality_manager', 'admin') then
      raise exception 'Somente Gestor da Qualidade ou Administrador pode aprovar esta tentativa.';
    end if;
    if new.required_approval_role = 'admin' and coalesce(v_role, '') <> 'admin' then
      raise exception 'Reprovação escalada — somente o Administrador do Cliente pode aprovar esta tentativa.';
    end if;
    if new.approved_by <> auth.uid() then
      raise exception 'approved_by deve ser o usuário autenticado que está aprovando.';
    end if;

    new.approved_at := coalesce(new.approved_at, now());
    new.status := 'planejada';

    update action_plan_verifications
    set next_attempt_approved_by = new.approved_by, next_attempt_approved_at = new.approved_at
    where resulting_action_id = new.id and next_attempt_approved_by is null;

    return new;
  end if;

  -- Pedido de verificação de eficácia: só a partir de planejada/em_execucao.
  if new.status = 'aguardando_verificacao' and old.status <> 'aguardando_verificacao' then
    if old.status not in ('planejada', 'em_execucao') then
      raise exception 'Só é possível solicitar verificação de eficácia a partir de uma ação planejada ou em execução.';
    end if;
    new.executed_at := coalesce(new.executed_at, now());
  end if;

  return new;
end;
$$;

create trigger action_plan_corrective_actions_guard_update
  before update on action_plan_corrective_actions
  for each row execute function public.guard_corrective_action_update();

-- Rollup do status do plano a partir das ações corretivas que ele contém.
-- 'cancelado' nunca é sobrescrito aqui (só via cancelamento explícito do
-- próprio plano). 'atrasado' fica de fora do rollup — quem marca atraso é a
-- rotina de SLA da seção 13 do Guia, que ainda não existe.
create or replace function public.sync_action_plan_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid := coalesce(new.action_plan_id, old.action_plan_id);
  v_any_aprovada boolean;
  v_any_aguardando_verificacao boolean;
  v_any_ativa boolean;
  v_new_status text;
  v_current_status text;
begin
  select status into v_current_status from action_plans where id = v_plan_id;
  if v_current_status = 'cancelado' then
    return coalesce(new, old);
  end if;

  select
    exists (select 1 from action_plan_corrective_actions where action_plan_id = v_plan_id and status = 'aprovada'),
    exists (select 1 from action_plan_corrective_actions where action_plan_id = v_plan_id and status = 'aguardando_verificacao'),
    exists (select 1 from action_plan_corrective_actions where action_plan_id = v_plan_id and status in ('aguardando_aprovacao', 'planejada', 'em_execucao'))
  into v_any_aprovada, v_any_aguardando_verificacao, v_any_ativa;

  v_new_status := case
    when v_any_aprovada then 'concluido'
    when v_any_aguardando_verificacao then 'em_avaliacao'
    when v_any_ativa then 'em_execucao'
    else v_current_status
  end;

  if v_new_status <> v_current_status then
    update action_plans set status = v_new_status where id = v_plan_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger action_plan_corrective_actions_sync_plan_status
  after insert or update on action_plan_corrective_actions
  for each row execute function public.sync_action_plan_status();

/* ============================================================
 * action_plan_verifications — o motor dos 3 caminhos (seção 11).
 * ============================================================ */

create or replace function public.set_verification_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action record;
  v_count int;
begin
  select * into v_action from action_plan_corrective_actions where id = new.corrective_action_id;
  if v_action is null then
    raise exception 'Ação corretiva inválida.';
  end if;
  if v_action.status <> 'aguardando_verificacao' then
    raise exception 'Esta ação corretiva não está aguardando verificação de eficácia.';
  end if;

  select count(*) into v_count
  from action_plan_verifications
  where corrective_action_id = new.corrective_action_id;

  -- Limite de 2 tentativas por ação corretiva individual (seção 11 do
  -- Guia). A exceção "causa errada reinicia a contagem" não precisa de
  -- tratamento aqui — ela nunca reaproveita a mesma linha (sempre nasce uma
  -- ação nova com id novo, contador zerado por construção).
  if v_count >= 2 then
    raise exception 'Esta ação corretiva já atingiu o limite de 2 tentativas de verificação de eficácia.';
  end if;

  new.attempt_number := v_count + 1;
  new.org_id := v_action.org_id;
  if new.verified_by <> auth.uid() then
    raise exception 'verified_by deve ser o usuário autenticado que está verificando.';
  end if;

  return new;
end;
$$;

create trigger action_plan_verifications_before_insert
  before insert on action_plan_verifications
  for each row execute function public.set_verification_attempt();

-- O motor dos 3 caminhos. Roda depois do insert (a linha de verificação já
-- existe com attempt_number definitivo) e decide o que acontece com a ação
-- corretiva:
--   eficaz            -> aprova a ação, sem escalonamento.
--   nao_eficaz + causa_errada -> SEMPRE fecha esta linha e nasce uma nova
--     (reinicia a contagem de tentativas, por ser uma linha nova).
--   nao_eficaz + acao_fraca   -> SEMPRE fecha esta linha e nasce uma nova,
--     mantendo a mesma causa raiz (why_justification).
--   nao_eficaz + nao_executada, 1ª vez nesta linha -> reabre a MESMA linha
--     com novo prazo.
--   nao_eficaz + nao_executada, 2ª vez nesta linha (estourou o limite) ->
--     fecha em definitivo e nasce uma ação nova.
-- Toda ação resultante (nova ou reaberta) nasce em 'aguardando_aprovacao':
-- o escalonamento hierárquico (1ª reprovação -> Gestor da Qualidade, se
-- persistir -> Administrador) precisa liberar antes dela seguir.
create or replace function public.handle_effectiveness_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action record;
  v_new_level int;
  v_required_role text;
  v_new_action_id uuid;
  v_closure_reason text;
begin
  select * into v_action from action_plan_corrective_actions where id = new.corrective_action_id;

  if new.result = 'eficaz' then
    update action_plan_corrective_actions
    set status = 'aprovada', closure_reason = 'eficaz', approved_by = new.verified_by, approved_at = new.verified_at
    where id = new.corrective_action_id;
    return new;
  end if;

  v_new_level := v_action.escalation_level + 1;
  v_required_role := case when v_new_level <= 1 then 'quality_manager' else 'admin' end;

  if new.reason = 'nao_executada' and new.attempt_number < 2 then
    -- Reabre a mesma ação com novo prazo.
    update action_plan_corrective_actions
    set status = 'aguardando_aprovacao',
        escalation_level = v_new_level,
        required_approval_role = v_required_role,
        when_end = new.new_deadline,
        executed_at = null
    where id = new.corrective_action_id;
    v_new_action_id := new.corrective_action_id;
  else
    v_closure_reason := case
      when new.reason = 'causa_errada' then 'causa_errada'
      when new.reason = 'acao_fraca' then 'acao_fraca'
      else 'reprovada_definitiva' -- nao_executada, 2ª vez na mesma linha
    end;

    update action_plan_corrective_actions
    set status = 'encerrada', closure_reason = v_closure_reason
    where id = new.corrective_action_id;

    insert into action_plan_corrective_actions (
      action_plan_id, parent_action_id, restart_reason, escalation_level, required_approval_role,
      what_description, why_justification, where_location, who_responsible_id, how_method, how_much_cost,
      when_end, status, created_by
    ) values (
      v_action.action_plan_id, v_action.id, new.reason, v_new_level, v_required_role,
      v_action.what_description,
      case when new.reason = 'causa_errada' then new.new_root_cause else v_action.why_justification end,
      v_action.where_location, v_action.who_responsible_id, v_action.how_method, v_action.how_much_cost,
      new.new_deadline, 'aguardando_aprovacao', new.verified_by
    )
    returning id into v_new_action_id;
  end if;

  update action_plan_verifications
  set escalation_level_required = v_new_level, required_approval_role = v_required_role, resulting_action_id = v_new_action_id
  where id = new.id;

  return new;
end;
$$;

create trigger action_plan_verifications_handle
  after insert on action_plan_verifications
  for each row execute function public.handle_effectiveness_verification();

/* ============================================================
 * Trilha de auditoria (activity_log) — "reprovou eficácia com motivo X",
 * "reabriu 5 porquês (motivo: causa errada)", "aprovou nova tentativa
 * (escalado para Gerente da Qualidade)", etc (item 7 do prompt da ABA 5).
 * ============================================================ */

create or replace function public.log_action_plan_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_action text;
  v_detail jsonb;
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (
      new.org_id, v_actor, 'criou', 'action_plan', new.id, new.code,
      jsonb_build_object('status', new.status, 'origin_type', new.origin_type, 'nc_id', new.nc_id)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'cancelado' and old.status <> 'cancelado' then
      v_action := 'cancelou';
      v_detail := jsonb_build_object('motivo', new.cancel_reason);
    elsif new.status <> old.status then
      v_action := 'atualizou';
      v_detail := jsonb_build_object('status_anterior', old.status, 'status_novo', new.status);
    else
      return new;
    end if;
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, v_actor, v_action, 'action_plan', new.id, new.code, v_detail);
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger action_plans_activity_log
  after insert or update on action_plans
  for each row execute function public.log_action_plan_activity();

create or replace function public.log_corrective_action_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_code text;
  v_action text;
  v_detail jsonb;
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  select code into v_code from action_plans where id = coalesce(new.action_plan_id, old.action_plan_id);

  if tg_op = 'INSERT' then
    if new.parent_action_id is null then
      v_action := 'criou ação corretiva';
      v_detail := jsonb_build_object('seq', new.seq, 'oque', new.what_description);
    else
      v_action := 'criou nova ação corretiva';
      v_detail := jsonb_build_object(
        'seq', new.seq, 'motivo', new.restart_reason, 'acao_anterior', new.parent_action_id
      );
    end if;
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, v_actor, v_action, 'action_plan', new.id, v_code, v_detail);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.approved_by is not null and old.approved_by is null then
      v_action := 'aprovou nova tentativa';
      v_detail := jsonb_build_object('escalado_para', new.required_approval_role, 'seq', new.seq);
    elsif new.status = 'aguardando_verificacao' and old.status <> 'aguardando_verificacao' then
      v_action := 'solicitou verificação de eficácia';
      v_detail := jsonb_build_object('seq', new.seq);
    elsif new.status <> old.status then
      v_action := 'atualizou status da ação corretiva';
      v_detail := jsonb_build_object('seq', new.seq, 'status_anterior', old.status, 'status_novo', new.status);
    else
      return new;
    end if;
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, v_actor, v_action, 'action_plan', new.id, v_code, v_detail);
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger action_plan_corrective_actions_activity_log
  after insert or update on action_plan_corrective_actions
  for each row execute function public.log_corrective_action_activity();

create or replace function public.log_verification_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_code text;
  v_seq int;
begin
  if v_actor is null then
    return new;
  end if;

  select ap.code, ca.seq into v_code, v_seq
  from action_plan_corrective_actions ca
  join action_plans ap on ap.id = ca.action_plan_id
  where ca.id = new.corrective_action_id;

  if new.result = 'eficaz' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (
      new.org_id, v_actor, 'aprovou eficácia', 'action_plan', new.corrective_action_id, v_code,
      jsonb_build_object('seq', v_seq, 'tentativa', new.attempt_number)
    );
    return new;
  end if;

  insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
  values (
    new.org_id, v_actor, 'reprovou eficácia', 'action_plan', new.corrective_action_id, v_code,
    jsonb_build_object('seq', v_seq, 'tentativa', new.attempt_number, 'motivo', new.reason)
  );

  if new.reason = 'causa_errada' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (
      new.org_id, v_actor, 'reabriu 5 porquês', 'action_plan', new.corrective_action_id, v_code,
      jsonb_build_object('seq', v_seq, 'motivo', 'causa_errada', 'nova_causa', new.new_root_cause)
    );
  end if;

  return new;
end;
$$;

create trigger action_plan_verifications_activity_log
  after insert on action_plan_verifications
  for each row execute function public.log_verification_activity();
