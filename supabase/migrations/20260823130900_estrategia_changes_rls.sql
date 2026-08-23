alter table changes_improvements enable row level security;

create policy changes_improvements_select_org
  on changes_improvements for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy changes_improvements_insert_org
  on changes_improvements for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy changes_improvements_update_org
  on changes_improvements for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy changes_improvements_no_delete
  on changes_improvements for delete
  using (false);
