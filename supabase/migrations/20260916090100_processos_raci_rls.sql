-- RLS de process_map_raci.
--
-- Editar RACI segue a mesma régua de editar o fluxo (admin/quality_manager/
-- area_manager) e só é permitido enquanto a versão ainda é rascunho — uma
-- vez formalizada, o RACI daquela versão fica imutável junto com o
-- diagrama (mesma filosofia do Bloco B).

alter table process_map_raci enable row level security;

create policy process_map_raci_select_org
  on process_map_raci for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy process_map_raci_insert_org
  on process_map_raci for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
    -- versão é da mesma org, está em rascunho, e o node_key existe
    -- de fato no diagrama daquela versão.
    and exists (
      select 1 from process_map_versions v
      where v.id = version_id
        and v.org_id = org_id
        and v.status = 'rascunho'
        and (v.diagram -> 'nodes') @> jsonb_build_array(jsonb_build_object('id', node_key))
    )
    -- pessoa/cargo referenciado pertence à mesma organização.
    and (
      employee_id is null
      or exists (select 1 from employees e where e.id = employee_id and e.org_id = org_id)
    )
    and (
      job_position_id is null
      or exists (select 1 from job_positions jp where jp.id = job_position_id and jp.org_id = org_id)
    )
  );

create policy process_map_raci_no_update
  on process_map_raci for update
  using (false);

-- Reatribuir é excluir e inserir de novo (sem UPDATE) — mesmo padrão de
-- process_map_collaborators. Só permitido enquanto a versão é rascunho.
create policy process_map_raci_delete_org
  on process_map_raci for delete
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
    and exists (
      select 1 from process_map_versions v
      where v.id = process_map_raci.version_id and v.status = 'rascunho'
    )
  );
