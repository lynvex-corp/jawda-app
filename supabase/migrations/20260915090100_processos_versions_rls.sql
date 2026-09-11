-- RLS de process_map_versions.
--
-- process_map_diagram_refs_valid: o ponto que o Matheus pediu pra validar
-- com cuidado no plano original — raia/tarefa guardam
-- responsibleEmployeeId/responsibleJobPositionId dentro do JSON do
-- diagrama. Um editor genérico desse tipo costuma vazar dado sem querer
-- se aceitar qualquer id ali; esta função (security definer, só devolve
-- boolean — nunca linha de employees/job_positions) confere que TODO id
-- referenciado no diagrama pertence à mesma organização antes de aceitar
-- a escrita. Já prevista no plano original, mas nasce só agora, Bloco B,
-- porque é aqui que raia/tarefa passam a existir de fato.
create or replace function public.process_map_diagram_refs_valid(p_org_id uuid, p_diagram jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from jsonb_array_elements(coalesce(p_diagram -> 'nodes', '[]'::jsonb)) as node
    where (
      (node -> 'data' ->> 'responsibleEmployeeId') is not null
      and not exists (
        select 1 from employees e
        where e.id = (node -> 'data' ->> 'responsibleEmployeeId')::uuid and e.org_id = p_org_id
      )
    )
    or (
      (node -> 'data' ->> 'responsibleJobPositionId') is not null
      and not exists (
        select 1 from job_positions jp
        where jp.id = (node -> 'data' ->> 'responsibleJobPositionId')::uuid and jp.org_id = p_org_id
      )
    )
  );
$$;

alter table process_map_versions enable row level security;

create policy process_map_versions_select_org
  on process_map_versions for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy process_map_versions_insert_org
  on process_map_versions for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
    and public.process_map_diagram_refs_valid(org_id, diagram)
    and exists (
      select 1 from process_maps m where m.id = process_map_id and m.org_id = org_id
    )
  );

-- USING olha a linha ANTES do update: status='rascunho' aqui barra
-- qualquer tentativa de editar uma versão já formalizada, incondicional —
-- é a imutabilidade. WITH CHECK olha a linha DEPOIS: valida de novo os
-- ids do diagrama (o conteúdo pode ter mudado na mesma escrita).
create policy process_map_versions_update_org
  on process_map_versions for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and status = 'rascunho'
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  )
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.process_map_diagram_refs_valid(org_id, diagram)
  );

create policy process_map_versions_no_delete
  on process_map_versions for delete
  using (false);

-- "Formalizar" (rascunho→formalizada) exige Aprovar — admin/quality_manager,
-- sem area_manager, embora area_manager já passe pela RLS de UPDATE acima
-- (que cobre tanto editar conteúdo quanto formalizar). Distinção fina que
-- só um trigger resolve, mesmo padrão do Bloco 5.
--
-- O trigger também carimba formalized_by/formalized_at, em vez de confiar
-- no que o cliente mandar — o cliente só pede "formalizar com este
-- rótulo", quem assina é sempre auth.uid() de verdade.
create or replace function public.enforce_process_map_version_formalize_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'formalizada' and old.status <> 'formalizada' then
    if public.user_role_in_org(new.org_id) not in ('admin', 'quality_manager') then
      raise exception 'Seu perfil não pode formalizar o fluxo — fale com o Gestor da Qualidade ou o Administrador';
    end if;
    new.formalized_by := auth.uid();
    new.formalized_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists process_map_versions_enforce_formalize_role on process_map_versions;
create trigger process_map_versions_enforce_formalize_role
  before update on process_map_versions
  for each row execute function public.enforce_process_map_version_formalize_role();
