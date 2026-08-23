-- Trilha de auditoria + gancho NC→SWOT + RPCs de formalização/versionamento
-- para a Análise de Cenário (SWOT).

-- =========================================================================
-- Trilha de auditoria
-- =========================================================================

create or replace function public.log_swot_analysis_activity()
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
    values (new.org_id, v_actor, 'criou', 'swot_analysis', new.id, jsonb_build_object('status', new.status));
  elsif tg_op = 'UPDATE' and new.status = 'formalizada' and old.status = 'rascunho' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (
      new.org_id, v_actor, 'formalizou', 'swot_analysis', new.id,
      jsonb_build_object('version_label', new.version_label)
    );
  end if;

  return coalesce(new, old);
end;
$$;

create trigger swot_analyses_activity_log
  after insert or update on swot_analyses
  for each row execute function public.log_swot_analysis_activity();

create or replace function public.log_swot_card_activity()
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
    values (
      new.org_id, v_actor, 'criou', 'swot_card', new.id,
      jsonb_build_object('quadrant', new.quadrant, 'source_nc_id', new.source_nc_id)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.quadrant is distinct from old.quadrant then
      insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
      values (
        new.org_id, v_actor, 'reclassificou', 'swot_card', new.id,
        jsonb_build_object('de', old.quadrant, 'para', new.quadrant)
      );
    end if;
    if new.generated_action_plan_id is not null and old.generated_action_plan_id is null then
      insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
      values (
        new.org_id, v_actor, 'gerou_plano_de_acao', 'swot_card', new.id,
        jsonb_build_object('action_plan_id', new.generated_action_plan_id)
      );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger swot_cards_activity_log
  after insert or update on swot_cards
  for each row execute function public.log_swot_card_activity();

-- =========================================================================
-- Gancho NC → SWOT (Parte 1 do prompt): quando uma NC é marcada como
-- ameaça/fraqueza (ncs.swot_forwarded, já gravado pelo wizard —
-- src/components/nao-conformidades/nova-wizard.tsx), cria um swot_card em
-- 'nao_classificado' no rascunho ATUAL da organização (criando o rascunho
-- se não existir nenhum). NÃO insere em activity_log manualmente aqui —
-- o insert em swot_cards abaixo já dispara swot_cards_activity_log
-- (seção 21.6 do Guia: nunca duplicar o que o trigger já cobre).
create or replace function public.forward_nc_to_swot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_id uuid;
begin
  -- Só processa quando swot_forwarded está (ou passou a estar) true. Em
  -- UPDATE, se já era true antes, o card já foi criado numa passada
  -- anterior — não duplica.
  if new.swot_forwarded is not true then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.swot_forwarded is true then
    return new;
  end if;

  select id into v_draft_id
    from swot_analyses
    where org_id = new.org_id and status = 'rascunho';

  if v_draft_id is null then
    insert into swot_analyses (org_id, status, created_by)
    values (new.org_id, 'rascunho', new.created_by)
    returning id into v_draft_id;
  end if;

  insert into swot_cards (org_id, swot_analysis_id, quadrant, description, source_nc_id, created_by)
  values (new.org_id, v_draft_id, 'nao_classificado', new.description, new.id, new.created_by);

  return new;
end;
$$;

create trigger ncs_forward_to_swot
  after insert or update on ncs
  for each row
  when (new.swot_forwarded is true)
  execute function public.forward_nc_to_swot();

-- =========================================================================
-- RPCs de formalização e versionamento (padrão 21.5 do Guia — RPC de
-- fechamento de vigência em vez de UPDATE/INSERT livre pelo cliente).
-- security invoker: roda com o privilégio do usuário chamador, respeitando
-- RLS normalmente — mesmo padrão de update_indicator_target.
-- =========================================================================

create or replace function public.formalize_swot_analysis(
  p_analysis_id uuid,
  p_version_label text
)
returns swot_analyses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result swot_analyses;
begin
  if p_version_label is null or btrim(p_version_label) = '' then
    raise exception 'Informe o rótulo da versão para formalizar';
  end if;

  update swot_analyses
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

create or replace function public.start_new_swot_version()
returns swot_analyses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid := (auth.jwt() ->> 'org_id')::uuid;
  v_last_formalized_id uuid;
  v_new_id uuid;
  v_result swot_analyses;
begin
  if exists (select 1 from swot_analyses where org_id = v_org_id and status = 'rascunho') then
    raise exception 'Já existe um rascunho aberto. Formalize-o antes de iniciar uma nova versão.';
  end if;

  select id into v_last_formalized_id
    from swot_analyses
    where org_id = v_org_id and status = 'formalizada'
    order by formalized_at desc
    limit 1;

  insert into swot_analyses (org_id, status)
    values (v_org_id, 'rascunho')
    returning id into v_new_id;

  -- Copia os cards da última versão formalizada (Parte 1 do prompt).
  if v_last_formalized_id is not null then
    insert into swot_cards (org_id, swot_analysis_id, quadrant, category, description, source_nc_id)
    select org_id, v_new_id, quadrant, category, description, source_nc_id
    from swot_cards
    where swot_analysis_id = v_last_formalized_id;
  end if;

  select * into v_result from swot_analyses where id = v_new_id;
  return v_result;
end;
$$;
