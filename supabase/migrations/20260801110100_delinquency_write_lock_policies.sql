-- Aplica public.org_can_write(org_id) às políticas de INSERT e UPDATE de
-- toda tabela de negócio do painel do cliente que fica sob o cadeado de
-- inadimplência (seção 7 do Guia). SELECT e DELETE não são tocados aqui:
-- leitura nunca pode ser bloqueada (garantia de exportação, mesmo em
-- 'bloqueado') e DELETE já é `using (false)` para todo mundo, sem exceção.
--
-- Fora desta trava, de propósito:
--   - *_code_counters (nc/action_plan/audit/audit_finding/indicator): RLS
--     ligada sem nenhuma policy — só a trigger SECURITY DEFINER dona da
--     tabela grava, cliente nunca escreve direto (ver comentário em
--     20260730120100_indicators_rls.sql). Nada a travar.
--   - activity_log: sem policy de insert/update para authenticated (regra
--     21.6 do Guia — só trigger grava). Nada a travar.
--   - contracts/contract_modules/contract_norms/plans/invoices/
--     payment_events/delinquency_state: escrita já restrita a
--     internal_staff (20260730180200_admin_rls.sql), que nunca é afetado
--     pela régua — travar aqui seria redundante e arriscaria bloquear o
--     próprio staff sem querer.
--   - onboarding_stages/onboarding_checklist_items/consulting_journey/
--     maturity_level_history: escrita restrita a is_onboarding_staff()
--     (20260801090000_onboarding_tables.sql) — mesmo raciocínio acima.
--   - impersonation_sessions: staff/sistema, não é tabela de negócio do
--     cliente.
--   - support_tickets/support_messages/support_backlog_items: FORA por
--     decisão explícita desta aba — Suporte precisa continuar funcionando
--     em qualquer nível da régua, inclusive 'bloqueado' (o cliente
--     inadimplente ainda precisa poder falar com a Jáwda, inclusive sobre
--     a própria pendência). support_backlog_items é staff-only de todo
--     jeito (is_support_staff()).
--   - Tabelas de commercial_* (funil pré-venda): não têm org_id — vínculo
--     com organização só nasce na conversão em cliente, não existe
--     inadimplência antes disso.

-- =========================================================================
-- ncs
-- =========================================================================
drop policy ncs_insert_org on ncs;
create policy ncs_insert_org
  on ncs for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.org_can_write(org_id)
  );

drop policy ncs_update_org on ncs;
create policy ncs_update_org
  on ncs for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.org_can_write(org_id)
  );

-- =========================================================================
-- action_plans / action_plan_corrective_actions / action_plan_verifications
-- =========================================================================
drop policy action_plans_insert_org on action_plans;
create policy action_plans_insert_org
  on action_plans for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.org_can_write(org_id)
  );

drop policy action_plans_update_org on action_plans;
create policy action_plans_update_org
  on action_plans for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.org_can_write(org_id)
  );

drop policy action_plan_corrective_actions_insert_org on action_plan_corrective_actions;
create policy action_plan_corrective_actions_insert_org
  on action_plan_corrective_actions for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.org_can_write(org_id)
  );

drop policy action_plan_corrective_actions_update_org on action_plan_corrective_actions;
create policy action_plan_corrective_actions_update_org
  on action_plan_corrective_actions for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.org_can_write(org_id)
  );

-- Só INSERT: não existe policy de UPDATE nesta tabela (campos de aprovação
-- são preenchidos por trigger SECURITY DEFINER, nunca por escrita direta
-- do client — ver 20260729150100_action_plans_rls.sql).
drop policy action_plan_verifications_insert_org on action_plan_verifications;
create policy action_plan_verifications_insert_org
  on action_plan_verifications for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and exists (
      select 1 from action_plan_corrective_actions ca
      where ca.id = corrective_action_id and public.user_has_unit_access(ca.unit_id)
    )
    and public.org_can_write(org_id)
  );

-- =========================================================================
-- audits e filhas (audit_auditors, audit_plan_items, audit_checklist_items,
-- audit_findings, audit_reports não têm org_id próprio — resolvido via
-- join com `audits`, mesmo padrão de user_has_audit_access()).
-- =========================================================================
drop policy audits_insert_org on audits;
create policy audits_insert_org
  on audits for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.org_can_write(org_id)
  );

drop policy audits_update_org on audits;
create policy audits_update_org
  on audits for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.org_can_write(org_id)
  );

-- Helper local, mesmo espírito de user_has_audit_access(): resolve org_id
-- da auditoria dona do registro filho pra reusar org_can_write().
create or replace function public.audit_org_can_write(p_audit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.org_can_write(a.org_id) from audits a where a.id = p_audit_id),
    false
  );
$$;

drop policy audit_auditors_insert_org on audit_auditors;
create policy audit_auditors_insert_org
  on audit_auditors for insert
  with check (public.user_has_audit_access(audit_id) and public.audit_org_can_write(audit_id));

drop policy audit_auditors_update_org on audit_auditors;
create policy audit_auditors_update_org
  on audit_auditors for update
  using (public.user_has_audit_access(audit_id) and public.audit_org_can_write(audit_id));

drop policy audit_plan_items_insert_org on audit_plan_items;
create policy audit_plan_items_insert_org
  on audit_plan_items for insert
  with check (public.user_has_audit_access(audit_id) and public.audit_org_can_write(audit_id));

drop policy audit_plan_items_update_org on audit_plan_items;
create policy audit_plan_items_update_org
  on audit_plan_items for update
  using (public.user_has_audit_access(audit_id) and public.audit_org_can_write(audit_id));

drop policy audit_checklist_items_insert_org on audit_checklist_items;
create policy audit_checklist_items_insert_org
  on audit_checklist_items for insert
  with check (public.user_has_audit_access(audit_id) and public.audit_org_can_write(audit_id));

drop policy audit_checklist_items_update_org on audit_checklist_items;
create policy audit_checklist_items_update_org
  on audit_checklist_items for update
  using (public.user_has_audit_access(audit_id) and public.audit_org_can_write(audit_id));

drop policy audit_findings_insert_org on audit_findings;
create policy audit_findings_insert_org
  on audit_findings for insert
  with check (public.user_has_audit_access(audit_id) and public.audit_org_can_write(audit_id));

drop policy audit_findings_update_org on audit_findings;
create policy audit_findings_update_org
  on audit_findings for update
  using (public.user_has_audit_access(audit_id) and public.audit_org_can_write(audit_id));

drop policy audit_reports_insert_org on audit_reports;
create policy audit_reports_insert_org
  on audit_reports for insert
  with check (public.user_has_audit_access(audit_id) and public.audit_org_can_write(audit_id));

drop policy audit_reports_update_org on audit_reports;
create policy audit_reports_update_org
  on audit_reports for update
  using (public.user_has_audit_access(audit_id) and public.audit_org_can_write(audit_id));

-- =========================================================================
-- quality_objectives / indicators / indicator_measurements /
-- critical_analysis_periods
-- =========================================================================
drop policy quality_objectives_insert_org on quality_objectives;
create policy quality_objectives_insert_org
  on quality_objectives for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

drop policy quality_objectives_update_org on quality_objectives;
create policy quality_objectives_update_org
  on quality_objectives for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

drop policy indicators_insert_org on indicators;
create policy indicators_insert_org
  on indicators for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

drop policy indicators_update_org on indicators;
create policy indicators_update_org
  on indicators for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

drop policy indicator_measurements_insert_org on indicator_measurements;
create policy indicator_measurements_insert_org
  on indicator_measurements for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

drop policy indicator_measurements_update_org on indicator_measurements;
create policy indicator_measurements_update_org
  on indicator_measurements for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

-- indicator_target_history não tem org_id próprio (filho único de
-- `indicators`, mesmo padrão do comentário original em
-- 20260730120100_indicators_rls.sql).
drop policy indicator_target_history_insert_org on indicator_target_history;
create policy indicator_target_history_insert_org
  on indicator_target_history for insert
  with check (
    exists (
      select 1 from indicators i
      where i.id = indicator_target_history.indicator_id
        and i.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(i.org_id)
    )
  );

drop policy indicator_target_history_update_org on indicator_target_history;
create policy indicator_target_history_update_org
  on indicator_target_history for update
  using (
    exists (
      select 1 from indicators i
      where i.id = indicator_target_history.indicator_id
        and i.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(i.org_id)
    )
  );

drop policy critical_analysis_periods_insert_org on critical_analysis_periods;
create policy critical_analysis_periods_insert_org
  on critical_analysis_periods for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

drop policy critical_analysis_periods_update_org on critical_analysis_periods;
create policy critical_analysis_periods_update_org
  on critical_analysis_periods for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));
