-- Bloco 7: Identidade Organizacional passa a ser criada e editada
-- exclusivamente pela Diretoria. No vocabulário deste projeto "Diretoria"
-- sempre foi sinônimo de Administrador do Cliente (role 'admin') — não
-- existe papel "Diretoria" separado no enum de user_organizations.role, e
-- os próprios textos de dialog já escritos em Política da Qualidade e
-- Diretrizes Estratégicas já diziam "Diretoria (Administrador do Cliente)".
--
-- Antes: Gestor da Qualidade (quality_manager) podia elaborar rascunho nas
-- 3 abas (Apresentação, Política, Missão/Visão/Valores), só a formalização
-- exigia Administrador. Agora: as 3 abas inteiras — rascunho, edição e
-- formalização — exigem Administrador do Cliente. Isso é decisão explícita
-- do prompt desta aba (Bloco 7, item 2), não um endurecimento acidental.
--
-- O módulo Documentos (documents/document_revisions/meeting_minutes/
-- attendance_lists) NÃO muda — continua admin + quality_manager, porque
-- vive em tabelas próprias com política própria (20260825100100), não
-- tocadas aqui.

drop policy if exists company_presentation_insert_org on company_presentation;
create policy company_presentation_insert_org
  on company_presentation for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
  );

drop policy if exists company_presentation_update_org on company_presentation;
create policy company_presentation_update_org
  on company_presentation for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
  );

drop policy if exists quality_policy_insert_org on quality_policy;
create policy quality_policy_insert_org
  on quality_policy for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
  );

drop policy if exists quality_policy_update_org on quality_policy;
create policy quality_policy_update_org
  on quality_policy for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
  );

drop policy if exists strategic_directives_insert_org on strategic_directives;
create policy strategic_directives_insert_org
  on strategic_directives for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
  );

drop policy if exists strategic_directives_update_org on strategic_directives;
create policy strategic_directives_update_org
  on strategic_directives for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
  );

drop policy if exists strategic_values_insert_org on strategic_values;
create policy strategic_values_insert_org
  on strategic_values for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
    and exists (
      select 1 from strategic_directives d
      where d.id = strategic_values.strategic_directive_id and d.status = 'rascunho'
    )
  );

drop policy if exists strategic_values_update_org on strategic_values;
create policy strategic_values_update_org
  on strategic_values for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
    and exists (
      select 1 from strategic_directives d
      where d.id = strategic_values.strategic_directive_id and d.status = 'rascunho'
    )
  );
