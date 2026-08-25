-- RLS de Fornecedores. Qualificação de fornecedor é compliance do
-- requisito 8.4, mesmo padrão conservador de Documentos (Parte 1): escrita
-- restrita a Gestor da Qualidade/Administrador. A especificação não pede
-- para abrir isso a "qualquer perfil" como fez explicitamente em
-- Comunicações — na ausência desse sinal, mantém o padrão já estabelecido.

alter table suppliers enable row level security;

create policy suppliers_select_org
  on suppliers for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy suppliers_insert_org
  on suppliers for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy suppliers_update_org
  on suppliers for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy suppliers_no_delete
  on suppliers for delete
  using (false);

alter table supplier_qualification_criteria enable row level security;

create policy supplier_qualification_criteria_select_org
  on supplier_qualification_criteria for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy supplier_qualification_criteria_insert_org
  on supplier_qualification_criteria for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy supplier_qualification_criteria_update_org
  on supplier_qualification_criteria for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy supplier_qualification_criteria_no_delete
  on supplier_qualification_criteria for delete
  using (false);

alter table supplier_evaluation_parameters enable row level security;

create policy supplier_evaluation_parameters_select_org
  on supplier_evaluation_parameters for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy supplier_evaluation_parameters_insert_org
  on supplier_evaluation_parameters for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy supplier_evaluation_parameters_no_update
  on supplier_evaluation_parameters for update
  using (false);

create policy supplier_evaluation_parameters_no_delete
  on supplier_evaluation_parameters for delete
  using (false);

alter table supplier_evaluations enable row level security;

create policy supplier_evaluations_select_org
  on supplier_evaluations for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy supplier_evaluations_insert_org
  on supplier_evaluations for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy supplier_evaluations_update_org
  on supplier_evaluations for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

create policy supplier_evaluations_no_delete
  on supplier_evaluations for delete
  using (false);
