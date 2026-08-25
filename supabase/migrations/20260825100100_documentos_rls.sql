-- RLS de Documentos. user_role_in_org() já existe desde
-- 20260824090500_strategic_directives_rls.sql — reaproveitado aqui, não
-- recriado.
--
-- Elaboração (Gestor da Qualidade ou Administrador) filtrada na RLS de
-- insert/update. "Só Diretoria formaliza" (quality_policy) e "Inutilizar
-- ou Revogar restrito a Gestor da Qualidade/Diretoria" (documents) ficam
-- cobertos pela mesma trava de update — não há papel além desses dois que
-- consiga fazer UPDATE nessas tabelas, então a restrição fina de
-- formalização/revogação é garantida no trigger (20260825100200) sem
-- precisar de política extra.

alter table quality_policy enable row level security;

create policy quality_policy_select_org
  on quality_policy for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy quality_policy_insert_org
  on quality_policy for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy quality_policy_update_org
  on quality_policy for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy quality_policy_no_delete
  on quality_policy for delete
  using (false);

alter table documents enable row level security;

create policy documents_select_org
  on documents for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy documents_insert_org
  on documents for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy documents_update_org
  on documents for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy documents_no_delete
  on documents for delete
  using (false);

alter table document_revisions enable row level security;

create policy document_revisions_select_org
  on document_revisions for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Insert só via RPC register_document_revision (security invoker — roda
-- com o papel de quem chama, então esta política também vale pra ela).
create policy document_revisions_insert_org
  on document_revisions for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy document_revisions_no_update
  on document_revisions for update
  using (false);

create policy document_revisions_no_delete
  on document_revisions for delete
  using (false);

alter table meeting_minutes enable row level security;

create policy meeting_minutes_select_org
  on meeting_minutes for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy meeting_minutes_insert_org
  on meeting_minutes for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy meeting_minutes_no_update
  on meeting_minutes for update
  using (false);

create policy meeting_minutes_no_delete
  on meeting_minutes for delete
  using (false);

alter table attendance_lists enable row level security;

create policy attendance_lists_select_org
  on attendance_lists for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy attendance_lists_insert_org
  on attendance_lists for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy attendance_lists_no_update
  on attendance_lists for update
  using (false);

create policy attendance_lists_no_delete
  on attendance_lists for delete
  using (false);
