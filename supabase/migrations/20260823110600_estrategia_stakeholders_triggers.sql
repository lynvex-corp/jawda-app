-- Trilha de auditoria + RPCs de formalização/versionamento para Partes
-- Interessadas — mesmo padrão da Análise de Cenário
-- (20260823110200_estrategia_swot_triggers.sql).

create or replace function public.log_stakeholder_analysis_activity()
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
    values (new.org_id, v_actor, 'criou', 'stakeholder_analysis', new.id, jsonb_build_object('status', new.status));
  elsif tg_op = 'UPDATE' and new.status = 'formalizada' and old.status = 'rascunho' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (
      new.org_id, v_actor, 'formalizou', 'stakeholder_analysis', new.id,
      jsonb_build_object('version_label', new.version_label)
    );
  end if;

  return coalesce(new, old);
end;
$$;

create trigger stakeholder_analyses_activity_log
  after insert or update on stakeholder_analyses
  for each row execute function public.log_stakeholder_analysis_activity();

create or replace function public.formalize_stakeholder_analysis(
  p_analysis_id uuid,
  p_version_label text
)
returns stakeholder_analyses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result stakeholder_analyses;
begin
  if p_version_label is null or btrim(p_version_label) = '' then
    raise exception 'Informe o rótulo da versão para formalizar';
  end if;

  update stakeholder_analyses
    set status = 'formalizada',
        version_label = p_version_label,
        formalized_at = now(),
        formalized_by = auth.uid()
    where id = p_analysis_id and status = 'rascunho'
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Análise não encontrada, sem acesso, ou já formalizada';
  end if;

  return v_result;
end;
$$;

create or replace function public.start_new_stakeholder_version()
returns stakeholder_analyses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid := (auth.jwt() ->> 'org_id')::uuid;
  v_last_formalized_id uuid;
  v_new_id uuid;
  v_result stakeholder_analyses;
begin
  if exists (select 1 from stakeholder_analyses where org_id = v_org_id and status = 'rascunho') then
    raise exception 'Já existe um rascunho aberto. Formalize-o antes de iniciar uma nova versão.';
  end if;

  select id into v_last_formalized_id
    from stakeholder_analyses
    where org_id = v_org_id and status = 'formalizada'
    order by formalized_at desc
    limit 1;

  insert into stakeholder_analyses (org_id, status)
    values (v_org_id, 'rascunho')
    returning id into v_new_id;

  if v_last_formalized_id is not null then
    insert into stakeholders (org_id, stakeholder_analysis_id, nome, requisitos, expectativas)
    select org_id, v_new_id, nome, requisitos, expectativas
    from stakeholders
    where stakeholder_analysis_id = v_last_formalized_id;
  end if;

  select * into v_result from stakeholder_analyses where id = v_new_id;
  return v_result;
end;
$$;
