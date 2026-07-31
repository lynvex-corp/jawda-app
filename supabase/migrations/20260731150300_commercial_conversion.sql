-- Gancho crítico do módulo Comercial: fechar oportunidade converte em
-- cliente real, reusando admin_provision_organization (ABA 8) em vez de
-- recriar a lógica de provisionamento.

-- 'em_onboarding' nasce aqui: organização convertida do funil não pode
-- nascer 'active' (a Aba 13, ainda não construída, é quem decide quando
-- ela sai do onboarding). O check original (fundação, ABA 3) não prevía
-- esse status — estendido, não substituído, as 5 opções antigas continuam
-- válidas para toda organização provisionada fora do funil comercial.
alter table organizations drop constraint organizations_status_check;
alter table organizations add constraint organizations_status_check
  check (status in ('active', 'aware', 'read_only', 'blocked', 'terminated', 'em_onboarding'));

-- admin_provision_organization ganha p_status (default 'active', preserva
-- todo comportamento existente do wizard de Nova Empresa da ABA 8) em vez
-- de duplicar a função só para o caminho do funil comercial. DROP + CREATE
-- porque adicionar parâmetro muda a lista de argumentos — CREATE OR REPLACE
-- não cobre esse caso, mesmo com default no novo parâmetro.
drop function if exists public.admin_provision_organization(
  text, text, text, text, text, text, text, text, numeric, text[], text[], text[]
);

create function public.admin_provision_organization(
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
  p_unit_names text[],
  p_status text default 'active'
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
  values (p_legal_name, p_trade_name, p_cnpj, p_segment, p_logo_url, p_brand_color, p_status)
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

  insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, entity_code, detail)
  values (v_org_id, auth.uid(), 'internal_staff', 'provisionou', 'organization', v_org_id, p_legal_name,
    jsonb_build_object('plan', p_plan, 'modules', p_modules, 'norms', p_norms, 'status', p_status));

  return query select v_org_id, v_contract_id;
end;
$$;

grant execute on function public.admin_provision_organization(
  text, text, text, text, text, text, text, text, numeric, text[], text[], text[], text
) to authenticated;

-- activity_log só aceita insert de trigger SECURITY DEFINER (mesmo motivo
-- documentado em 20260730180500) — helper dedicado em vez de repetir o
-- insert direto que já quebrou uma vez.
create or replace function public.log_commercial_conversion(p_org_id uuid, p_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
  values (p_org_id, auth.uid(), 'internal_staff', 'convertido_de_oportunidade', 'opportunity', p_opportunity_id,
    jsonb_build_object('opportunity_id', p_opportunity_id));
end;
$$;

-- Converte oportunidade fechada em cliente real. security invoker (RLS +
-- is_commercial_staff() como segunda trava, defesa em profundidade — mesmo
-- padrão de admin_provision_organization).
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

  insert into commercial_activity_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), 'converteu_em_cliente', 'opportunity', p_opportunity_id,
    jsonb_build_object('generated_org_id', v_org_id));

  return query select v_org_id, v_contract_id;
end;
$$;

grant execute on function public.convert_opportunity_to_client(
  uuid, text, text, text, text, text, text, numeric, text[], text[]
) to authenticated;
