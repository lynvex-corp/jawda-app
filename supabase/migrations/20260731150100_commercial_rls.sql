-- RLS do módulo Comercial. Nenhuma destas tabelas tem org_id — o padrão
-- "org_id = auth.jwt() ->> 'org_id'" da seção 4 do Guia não se aplica aqui;
-- a trava é só is_internal_staff()/is_super_admin(), igual às demais
-- tabelas admin-only (contracts, invoices, etc. da ABA 8/9).

create or replace function public.is_commercial_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from internal_staff s
    where s.id = auth.uid() and s.is_active and s.role in ('commercial', 'super_admin')
  );
$$;

-- =========================================================================
-- Catálogo de preços — leitura: qualquer staff ativo; escrita: só super_admin
-- =========================================================================

alter table module_pricing_catalog enable row level security;

create policy module_pricing_catalog_select_staff
  on module_pricing_catalog for select
  using (public.is_internal_staff());

create policy module_pricing_catalog_write_super_admin
  on module_pricing_catalog for insert
  with check (public.is_super_admin());

create policy module_pricing_catalog_update_super_admin
  on module_pricing_catalog for update
  using (public.is_super_admin());

alter table norm_pricing_catalog enable row level security;

create policy norm_pricing_catalog_select_staff
  on norm_pricing_catalog for select
  using (public.is_internal_staff());

create policy norm_pricing_catalog_write_super_admin
  on norm_pricing_catalog for insert
  with check (public.is_super_admin());

create policy norm_pricing_catalog_update_super_admin
  on norm_pricing_catalog for update
  using (public.is_super_admin());

-- =========================================================================
-- Oportunidades — leitura: qualquer staff ativo; escrita: commercial/super_admin
-- =========================================================================

alter table opportunities enable row level security;

create policy opportunities_select_staff
  on opportunities for select
  using (public.is_internal_staff());

create policy opportunities_insert_commercial
  on opportunities for insert
  with check (public.is_commercial_staff());

create policy opportunities_update_commercial
  on opportunities for update
  using (public.is_commercial_staff());

-- =========================================================================
-- Propostas — mesma regra de oportunidades
-- =========================================================================

alter table proposals enable row level security;

create policy proposals_select_staff
  on proposals for select
  using (public.is_internal_staff());

create policy proposals_insert_commercial
  on proposals for insert
  with check (public.is_commercial_staff());

create policy proposals_update_commercial
  on proposals for update
  using (public.is_commercial_staff());
