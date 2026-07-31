-- Provisionamento atômico, trilha e escada de inadimplência do Painel Admin.

-- Gap de fundação: o wizard de provisionamento (item 5 do prompt da ABA 8)
-- pede segmento da empresa, e a seção 16 do Guia fala em "presets de
-- configuração por segmento" — mas organizations nunca ganhou essa coluna.
-- Texto livre (sem CHECK): a lista de segmentos não é fechada no Guia.
alter table organizations add column segment text;

-- Toda organização nova recebe estado de inadimplência 'regular' — sem essa
-- linha, a ficha da empresa não tem o que mostrar na escada (seção 7).
-- Trigger separada da que semeia os 6 objetivos padrão (ABA 7): múltiplas
-- triggers AFTER INSERT na mesma tabela convivem sem conflito no Postgres.
create or replace function public.seed_delinquency_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into delinquency_state (org_id, level) values (new.id, 'regular');
  return new;
end;
$$;

create trigger organizations_seed_delinquency_state
  after insert on organizations
  for each row execute function public.seed_delinquency_state();

-- Provisionamento atômico: cria organização + contrato + módulos + normas +
-- unidades numa transação só (o wizard do admin faz várias escolhas em
-- etapas separadas na tela, mas grava tudo de uma vez ao confirmar — uma
-- falha no meio do caminho não pode deixar organização órfã sem contrato).
-- security invoker: roda com o papel do internal_staff autenticado: RLS
-- normal se aplica em cada insert, e a checagem is_internal_staff() no topo
-- é a segunda trava (defesa em profundidade, RLS já bloquearia sozinha).
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

  insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, entity_code, detail)
  values (v_org_id, auth.uid(), 'internal_staff', 'provisionou', 'organization', v_org_id, p_legal_name,
    jsonb_build_object('plan', p_plan, 'modules', p_modules, 'norms', p_norms));

  return query select v_org_id, v_contract_id;
end;
$$;

grant execute on function public.admin_provision_organization(
  text, text, text, text, text, text, text, text, numeric, text[], text[], text[]
) to authenticated;

-- Registra em internal_access_log toda vez que internal_staff toca o
-- contrato/módulos de uma org específica (seção 4 do Guia: "cada uso do
-- passe que atravessa empresas é registrado com motivo obrigatório"). Motivo
-- é gerado a partir da própria ação (não pede pro staff digitar texto livre
-- a cada clique de switch de módulo — friccionaria demais uma operação
-- rotineira); um campo de motivo livre para acesso deliberado tipo
-- "acessei como o cliente para dar suporte" fica para quando essa função
-- existir (fora do escopo desta aba).
create or replace function public.log_admin_org_access(p_staff_id uuid, p_org_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into internal_access_log (staff_id, org_id, reason) values (p_staff_id, p_org_id, p_reason);
end;
$$;

-- Trilha de ativação/desativação de módulo — o gancho mais crítico desta
-- aba (item 7 do prompt: liga/desliga reflete imediatamente no cliente).
create or replace function public.log_contract_module_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_actor uuid := auth.uid();
  v_action text;
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  select org_id into v_org_id from contracts where id = coalesce(new.contract_id, old.contract_id);

  if tg_op = 'INSERT' then
    v_action := case when new.enabled then 'ativou_modulo' else 'criou_modulo_desativado' end;
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_code, detail)
    values (v_org_id, v_actor, 'internal_staff', v_action, 'contract_module', new.module,
      jsonb_build_object('module', new.module, 'enabled', new.enabled));
  elsif tg_op = 'UPDATE' and old.enabled is distinct from new.enabled then
    v_action := case when new.enabled then 'ativou_modulo' else 'desativou_modulo' end;
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_code, detail)
    values (v_org_id, v_actor, 'internal_staff', v_action, 'contract_module', new.module,
      jsonb_build_object('module', new.module, 'enabled', new.enabled, 'anterior', old.enabled));
    perform public.log_admin_org_access(
      v_actor, v_org_id,
      format('Módulo %s %s', new.module, case when new.enabled then 'ativado' else 'desativado' end)
    );
  end if;

  return coalesce(new, old);
end;
$$;

create trigger contract_modules_activity_log
  after insert or update on contract_modules
  for each row execute function public.log_contract_module_change();

-- Trilha de alteração de contrato (plano, valor, status).
create or replace function public.log_contract_change()
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
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'internal_staff', 'criou_contrato', 'contract', new.id,
      jsonb_build_object('plan', new.plan, 'monthly_value', new.monthly_value, 'status', new.status));
  elsif tg_op = 'UPDATE' then
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'internal_staff', 'alterou_contrato', 'contract', new.id,
      jsonb_build_object(
        'plan_anterior', old.plan, 'plan_novo', new.plan,
        'valor_anterior', old.monthly_value, 'valor_novo', new.monthly_value,
        'status_anterior', old.status, 'status_novo', new.status
      ));
    perform public.log_admin_org_access(v_actor, new.org_id, 'Alteração de contrato');
  end if;

  return coalesce(new, old);
end;
$$;

create trigger contracts_activity_log
  after insert or update on contracts
  for each row execute function public.log_contract_change();
