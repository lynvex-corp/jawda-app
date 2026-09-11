-- RLS de process_maps/process_map_collaborators — matriz de permissões
-- confirmada com o Matheus:
--   Administrador: Ver,Criar,Editar,Aprovar,Excluir
--   Gestor da Qualidade: Ver,Criar,Editar,Aprovar (sem Excluir)
--   Gestor de Área: Ver,Criar,Editar (sem Aprovar, sem Excluir)
--   Auditor / Colaborador / Somente Leitura: só Ver
--
-- "Aprovar" ainda não tem ação concreta no Bloco A (formalizar versão só
-- existe a partir do Bloco B) — por isso INSERT/UPDATE de process_maps
-- tratam quality_manager e area_manager igual por ora; a distinção
-- aparece quando "formalizar" existir.
-- "Excluir" = arquivar (is_active:true→false), reversível — trigger
-- BEFORE UPDATE, mesmo padrão do Bloco 5 (enforce_*_cancel_role), já que
-- RLS sozinha não compara OLD/NEW numa única expressão.

alter table process_maps enable row level security;

create policy process_maps_select_org
  on process_maps for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy process_maps_insert_org
  on process_maps for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

create policy process_maps_update_org
  on process_maps for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

create policy process_maps_no_delete
  on process_maps for delete
  using (false);

create or replace function public.enforce_process_map_archive_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active is distinct from old.is_active
     and public.user_role_in_org(new.org_id) <> 'admin' then
    raise exception 'Seu perfil não pode arquivar/reativar processo — fale com o Administrador';
  end if;
  return new;
end;
$$;

drop trigger if exists process_maps_enforce_archive_role on process_maps;
create trigger process_maps_enforce_archive_role
  before update on process_maps
  for each row execute function public.enforce_process_map_archive_role();

alter table process_map_collaborators enable row level security;

create policy process_map_collaborators_select_org
  on process_map_collaborators for select
  using (
    exists (
      select 1 from process_maps m
      where m.id = process_map_collaborators.process_map_id
        and m.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

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
  );

create policy process_map_collaborators_no_update
  on process_map_collaborators for update
  using (false);

-- Diferente de process_maps: colaborador vinculado NÃO é registro de
-- negócio auditável, é só uma associação de conveniência — remover e
-- adicionar de novo é o fluxo normal, não precisa de "nada apaga".
create policy process_map_collaborators_delete_org
  on process_map_collaborators for delete
  using (
    exists (
      select 1 from process_maps m
      where m.id = process_map_collaborators.process_map_id
        and m.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(m.org_id)
        and public.user_role_in_org(m.org_id) in ('admin', 'quality_manager', 'area_manager')
    )
  );
