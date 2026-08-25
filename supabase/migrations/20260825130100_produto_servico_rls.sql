-- RLS de Produto ou Serviço. Mesmo padrão conservador dos outros 3
-- submódulos desta aba (Documentos, Comunicações*, Fornecedores): escrita
-- restrita a Gestor da Qualidade/Administrador. Diferente de Comunicações,
-- a especificação não pede explicitamente para abrir a outros papéis — se
-- na prática quem atualiza etapa por etapa for operação/produção
-- (area_manager/collaborator), vale revisitar esta trava depois.

alter table service_demands enable row level security;

create policy service_demands_select_org
  on service_demands for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy service_demands_insert_org
  on service_demands for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy service_demands_update_org
  on service_demands for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy service_demands_no_delete
  on service_demands for delete
  using (false);

alter table service_demand_stages enable row level security;

create policy service_demand_stages_select_org
  on service_demand_stages for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy service_demand_stages_insert_org
  on service_demand_stages for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy service_demand_stages_update_org
  on service_demand_stages for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy service_demand_stages_no_delete
  on service_demand_stages for delete
  using (false);
