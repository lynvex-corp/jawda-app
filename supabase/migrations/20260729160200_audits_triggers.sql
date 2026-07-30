-- Geração de código, guarda "só interna" e trilha de auditoria do módulo
-- de Auditorias (ABA 6). Mesmo espírito de 20260729140300_ncs_triggers.sql
-- e 20260729150200_action_plans_triggers.sql: regra de negócio decidida no
-- banco, não confiada só ao TypeScript (skill jawda-migrations, regra 4).

-- Código AUD_[SEQ]_[ANO] — sequencial GERAL por organização e ano (mesmo
-- padrão de ncs/action_plans), não separado por tipo interna/externa.
create or replace function public.set_audit_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
begin
  insert into audit_code_counters (org_id, year, next_seq)
  values (new.org_id, v_year, 2)
  on conflict (org_id, year) do update set next_seq = audit_code_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  new.code := format('AUD_%s_%s', lpad(v_seq::text, 3, '0'), v_year);
  return new;
end;
$$;

create trigger audits_before_insert
  before insert on audits
  for each row execute function public.set_audit_code();

-- Guarda "só existe para auditoria interna": audit_plan_items,
-- audit_checklist_items, audit_findings e audit_reports pendem de
-- audits.type='interna'. audit_auditors fica de fora — auditor externo
-- (is_internal=false) é o caso normal da casca leve. Não dá para expressar
-- isso num CHECK simples (CHECK não enxerga outra tabela), por isso é
-- trigger — a mesma regra que a UI já aplica (esconder as abas quando
-- tipo=Externa), replicada no banco para não depender só do front.
create or replace function public.enforce_audit_child_requires_interna()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  select type into v_type from audits where id = new.audit_id;
  if v_type <> 'interna' then
    raise exception 'Plano, checklist, apontamentos e relatório só existem para auditoria interna (audit_id=%, type=%)', new.audit_id, v_type;
  end if;
  return new;
end;
$$;

create trigger audit_plan_items_require_interna
  before insert on audit_plan_items
  for each row execute function public.enforce_audit_child_requires_interna();

create trigger audit_checklist_items_require_interna
  before insert on audit_checklist_items
  for each row execute function public.enforce_audit_child_requires_interna();

create trigger audit_findings_require_interna
  before insert on audit_findings
  for each row execute function public.enforce_audit_child_requires_interna();

create trigger audit_reports_require_interna
  before insert on audit_reports
  for each row execute function public.enforce_audit_child_requires_interna();

-- Código do apontamento — sequencial POR AUDITORIA (audit_id), não por
-- org/ano. Formato TIPO-SEQ (ex.: "NCM-01"), já que o findings.type
-- (OPM/NCS/NCM/NCC) é a informação mais relevante pra quem lê a lista.
create or replace function public.set_audit_finding_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into audit_finding_code_counters (audit_id, next_seq)
  values (new.audit_id, 2)
  on conflict (audit_id) do update set next_seq = audit_finding_code_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  new.code := format('%s-%s', new.type, lpad(v_seq::text, 2, '0'));
  return new;
end;
$$;

create trigger audit_findings_before_insert
  before insert on audit_findings
  for each row execute function public.set_audit_finding_code();

-- Trilha de auditoria (activity_log). auth.uid() nulo (seed/migração
-- rodando como service role) não gera log, igual ncs/action_plans.
create or replace function public.log_audit_activity()
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
      new.org_id, v_actor, 'criou', 'audit', new.id, new.code,
      jsonb_build_object('type', new.type, 'status', new.status)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    v_action := case new.status
      when 'em_andamento' then 'iniciou'
      when 'concluida' then 'concluiu'
      when 'cancelada' then 'cancelou'
      else 'atualizou'
    end;
    v_detail := case when new.status = 'cancelada'
      then jsonb_build_object('motivo', new.cancel_reason)
      else jsonb_build_object('status_anterior', old.status, 'status_novo', new.status)
    end;
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, v_actor, v_action, 'audit', new.id, new.code, v_detail);
  end if;

  return new;
end;
$$;

create trigger audits_activity_log
  after insert or update on audits
  for each row execute function public.log_audit_activity();

-- Checklist avaliado — loga só quando a classificação muda de fato (não em
-- todo UPDATE, ex. edição de evidence_notes sem reclassificar).
create or replace function public.log_audit_checklist_evaluated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_audit_code text;
begin
  if v_actor is null or new.classification is null
     or old.classification is not distinct from new.classification then
    return new;
  end if;

  select org_id, code into v_org_id, v_audit_code from audits where id = new.audit_id;

  insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
  values (
    v_org_id, v_actor, 'avaliou_item_checklist', 'audit', new.audit_id, v_audit_code,
    jsonb_build_object(
      'requirement_code', new.requirement_code,
      'classification', new.classification
    )
  );
  return new;
end;
$$;

create trigger audit_checklist_items_evaluated_log
  after update on audit_checklist_items
  for each row execute function public.log_audit_checklist_evaluated();

-- Apontamento criado + gancho para NC/PA reais (item 8/9 do prompt da
-- ABA 6). generated_nc_id/generated_action_plan_id nascem null e são
-- preenchidos por UPDATE separado (useEvaluateChecklistItem gera o
-- finding; o botão "Gerar NC"/"Gerar Plano de Ação" faz o UPDATE) — o
-- trigger de UPDATE detecta a transição null -> not null e loga o vínculo.
create or replace function public.log_audit_finding_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_audit_code text;
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  select org_id, code into v_org_id, v_audit_code from audits where id = new.audit_id;

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (
      v_org_id, v_actor, 'criou_apontamento', 'audit', new.audit_id, v_audit_code,
      jsonb_build_object('finding_code', new.code, 'type', new.type)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.generated_nc_id is not null and old.generated_nc_id is null then
      insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
      values (
        v_org_id, v_actor, 'gerou_nc_do_apontamento', 'audit', new.audit_id, v_audit_code,
        jsonb_build_object('finding_code', new.code, 'nc_id', new.generated_nc_id)
      );
    end if;
    if new.generated_action_plan_id is not null and old.generated_action_plan_id is null then
      insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
      values (
        v_org_id, v_actor, 'gerou_plano_do_apontamento', 'audit', new.audit_id, v_audit_code,
        jsonb_build_object('finding_code', new.code, 'action_plan_id', new.generated_action_plan_id)
      );
    end if;
    if old.status is distinct from new.status then
      insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
      values (
        v_org_id, v_actor, 'atualizou_apontamento', 'audit', new.audit_id, v_audit_code,
        jsonb_build_object('finding_code', new.code, 'status_anterior', old.status, 'status_novo', new.status)
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger audit_findings_activity_log
  after insert or update on audit_findings
  for each row execute function public.log_audit_finding_activity();

-- Relatório emitido — loga quando generated_at é preenchido pela primeira
-- vez (o registro pode nascer em rascunho via upsert antes de "emitir").
create or replace function public.log_audit_report_generated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_audit_code text;
begin
  if v_actor is null or new.generated_at is null
     or (tg_op = 'UPDATE' and old.generated_at is not null) then
    return new;
  end if;

  select org_id, code into v_org_id, v_audit_code from audits where id = new.audit_id;

  insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
  values (
    v_org_id, v_actor, 'emitiu_relatorio', 'audit', new.audit_id, v_audit_code,
    jsonb_build_object('recommendation', new.recommendation)
  );
  return new;
end;
$$;

create trigger audit_reports_generated_log
  after insert or update on audit_reports
  for each row execute function public.log_audit_report_generated();
