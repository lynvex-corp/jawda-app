-- CORREÇÃO CRÍTICA — auditoria completa de um bug de ambiguidade de nome
-- de coluna em RLS, achado ao verificar o Bloco D em produção.
--
-- Padrão do bug: `exists (select 1 from X alias where alias.org_id =
-- org_id)`, onde `X` também tem uma coluna `org_id`. Dentro da subquery,
-- Postgres resolve o `org_id` do lado direito (sem qualificador) pro
-- escopo mais interno — ou seja, vira `alias.org_id = alias.org_id`,
-- sempre verdadeiro, em vez de comparar com o org_id da linha de fora
-- (que era a intenção: "o registro referenciado pertence à mesma
-- organização de quem está escrevendo"). A checagem nunca falhava, pra
-- ninguém, de organização nenhuma.
--
-- Auditei TODO o diretório de migrations atrás desse padrão — grep por
-- `.org_id = org_id` e `org_id = X.org_id` nos dois sentidos. Achei 6
-- policies com o bug (uma delas do Bloco 4, anterior a esta sessão de
-- Processos; as outras 5 são deste módulo). Todo o resto do repositório
-- já usava `(auth.jwt() ->> 'org_id')::uuid` direto ou qualificação
-- explícita (`tabela.org_id`), que não sofrem desse problema — troquei
-- as 6 pro mesmo padrão seguro.

-- 1) performance_evaluations — avaliador_user_id não era validado contra
-- a organização de quem programa a avaliação (Bloco 4, item 9, bug
-- pré-existente a esta sessão).
drop policy if exists performance_evaluations_insert_org on performance_evaluations;
create policy performance_evaluations_insert_org
  on performance_evaluations for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'area_manager')
    and exists (
      select 1 from user_organizations uo
      where uo.user_id = avaliador_user_id
        and uo.org_id = (auth.jwt() ->> 'org_id')::uuid
        and uo.is_active
        and uo.role in ('admin', 'area_manager')
    )
  );

-- 2) process_map_versions — process_map_id não era validado contra a
-- organização da versão sendo criada.
drop policy if exists process_map_versions_insert_org on process_map_versions;
create policy process_map_versions_insert_org
  on process_map_versions for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
    and public.process_map_diagram_refs_valid(org_id, diagram)
    and exists (
      select 1 from process_maps m
      where m.id = process_map_id and m.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

-- 3) process_map_raci — version_id, employee_id e job_position_id não
-- eram validados contra a organização.
drop policy if exists process_map_raci_insert_org on process_map_raci;
create policy process_map_raci_insert_org
  on process_map_raci for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
    and exists (
      select 1 from process_map_versions v
      where v.id = version_id
        and v.org_id = (auth.jwt() ->> 'org_id')::uuid
        and v.status = 'rascunho'
        and (v.diagram -> 'nodes') @> jsonb_build_array(jsonb_build_object('id', node_key))
    )
    and (
      employee_id is null
      or exists (
        select 1 from employees e
        where e.id = employee_id and e.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
    and (
      job_position_id is null
      or exists (
        select 1 from job_positions jp
        where jp.id = job_position_id and jp.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

-- 4) process_maps — owner_employee_id e indicator_id não eram validados
-- contra a organização (o gap que eu estava tentando corrigir quando
-- achei que a correção em si tinha o mesmo bug).
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
        select 1 from employees e
        where e.id = owner_employee_id and e.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
    and (
      indicator_id is null
      or exists (
        select 1 from indicators i
        where i.id = indicator_id and i.org_id = (auth.jwt() ->> 'org_id')::uuid
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
        select 1 from employees e
        where e.id = owner_employee_id and e.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
    and (
      indicator_id is null
      or exists (
        select 1 from indicators i
        where i.id = indicator_id and i.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );
