-- RLS das tabelas de fundação.
-- Mecanismo escolhido: JWT custom claim (auth.jwt() ->> 'org_id'), injetado
-- pelo Custom Access Token Hook criado na migração seguinte. Não usa
-- current_setting/variável de sessão porque cada chamada do PostgREST roda
-- em transação/conexão própria do pool — uma variável setada por uma RPC
-- anterior não sobrevive até a próxima chamada.
--
-- is_internal_staff() / is_super_admin(): predicados usados pelas políticas
-- de bypass do time interno Lynvex (seção 4 do Guia de Arquitetura e nota
-- "política adicional" do MODELO_DE_DADOS.md). Ficam aqui porque as políticas
-- deste arquivo dependem deles; os demais helpers (get_current_org, hook,
-- trigger de novo usuário) vêm na migração seguinte.

create or replace function public.is_internal_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from internal_staff s
    where s.id = auth.uid() and s.is_active
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from internal_staff s
    where s.id = auth.uid() and s.is_active and s.role = 'super_admin'
  );
$$;

-- =========================================================================
-- organizations
-- =========================================================================
alter table organizations enable row level security;

create policy organizations_select_own
  on organizations for select
  using (id = (auth.jwt() ->> 'org_id')::uuid);

create policy organizations_select_staff
  on organizations for select
  using (public.is_internal_staff());

create policy organizations_insert_staff
  on organizations for insert
  with check (public.is_internal_staff());

create policy organizations_update_own
  on organizations for update
  using (id = (auth.jwt() ->> 'org_id')::uuid);

create policy organizations_update_staff
  on organizations for update
  using (public.is_internal_staff());

create policy organizations_no_delete
  on organizations for delete
  using (false);

-- =========================================================================
-- units
-- =========================================================================
alter table units enable row level security;

create policy units_select_org
  on units for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy units_select_staff
  on units for select
  using (public.is_internal_staff());

create policy units_insert_org
  on units for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy units_insert_staff
  on units for insert
  with check (public.is_internal_staff());

create policy units_update_org
  on units for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy units_update_staff
  on units for update
  using (public.is_internal_staff());

create policy units_no_delete
  on units for delete
  using (false);

-- =========================================================================
-- profiles
-- =========================================================================
alter table profiles enable row level security;

create policy profiles_select_self_or_org_mate
  on profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from user_organizations uo_self
      join user_organizations uo_target
        on uo_target.org_id = uo_self.org_id
      where uo_self.user_id = auth.uid()
        and uo_target.user_id = profiles.id
    )
  );

create policy profiles_select_staff
  on profiles for select
  using (public.is_internal_staff());

create policy profiles_insert_self
  on profiles for insert
  with check (id = auth.uid());

create policy profiles_update_self
  on profiles for update
  using (id = auth.uid());

create policy profiles_no_delete
  on profiles for delete
  using (false);

-- =========================================================================
-- user_organizations
-- =========================================================================
alter table user_organizations enable row level security;

create policy user_organizations_select_org
  on user_organizations for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy user_organizations_select_staff
  on user_organizations for select
  using (public.is_internal_staff());

create policy user_organizations_insert_org
  on user_organizations for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy user_organizations_insert_staff
  on user_organizations for insert
  with check (public.is_internal_staff());

create policy user_organizations_update_org
  on user_organizations for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy user_organizations_update_staff
  on user_organizations for update
  using (public.is_internal_staff());

create policy user_organizations_no_delete
  on user_organizations for delete
  using (false);

-- =========================================================================
-- user_units_access
-- =========================================================================
alter table user_units_access enable row level security;

create policy user_units_access_select_org
  on user_units_access for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy user_units_access_select_staff
  on user_units_access for select
  using (public.is_internal_staff());

create policy user_units_access_insert_org
  on user_units_access for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy user_units_access_insert_staff
  on user_units_access for insert
  with check (public.is_internal_staff());

create policy user_units_access_update_org
  on user_units_access for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy user_units_access_update_staff
  on user_units_access for update
  using (public.is_internal_staff());

create policy user_units_access_no_delete
  on user_units_access for delete
  using (false);

-- =========================================================================
-- internal_staff — acesso restrito ao próprio staff e ao super_admin
-- =========================================================================
alter table internal_staff enable row level security;

create policy internal_staff_select_self_or_super_admin
  on internal_staff for select
  using (id = auth.uid() or public.is_super_admin());

create policy internal_staff_insert_super_admin
  on internal_staff for insert
  with check (public.is_super_admin());

create policy internal_staff_update_super_admin
  on internal_staff for update
  using (public.is_super_admin());

create policy internal_staff_no_delete
  on internal_staff for delete
  using (false);

-- =========================================================================
-- internal_access_log — acesso restrito ao próprio staff e ao super_admin
-- =========================================================================
alter table internal_access_log enable row level security;

create policy internal_access_log_select_self_or_super_admin
  on internal_access_log for select
  using (staff_id = auth.uid() or public.is_super_admin());

create policy internal_access_log_insert_self
  on internal_access_log for insert
  with check (staff_id = auth.uid());

create policy internal_access_log_update_self_or_super_admin
  on internal_access_log for update
  using (staff_id = auth.uid() or public.is_super_admin());

create policy internal_access_log_no_delete
  on internal_access_log for delete
  using (false);
