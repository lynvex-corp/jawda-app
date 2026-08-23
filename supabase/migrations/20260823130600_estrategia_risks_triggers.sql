-- Geração de código + trilha de auditoria para Riscos e Oportunidades.

create or replace function public.set_risk_opportunity_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into risk_opportunity_code_counters (org_id, next_seq)
  values (new.org_id, 2)
  on conflict (org_id) do update set next_seq = risk_opportunity_code_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  new.code := format('%s-%s', case new.type when 'risco' then 'R' else 'O' end, lpad(v_seq::text, 3, '0'));
  return new;
end;
$$;

create trigger risks_opportunities_before_insert
  before insert on risks_opportunities
  for each row execute function public.set_risk_opportunity_code();

create or replace function public.log_risk_opportunity_activity()
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
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (
      new.org_id, v_actor, 'criou', 'risk_opportunity', new.id, new.code,
      jsonb_build_object('type', new.type, 'area', new.area, 'risk_score', new.risk_score)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.generated_action_plan_id is not null and old.generated_action_plan_id is null then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (
      new.org_id, v_actor, 'gerou_plano_de_acao', 'risk_opportunity', new.id, new.code,
      jsonb_build_object('action_plan_id', new.generated_action_plan_id)
    );
  end if;

  return coalesce(new, old);
end;
$$;

create trigger risks_opportunities_activity_log
  after insert or update on risks_opportunities
  for each row execute function public.log_risk_opportunity_activity();

-- risk_reassessments não tem trigger de log próprio até agora (tabela
-- nova) — inserir aqui não viola a seção 21.6, é exatamente o caso em que
-- a regra permite: a ação (reavaliar) não tem NENHUM trigger cobrindo.
create or replace function public.log_risk_reassessment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_code text;
begin
  if v_actor is null then
    return new;
  end if;

  select org_id, code into v_org_id, v_code from risks_opportunities where id = new.risk_id;

  insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
  values (
    v_org_id, v_actor, 'reavaliou', 'risk_opportunity', new.risk_id, v_code,
    jsonb_build_object('probability', new.probability, 'impact', new.impact)
  );

  return new;
end;
$$;

create trigger risk_reassessments_activity_log
  after insert on risk_reassessments
  for each row execute function public.log_risk_reassessment_activity();
