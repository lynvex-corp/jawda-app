-- Geração de código (PS-{ano}-{sequencial}), etapas padrão criadas junto
-- com a demanda, recálculo automático do status a partir das etapas, e
-- RPC de entrega (única forma de setar comparison_delivered_vs_requested
-- e status='entregue').

create or replace function public.generate_service_demand_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_next int;
begin
  select coalesce(max(substring(code from '-(\d+)$')::int), 0) + 1 into v_next
  from service_demands
  where org_id = new.org_id and code like 'PS-' || v_year || '-%';

  new.code := 'PS-' || v_year || '-' || lpad(v_next::text, 3, '0');
  return new;
end;
$$;

create trigger service_demands_generate_code
  before insert on service_demands
  for each row execute function public.generate_service_demand_code();

create or replace function public.log_service_demands_activity()
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
  values (new.org_id, v_actor, 'criou', 'service_demands', new.id,
    jsonb_build_object('code', new.code));
  return new;
end;
$$;

create trigger service_demands_activity_log
  after insert on service_demands
  for each row execute function public.log_service_demands_activity();

-- Etapas padrão nascem junto com a demanda ("As etapas padrão do processo
-- são criadas automaticamente e podem ser acompanhadas no card" — texto já
-- presente no protótipo). responsible_id fica nulo (a UI deixa quem
-- assumir cada etapa atribuir depois) — o protótipo distribuía nomes
-- fictícios entre as etapas, o que não existe mais com dados reais.
create or replace function public.create_default_service_demand_stages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into service_demand_stages (org_id, demand_id, stage_name, stage_order)
  select new.org_id, new.id, stage_name, stage_order
  from (values
    ('Análise dos requisitos do cliente', 1),
    ('Viabilidade técnica e comercial', 2),
    ('Programação da execução', 3),
    ('Execução', 4),
    ('Verificação do resultado', 5),
    ('Entrega e aceite', 6)
  ) as defaults(stage_name, stage_order);

  return new;
end;
$$;

create trigger service_demands_create_default_stages
  after insert on service_demands
  for each row execute function public.create_default_service_demand_stages();

-- Recalcula o status da demanda a partir das etapas — nunca setado
-- livremente pelo client (só via avanço de etapa, ou pela RPC de entrega
-- abaixo). Uma vez 'entregue', o status fica congelado (só a RPC de
-- entrega altera comparison_delivered_vs_requested depois disso).
create or replace function public.recompute_service_demand_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demand service_demands;
  v_total int;
  v_concluidas int;
  v_iniciadas int;
  v_new_status text;
begin
  select * into v_demand from service_demands where id = new.demand_id;

  if v_demand.status = 'entregue' then
    return new;
  end if;

  select count(*), count(*) filter (where status = 'concluida'),
    count(*) filter (where status <> 'pendente')
    into v_total, v_concluidas, v_iniciadas
    from service_demand_stages where demand_id = new.demand_id;

  if v_total > 0 and v_concluidas = v_total then
    v_new_status := 'em_verificacao';
  elsif v_iniciadas > 0 then
    v_new_status := 'em_producao';
  else
    v_new_status := 'requisitos_em_analise';
  end if;

  update service_demands set status = v_new_status where id = new.demand_id;
  return new;
end;
$$;

create trigger service_demand_stages_recompute_status
  after insert or update on service_demand_stages
  for each row execute function public.recompute_service_demand_status();

create or replace function public.register_service_demand_delivery(
  p_demand_id uuid,
  p_comparison text
)
returns service_demands
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pending int;
  v_result service_demands;
begin
  if p_comparison is null or btrim(p_comparison) = '' then
    raise exception 'Descreva a comparação entre pedido e entrega';
  end if;

  select count(*) into v_pending
    from service_demand_stages
    where demand_id = p_demand_id and status <> 'concluida';

  if v_pending > 0 then
    raise exception 'Todas as etapas precisam estar concluídas antes de registrar a entrega';
  end if;

  update service_demands
    set status = 'entregue', comparison_delivered_vs_requested = p_comparison
    where id = p_demand_id
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Demanda não encontrada ou sem acesso';
  end if;

  return v_result;
end;
$$;
