-- Mesmo bug de novo, achado na mesma rodada de teste E2E: convert_opportunity_to_client
-- (security invoker) tinha um insert direto em commercial_activity_log, que
-- só aceita escrita de função/trigger SECURITY DEFINER (policy
-- commercial_activity_log_no_insert using (false), sem GRANT de insert para
-- authenticated — mesmo padrão de activity_log, seção 21.1 do Guia).

create or replace function public.log_commercial_activity(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_detail jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into commercial_activity_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_detail);
end;
$$;

create or replace function public.convert_opportunity_to_client(
  p_opportunity_id uuid,
  p_legal_name text,
  p_trade_name text,
  p_cnpj text,
  p_segment text,
  p_plan text,
  p_billing_cycle text,
  p_monthly_value numeric,
  p_modules text[],
  p_norms text[]
)
returns table (org_id uuid, contract_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_contract_id uuid;
begin
  if not public.is_commercial_staff() then
    raise exception 'Apenas comercial ou super_admin pode converter oportunidade em cliente';
  end if;

  select p.org_id, p.contract_id into v_org_id, v_contract_id
  from public.admin_provision_organization(
    p_legal_name, p_trade_name, p_cnpj, p_segment, null, null,
    p_plan, p_billing_cycle, p_monthly_value, p_modules, p_norms,
    array['Matriz'], 'em_onboarding'
  ) p;

  update opportunities
  set stage = 'fechado_ganho', generated_org_id = v_org_id
  where id = p_opportunity_id;

  perform public.log_commercial_conversion(v_org_id, p_opportunity_id);

  perform public.log_commercial_activity(
    'converteu_em_cliente', 'opportunity', p_opportunity_id,
    jsonb_build_object('generated_org_id', v_org_id)
  );

  return query select v_org_id, v_contract_id;
end;
$$;
