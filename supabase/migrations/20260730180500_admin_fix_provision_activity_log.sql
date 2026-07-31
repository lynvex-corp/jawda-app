-- Corrige bug encontrado no teste de integração: admin_provision_organization
-- (security invoker) tinha um `insert into activity_log` direto no final, mas
-- activity_log só aceita escrita de trigger SECURITY DEFINER (política
-- activity_log_no_insert using (false), e authenticated só tem GRANT de
-- SELECT nessa tabela — nunca teve INSERT, de propósito, ver
-- 20260729140000_activity_log.sql). O insert direto sempre falhava com
-- "permission denied for table activity_log", derrubando o provisionamento
-- inteiro.
--
-- Não faz falta de verdade: a criação de `contracts` e de cada linha de
-- `contract_modules` já dispara log_contract_change / log_contract_module_change
-- (ambas SECURITY DEFINER, criadas na mesma migração), que registram
-- "criou_contrato" e "ativou_modulo" automaticamente. O insert redundante é
-- só removido aqui — nenhuma trilha nova é perdida.
create or replace function public.admin_provision_organization(
  p_legal_name text,
  p_trade_name text,
  p_cnpj text,
  p_segment text,
  p_logo_url text,
  p_brand_color text,
  p_plan text,
  p_billing_cycle text,
  p_monthly_value numeric,
  p_modules text[],
  p_norms text[],
  p_unit_names text[]
)
returns table (org_id uuid, contract_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_contract_id uuid;
  v_module text;
  v_norm text;
  v_unit text;
begin
  if not public.is_internal_staff() then
    raise exception 'Apenas a equipe interna Lynvex pode provisionar organizações';
  end if;

  insert into organizations (legal_name, trade_name, cnpj, segment, logo_url, brand_color, status)
  values (p_legal_name, p_trade_name, p_cnpj, p_segment, p_logo_url, p_brand_color, 'active')
  returning id into v_org_id;

  insert into contracts (org_id, plan, billing_cycle, monthly_value, start_date, status, created_by)
  values (v_org_id, p_plan, p_billing_cycle, p_monthly_value, current_date, 'active', auth.uid())
  returning id into v_contract_id;

  foreach v_module in array p_modules loop
    insert into contract_modules (contract_id, module, enabled, activated_at)
    values (v_contract_id, v_module, true, now());
  end loop;

  foreach v_norm in array p_norms loop
    insert into contract_norms (contract_id, norm, enabled)
    values (v_contract_id, v_norm, true);
  end loop;

  foreach v_unit in array p_unit_names loop
    insert into units (org_id, name, status)
    values (v_org_id, v_unit, 'active');
  end loop;

  perform public.log_admin_org_access(auth.uid(), v_org_id, 'Provisionamento de nova organização');

  return query select v_org_id, v_contract_id;
end;
$$;
