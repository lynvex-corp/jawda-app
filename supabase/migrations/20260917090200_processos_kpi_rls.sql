-- RLS de process_maps atualizada: indicator_id (Bloco D) some as duas
-- checagens de referência cruzada que já existiam pra owner_employee_id
-- (20260917090000) — nunca aceitar id de indicador de outra organização.

drop policy if exists process_maps_insert_org on process_maps;
create policy process_maps_insert_org
  on process_maps for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
    and (
      owner_employee_id is null
      or exists (
        select 1 from employees e where e.id = owner_employee_id and e.org_id = org_id
      )
    )
    and (
      indicator_id is null
      or exists (
        select 1 from indicators i where i.id = indicator_id and i.org_id = org_id
      )
    )
  );

drop policy if exists process_maps_update_org on process_maps;
create policy process_maps_update_org
  on process_maps for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  )
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (
      owner_employee_id is null
      or exists (
        select 1 from employees e where e.id = owner_employee_id and e.org_id = org_id
      )
    )
    and (
      indicator_id is null
      or exists (
        select 1 from indicators i where i.id = indicator_id and i.org_id = org_id
      )
    )
  );
