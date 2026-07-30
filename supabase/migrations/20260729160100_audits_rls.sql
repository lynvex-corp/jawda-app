-- RLS do módulo de Auditorias. Mesmo mecanismo de ncs/action_plans: JWT
-- custom claim (auth.jwt() ->> 'org_id'), escopo por unidade via
-- user_has_unit_access() (já existe, criada em 20260729140200_ncs_rls.sql).
-- Sem bypass para o time interno Lynvex — tabela de negócio do painel do
-- cliente (seção 4 do Guia). DELETE bloqueado em tudo — nada apaga.

alter table audits enable row level security;

create policy audits_select_org
  on audits for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

create policy audits_insert_org
  on audits for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

create policy audits_update_org
  on audits for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

create policy audits_no_delete
  on audits for delete
  using (false);

alter table audit_code_counters enable row level security;

-- Filhas: org/unidade chegam via join implícito contra `audits` (ver
-- comentário no topo de 20260729160000_audits_tables.sql). O padrão se
-- repete nas 5 tabelas — helper local só para não reescrever o EXISTS 15x.
create or replace function public.user_has_audit_access(p_audit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from audits a
    where a.id = p_audit_id
      and a.org_id = (auth.jwt() ->> 'org_id')::uuid
      and public.user_has_unit_access(a.unit_id)
  );
$$;

alter table audit_auditors enable row level security;

create policy audit_auditors_select_org
  on audit_auditors for select
  using (public.user_has_audit_access(audit_id));

create policy audit_auditors_insert_org
  on audit_auditors for insert
  with check (public.user_has_audit_access(audit_id));

create policy audit_auditors_update_org
  on audit_auditors for update
  using (public.user_has_audit_access(audit_id));

create policy audit_auditors_no_delete
  on audit_auditors for delete
  using (false);

alter table audit_plan_items enable row level security;

create policy audit_plan_items_select_org
  on audit_plan_items for select
  using (public.user_has_audit_access(audit_id));

create policy audit_plan_items_insert_org
  on audit_plan_items for insert
  with check (public.user_has_audit_access(audit_id));

create policy audit_plan_items_update_org
  on audit_plan_items for update
  using (public.user_has_audit_access(audit_id));

create policy audit_plan_items_no_delete
  on audit_plan_items for delete
  using (false);

alter table audit_checklist_items enable row level security;

create policy audit_checklist_items_select_org
  on audit_checklist_items for select
  using (public.user_has_audit_access(audit_id));

create policy audit_checklist_items_insert_org
  on audit_checklist_items for insert
  with check (public.user_has_audit_access(audit_id));

create policy audit_checklist_items_update_org
  on audit_checklist_items for update
  using (public.user_has_audit_access(audit_id));

create policy audit_checklist_items_no_delete
  on audit_checklist_items for delete
  using (false);

alter table audit_findings enable row level security;

create policy audit_findings_select_org
  on audit_findings for select
  using (public.user_has_audit_access(audit_id));

create policy audit_findings_insert_org
  on audit_findings for insert
  with check (public.user_has_audit_access(audit_id));

create policy audit_findings_update_org
  on audit_findings for update
  using (public.user_has_audit_access(audit_id));

create policy audit_findings_no_delete
  on audit_findings for delete
  using (false);

alter table audit_finding_code_counters enable row level security;

alter table audit_reports enable row level security;

create policy audit_reports_select_org
  on audit_reports for select
  using (public.user_has_audit_access(audit_id));

create policy audit_reports_insert_org
  on audit_reports for insert
  with check (public.user_has_audit_access(audit_id));

create policy audit_reports_update_org
  on audit_reports for update
  using (public.user_has_audit_access(audit_id));

create policy audit_reports_no_delete
  on audit_reports for delete
  using (false);
