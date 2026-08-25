-- Numeração sequencial de avaliação por fornecedor + trilha de auditoria.
-- Pendência (critério sem anexo/observação, avaliação vencida) e o alerta
-- de "2 avaliações seguidas abaixo da média" são calculados na consulta,
-- não armazenados (regra explícita do prompt) — não há trigger para isso.

create or replace function public.generate_supplier_evaluation_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  select coalesce(max(evaluation_number), 0) + 1 into v_next
  from supplier_evaluations
  where supplier_id = new.supplier_id;

  new.evaluation_number := v_next;
  return new;
end;
$$;

create trigger supplier_evaluations_generate_number
  before insert on supplier_evaluations
  for each row execute function public.generate_supplier_evaluation_number();

create or replace function public.log_suppliers_activity()
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
  values (new.org_id, v_actor, 'criou', 'suppliers', new.id,
    jsonb_build_object('nome_fantasia', new.nome_fantasia));
  return new;
end;
$$;

create trigger suppliers_activity_log
  after insert on suppliers
  for each row execute function public.log_suppliers_activity();

create or replace function public.log_supplier_evaluations_activity()
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
  values (new.org_id, v_actor, 'avaliou', 'supplier_evaluations', new.id,
    jsonb_build_object('supplier_id', new.supplier_id, 'overall_score', new.overall_score));
  return new;
end;
$$;

create trigger supplier_evaluations_activity_log
  after insert on supplier_evaluations
  for each row execute function public.log_supplier_evaluations_activity();
