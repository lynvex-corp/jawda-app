-- RLS das tabelas de `action_plans` (ABA 5). Mesmo mecanismo de
-- supabase/migrations/20260729140200_ncs_rls.sql: JWT custom claim
-- (auth.jwt() ->> 'org_id'), escopo por unidade via user_has_unit_access()
-- (já existe, criada na migração de RLS de ncs). Sem bypass de time interno
-- Lynvex — tabela de negócio do painel do cliente (seção 4 do Guia).

alter table action_plans enable row level security;

create policy action_plans_select_org
  on action_plans for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

create policy action_plans_insert_org
  on action_plans for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

create policy action_plans_update_org
  on action_plans for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

-- DELETE bloqueado — nada apaga (seção 2 do Guia). Cancelar é update de
-- status para 'cancelado' com cancel_reason obrigatório (constraint na
-- tabela).
create policy action_plans_no_delete
  on action_plans for delete
  using (false);

alter table action_plan_corrective_actions enable row level security;

create policy action_plan_corrective_actions_select_org
  on action_plan_corrective_actions for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

create policy action_plan_corrective_actions_insert_org
  on action_plan_corrective_actions for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

create policy action_plan_corrective_actions_update_org
  on action_plan_corrective_actions for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

create policy action_plan_corrective_actions_no_delete
  on action_plan_corrective_actions for delete
  using (false);

-- Sem unit_id denormalizado aqui (tabela pequena, um nível mais funda) —
-- escopo de unidade checado via join com a ação corretiva dona da
-- verificação.
alter table action_plan_verifications enable row level security;

create policy action_plan_verifications_select_org
  on action_plan_verifications for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and exists (
      select 1 from action_plan_corrective_actions ca
      where ca.id = corrective_action_id and public.user_has_unit_access(ca.unit_id)
    )
  );

create policy action_plan_verifications_insert_org
  on action_plan_verifications for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and exists (
      select 1 from action_plan_corrective_actions ca
      where ca.id = corrective_action_id and public.user_has_unit_access(ca.unit_id)
    )
  );

-- Sem update/delete via API: next_attempt_approved_by/at são preenchidos
-- por trigger SECURITY DEFINER (reagindo à aprovação na ação corretiva),
-- nunca por escrita direta do client — ver
-- enforce_action_plan_next_attempt_approval em
-- 20260729150200_action_plans_triggers.sql.
create policy action_plan_verifications_no_update
  on action_plan_verifications for update
  using (false);

create policy action_plan_verifications_no_delete
  on action_plan_verifications for delete
  using (false);

alter table action_plan_code_counters enable row level security;
