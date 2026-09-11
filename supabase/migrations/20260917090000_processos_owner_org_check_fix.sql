-- Achado ao desenhar o Bloco D: process_maps_insert_org/update_org
-- (20260914090100) e process_map_collaborators_insert_org nunca
-- validaram que owner_employee_id/employee_id pertence à mesma
-- organização — diferente da leitura (employees_public_name já filtra
-- por org, então o nome nunca vaza), aqui é a ESCRITA que faltava
-- validar. Sem isso, um cliente de uma organização conseguia gravar o id
-- de um funcionário de outra organização no dono/colaborador do processo
-- — não vaza o nome de volta (a view protege isso), mas é referência
-- cruzada indevida e serve como oráculo de existência de UUID alheio
-- (INSERT aceita = UUID existe em alguma organização, rejeita = não
-- existe em nenhuma).
--
-- Mesma classe de gap do vazamento corrigido em employees_public_name
-- (20260914090400) — ali era leitura, aqui é escrita; as duas pontas
-- precisavam de correção separada.

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
  );

drop policy if exists process_map_collaborators_insert_org on process_map_collaborators;
create policy process_map_collaborators_insert_org
  on process_map_collaborators for insert
  with check (
    exists (
      select 1 from process_maps m
      where m.id = process_map_id
        and m.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(m.org_id)
        and public.user_role_in_org(m.org_id) in ('admin', 'quality_manager', 'area_manager')
    )
    and exists (
      select 1 from employees e
      where e.id = employee_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );
