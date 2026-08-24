-- RLS de strategic_directives/strategic_values. org_can_write() desde o
-- início, mais a trava de papel específica desta sub-aba (prompt: só
-- Gestor da Qualidade ou Administrador do Cliente elaboram; a validação
-- fina de "só Administrador formaliza" fica no trigger de
-- 20260824090600, igual ao padrão já usado no Escopo do Sistema.
--
-- strategic_values só aceita insert/update enquanto o documento pai está
-- em rascunho — mesmo padrão de scope_not_applicable_items.

create or replace function public.user_role_in_org(p_org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from user_organizations
  where user_id = auth.uid() and org_id = p_org_id and is_active;
$$;

alter table strategic_directives enable row level security;

create policy strategic_directives_select_org
  on strategic_directives for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy strategic_directives_insert_org
  on strategic_directives for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy strategic_directives_update_org
  on strategic_directives for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy strategic_directives_no_delete
  on strategic_directives for delete
  using (false);

alter table strategic_values enable row level security;

create policy strategic_values_select_org
  on strategic_values for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy strategic_values_insert_org
  on strategic_values for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
    and exists (
      select 1 from strategic_directives d
      where d.id = strategic_values.strategic_directive_id and d.status = 'rascunho'
    )
  );

create policy strategic_values_update_org
  on strategic_values for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
    and exists (
      select 1 from strategic_directives d
      where d.id = strategic_values.strategic_directive_id and d.status = 'rascunho'
    )
  );

create policy strategic_values_no_delete
  on strategic_values for delete
  using (false);
