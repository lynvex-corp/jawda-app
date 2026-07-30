-- Geração de código, cálculo de out_of_target, seed do histórico de meta na
-- criação e trilha de auditoria para o módulo de Indicadores. Mesma
-- filosofia de ncs_triggers.sql: tudo em trigger de banco, não no serviço —
-- o cliente não pode forjar código, sequência ou o "fora da meta".

-- Código IND_[MAN|DER|IMP]_[SEQ]_[ANO]. Sequencial GERAL por org/ano, não
-- separado por fonte (mesmo critério de ncs — seção 10 do Guia).
create or replace function public.set_indicator_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
  v_sigla text;
begin
  v_sigla := case new.source
    when 'manual' then 'MAN'
    when 'derived' then 'DER'
    when 'imported' then 'IMP'
  end;

  insert into indicator_code_counters (org_id, year, next_seq)
  values (new.org_id, v_year, 2)
  on conflict (org_id, year) do update set next_seq = indicator_code_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  new.code := format('IND_%s_%s_%s', v_sigla, lpad(v_seq::text, 3, '0'), v_year);

  return new;
end;
$$;

create trigger indicators_before_insert
  before insert on indicators
  for each row execute function public.set_indicator_code();

-- Todo indicador nasce com uma linha "vigente" (valid_until null) em
-- indicator_target_history, para que a troca de meta futura (RPC
-- update_indicator_target) sempre tenha uma linha aberta pra fechar. Sem
-- isso, a primeira troca de meta não teria o valor "antigo" para arquivar.
create or replace function public.seed_indicator_target_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into indicator_target_history (
    indicator_id, target_value, target_range_min, target_range_max, polarity,
    valid_from, valid_until, changed_by
  ) values (
    new.id, new.target_value, new.target_range_min, new.target_range_max, new.polarity,
    current_date, null, new.created_by
  );
  return new;
end;
$$;

create trigger indicators_seed_target_history
  after insert on indicators
  for each row execute function public.seed_indicator_target_history();

-- Calcula out_of_target a partir da meta VIGENTE do indicador no momento do
-- lançamento (mesmo critério de "SLA calculado no insert" de ncs — não
-- confia em valor calculado no cliente). O CHECK de critical_analysis
-- obrigatória (tabela indicator_measurements) roda depois deste trigger,
-- então já vê o out_of_target correto.
create or replace function public.compute_measurement_out_of_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target numeric;
  v_min numeric;
  v_max numeric;
  v_polarity text;
begin
  select target_value, target_range_min, target_range_max, polarity
    into v_target, v_min, v_max, v_polarity
    from indicators where id = new.indicator_id;

  new.out_of_target := case v_polarity
    when 'lower_is_better' then new.value > v_target
    when 'higher_is_better' then new.value < v_target
    else new.value < coalesce(v_min, v_target) or new.value > coalesce(v_max, v_target)
  end;

  return new;
end;
$$;

create trigger indicator_measurements_before_insert
  before insert on indicator_measurements
  for each row execute function public.compute_measurement_out_of_target();

-- Troca de meta preservando histórico (RPC, não UPDATE direto): fecha a
-- linha vigente em indicator_target_history e abre uma nova, depois
-- atualiza indicators.target_value/range/polarity. security invoker (roda
-- com o papel do usuário autenticado, RLS normal se aplica) — a mudança em
-- si não precisa de bypass, só de fazer os 2 passos numa transação atômica
-- só (o client não conseguiria garantir isso em 2 chamadas separadas).
create or replace function public.update_indicator_target(
  p_indicator_id uuid,
  p_target_value numeric,
  p_polarity text,
  p_target_range_min numeric default null,
  p_target_range_max numeric default null
)
returns indicators
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result indicators;
begin
  update indicator_target_history
    set valid_until = current_date
    where indicator_id = p_indicator_id and valid_until is null;

  insert into indicator_target_history (
    indicator_id, target_value, target_range_min, target_range_max, polarity, valid_from, valid_until
  ) values (
    p_indicator_id, p_target_value, p_target_range_min, p_target_range_max, p_polarity, current_date, null
  );

  update indicators
    set target_value = p_target_value,
        target_range_min = p_target_range_min,
        target_range_max = p_target_range_max,
        polarity = p_polarity
    where id = p_indicator_id
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Indicador não encontrado ou sem acesso';
  end if;

  return v_result;
end;
$$;

grant execute on function public.update_indicator_target(uuid, numeric, text, numeric, numeric) to authenticated;

/* ============================================================
 * Trilha de auditoria (activity_log) — item 9 do prompt da ABA 7
 * ============================================================ */

create or replace function public.log_quality_objective_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- auth.uid() nulo = seed do provisionamento (6 objetivos padrão), sem
  -- ator humano pra registrar — mesmo critério de log_nc_activity.
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, v_actor, 'criou', 'quality_objective', new.id, new.name, '{}'::jsonb);
  elsif tg_op = 'UPDATE' then
    if new.status = 'archived' and old.status <> 'archived' then
      insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
      values (new.org_id, v_actor, 'arquivou', 'quality_objective', new.id, new.name, '{}'::jsonb);
    else
      insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
      values (new.org_id, v_actor, 'atualizou', 'quality_objective', new.id, new.name, '{}'::jsonb);
    end if;
  end if;
  return new;
end;
$$;

create trigger quality_objectives_activity_log
  after insert or update on quality_objectives
  for each row execute function public.log_quality_objective_activity();

create or replace function public.log_indicator_activity()
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
      new.org_id, v_actor, 'criou', 'indicator', new.id, new.code,
      jsonb_build_object('quality_objective_id', new.quality_objective_id, 'source', new.source)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'archived' and old.status <> 'archived' then
      v_action := 'arquivou';
      v_detail := '{}'::jsonb;
    elsif new.target_value is distinct from old.target_value
       or new.target_range_min is distinct from old.target_range_min
       or new.target_range_max is distinct from old.target_range_max
       or new.polarity is distinct from old.polarity then
      v_action := 'meta_alterada';
      v_detail := jsonb_build_object(
        'target_value_anterior', old.target_value, 'target_value_novo', new.target_value,
        'polaridade_anterior', old.polarity, 'polaridade_nova', new.polarity
      );
    else
      v_action := 'atualizou';
      v_detail := '{}'::jsonb;
    end if;

    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, v_actor, v_action, 'indicator', new.id, new.code, v_detail);
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger indicators_activity_log
  after insert or update on indicators
  for each row execute function public.log_indicator_activity();

create or replace function public.log_indicator_measurement_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_code text;
begin
  if v_actor is null then
    return new;
  end if;

  select code into v_code from indicators where id = new.indicator_id;

  insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
  values (
    new.org_id, v_actor, 'lancou_medicao', 'indicator_measurement', new.id, v_code,
    jsonb_build_object('period_reference', new.period_reference, 'value', new.value, 'out_of_target', new.out_of_target)
  );
  return new;
end;
$$;

create trigger indicator_measurements_activity_log
  after insert on indicator_measurements
  for each row execute function public.log_indicator_measurement_activity();

-- Extensão de log_nc_activity (criada em 20260729140300_ncs_triggers.sql):
-- quando a NC nasce com indicator_id preenchido, registra um SEGUNDO evento
-- na trilha do próprio indicador ("NC gerada"), pra aparecer na aba Trilha
-- do indicador sem precisar consultar `ncs` toda vez. CREATE OR REPLACE
-- numa migração nova em vez de editar o arquivo antigo — imutabilidade de
-- migração aplicada (seção de padrões do jawda-migrations).
create or replace function public.log_nc_activity()
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
      new.org_id, v_actor, 'criou', 'nc', new.id, new.code,
      jsonb_build_object('status', new.status, 'severity', new.severity, 'origin', new.origin)
    );

    if new.indicator_id is not null then
      insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
      values (
        new.org_id, v_actor, 'nc_gerada', 'indicator', new.indicator_id,
        (select code from indicators where id = new.indicator_id),
        jsonb_build_object('nc_id', new.id, 'nc_code', new.code)
      );
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'cancelado' and old.status <> 'cancelado' then
      v_action := 'cancelou';
      v_detail := jsonb_build_object('motivo', new.cancel_reason);
    else
      v_action := 'atualizou';
      v_detail := jsonb_build_object('status_anterior', old.status, 'status_novo', new.status);
    end if;
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, v_actor, v_action, 'nc', new.id, new.code, v_detail);
    return new;
  end if;

  return coalesce(new, old);
end;
$$;
