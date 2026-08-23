-- RLS de stakeholder_analyses/stakeholders — mesmo padrão de
-- swot_analyses/swot_cards (20260823110100), org_can_write() desde o início.

alter table stakeholder_analyses enable row level security;

create policy stakeholder_analyses_select_org
  on stakeholder_analyses for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy stakeholder_analyses_insert_org
  on stakeholder_analyses for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy stakeholder_analyses_update_org
  on stakeholder_analyses for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy stakeholder_analyses_no_delete
  on stakeholder_analyses for delete
  using (false);

alter table stakeholders enable row level security;

create policy stakeholders_select_org
  on stakeholders for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy stakeholders_insert_org
  on stakeholders for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy stakeholders_update_org
  on stakeholders for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy stakeholders_no_delete
  on stakeholders for delete
  using (false);
