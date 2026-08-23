-- RLS de risks_opportunities/risk_reassessments. org_can_write() desde o
-- início. risk_reassessments não tem org_id próprio — resolve via join
-- com risks_opportunities, mesmo padrão de indicator_target_history
-- (20260801110100_delinquency_write_lock_policies.sql).

alter table risks_opportunities enable row level security;

create policy risks_opportunities_select_org
  on risks_opportunities for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy risks_opportunities_insert_org
  on risks_opportunities for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy risks_opportunities_update_org
  on risks_opportunities for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy risks_opportunities_no_delete
  on risks_opportunities for delete
  using (false);

alter table risk_opportunity_code_counters enable row level security;
-- Sem nenhuma política para authenticated/anon — só a trigger SECURITY
-- DEFINER dona da tabela e o service_role tocam nela (mesmo padrão de
-- nc_code_counters).

alter table risk_reassessments enable row level security;

create policy risk_reassessments_select_org
  on risk_reassessments for select
  using (
    exists (
      select 1 from risks_opportunities r
      where r.id = risk_reassessments.risk_id and r.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy risk_reassessments_insert_org
  on risk_reassessments for insert
  with check (
    exists (
      select 1 from risks_opportunities r
      where r.id = risk_reassessments.risk_id
        and r.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(r.org_id)
    )
  );

create policy risk_reassessments_no_update
  on risk_reassessments for update
  using (false);

create policy risk_reassessments_no_delete
  on risk_reassessments for delete
  using (false);
