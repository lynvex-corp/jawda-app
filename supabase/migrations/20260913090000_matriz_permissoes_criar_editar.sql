-- Bloco 5, item 6/8: matriz de permissões por papel — Criar e Editar.
--
-- ACHADO ao investigar: a matriz visual em /usuarios sempre foi decorativa
-- (array local em src/components/usuarios/page.tsx, nunca leu nem escreveu
-- no banco). E os módulos que o Bloco 5 ainda não tinha tocado — Não
-- Conformidades, Planos de Ação, Auditorias, Indicadores, Riscos, e as
-- sub-tabelas de Estratégia — não tinham NENHUMA restrição de papel na
-- escrita: só org_id e (nos três primeiros) user_has_unit_access, que
-- verifica unidade, nunca papel. Na prática, um usuário 'viewer' (Somente
-- Leitura) com acesso à unidade conseguia hoje criar/editar NC, Plano de
-- Ação e Auditoria via API — falha de segurança pré-existente, corrigida
-- aqui como efeito colateral de adicionar a checagem de papel que já
-- deveria existir.
--
-- Matriz reconstruída cruzando os 5 prints enviados pelo Matheus (via
-- Rachid Maluf, admin da Cedro Engenharia) contra o array `perfis` já
-- hardcoded na tela — toda marca vermelha nos prints correspondeu a uma
-- permissão ausente no mock, confirmando o delta sem ambiguidade.
--
-- "Aprovar" não é tocado nesta migração — nenhum print marcou uma
-- mudança nessa coluna; fica para quando houver necessidade de revisar.
--
-- Análise Crítica pela Direção (critical_analysis_meetings) fica FORA
-- desta migração de propósito — decisão do Bloco 5: continua exceção
-- admin-only dentro de Estratégia (20260911090300), mesmo que o papel
-- tenha "Criar" liberado no resto do módulo.

-- ============================================================
-- Não Conformidades
-- ============================================================

drop policy if exists ncs_insert_org on ncs;
create policy ncs_insert_org
  on ncs for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.user_role_in_org(org_id) in
      ('admin', 'quality_manager', 'area_manager', 'auditor', 'collaborator')
  );

-- Editar não inclui collaborator: o papel cria e o próprio fluxo de
-- tratativa (responsável, status) segue por outros perfis — mock nunca
-- deu "Editar" a Colaborador em NC, só "Criar".
drop policy if exists ncs_update_org on ncs;
create policy ncs_update_org
  on ncs for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager', 'auditor')
  );

-- ============================================================
-- Planos de Ação
-- ============================================================

drop policy if exists action_plans_insert_org on action_plans;
create policy action_plans_insert_org
  on action_plans for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.user_role_in_org(org_id) in
      ('admin', 'quality_manager', 'area_manager', 'collaborator')
  );

drop policy if exists action_plans_update_org on action_plans;
create policy action_plans_update_org
  on action_plans for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

drop policy if exists action_plan_corrective_actions_insert_org on action_plan_corrective_actions;
create policy action_plan_corrective_actions_insert_org
  on action_plan_corrective_actions for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.user_role_in_org(org_id) in
      ('admin', 'quality_manager', 'area_manager', 'collaborator')
  );

drop policy if exists action_plan_corrective_actions_update_org on action_plan_corrective_actions;
create policy action_plan_corrective_actions_update_org
  on action_plan_corrective_actions for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

-- ============================================================
-- Auditorias — "acesso completo" do Auditor confirmado nos prints
-- (Ver+Criar+Editar+Aprovar+Excluir em NC e Auditorias, especificamente).
-- Gestor de Área e Colaborador ficam só com Ver aqui (nenhuma marca nos
-- prints deu Criar/Editar de auditoria pra eles).
-- ============================================================

drop policy if exists audits_insert_org on audits;
create policy audits_insert_org
  on audits for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'auditor')
  );

drop policy if exists audits_update_org on audits;
create policy audits_update_org
  on audits for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'auditor')
  );

-- ============================================================
-- Indicadores — mock já tinha Gestor de Área com "Editar" (sem marca
-- vermelha ali, então mantido), mas nunca com "Criar". Assimetria
-- proposital: Gestor de Área ajusta medição/meta de indicador existente,
-- mas não cria indicador novo.
-- ============================================================

drop policy if exists indicators_insert_org on indicators;
create policy indicators_insert_org
  on indicators for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

drop policy if exists indicators_update_org on indicators;
create policy indicators_update_org
  on indicators for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

-- ============================================================
-- Riscos e Oportunidades — mock já tinha Gestor de Área com "Criar" (sem
-- marca), mas nunca "Editar". Print acrescentou só "Ver" pro Colaborador.
-- ============================================================

drop policy if exists risks_opportunities_insert_org on risks_opportunities;
create policy risks_opportunities_insert_org
  on risks_opportunities for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

drop policy if exists risks_opportunities_update_org on risks_opportunities;
create policy risks_opportunities_update_org
  on risks_opportunities for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

-- ============================================================
-- Estratégia — as 9 tabelas de conteúdo do módulo (análise crítica FICA
-- DE FORA, ver nota no topo). Print: Gestor de Área ganha Criar+Editar em
-- Estratégia como um todo (sem distinguir sub-tabela nos toggles), então
-- aplicado igual nas 9.
-- ============================================================

drop policy if exists swot_analyses_insert_org on swot_analyses;
create policy swot_analyses_insert_org
  on swot_analyses for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );
drop policy if exists swot_analyses_update_org on swot_analyses;
create policy swot_analyses_update_org
  on swot_analyses for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

drop policy if exists swot_cards_insert_org on swot_cards;
create policy swot_cards_insert_org
  on swot_cards for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );
drop policy if exists swot_cards_update_org on swot_cards;
create policy swot_cards_update_org
  on swot_cards for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

drop policy if exists stakeholder_analyses_insert_org on stakeholder_analyses;
create policy stakeholder_analyses_insert_org
  on stakeholder_analyses for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );
drop policy if exists stakeholder_analyses_update_org on stakeholder_analyses;
create policy stakeholder_analyses_update_org
  on stakeholder_analyses for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

drop policy if exists stakeholders_insert_org on stakeholders;
create policy stakeholders_insert_org
  on stakeholders for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );
drop policy if exists stakeholders_update_org on stakeholders;
create policy stakeholders_update_org
  on stakeholders for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

drop policy if exists scope_documents_insert_org on scope_documents;
create policy scope_documents_insert_org
  on scope_documents for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );
drop policy if exists scope_documents_update_org on scope_documents;
create policy scope_documents_update_org
  on scope_documents for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

drop policy if exists scope_not_applicable_items_insert_org on scope_not_applicable_items;
create policy scope_not_applicable_items_insert_org
  on scope_not_applicable_items for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
    and exists (
      select 1 from scope_documents d
      where d.id = scope_document_id and d.status = 'rascunho'
    )
  );

drop policy if exists scope_not_applicable_items_update_org on scope_not_applicable_items;
create policy scope_not_applicable_items_update_org
  on scope_not_applicable_items for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
    and exists (
      select 1 from scope_documents d
      where d.id = scope_not_applicable_items.scope_document_id and d.status = 'rascunho'
    )
  );

drop policy if exists changes_improvements_insert_org on changes_improvements;
create policy changes_improvements_insert_org
  on changes_improvements for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );
drop policy if exists changes_improvements_update_org on changes_improvements;
create policy changes_improvements_update_org
  on changes_improvements for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

drop policy if exists strategic_directives_insert_org on strategic_directives;
create policy strategic_directives_insert_org
  on strategic_directives for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

-- ACHADO ao escrever esta migração: strategic_directives_update_org (e a de
-- strategic_values logo abaixo) já tinham checagem de papel — mas restrita
-- a admin+quality_manager, sem area_manager, diferente do resto de
-- Estratégia (que era só org_can_write, sem papel nenhum). Provavelmente
-- não foi decisão deliberada de manter Diretrizes mais fechada — os prints
-- tratam "Estratégia" como um módulo só, sem distinguir sub-parte. Alinhado
-- aqui ao restante do módulo para não sobrar uma exceção sem explicação.
drop policy if exists strategic_directives_update_org on strategic_directives;
create policy strategic_directives_update_org
  on strategic_directives for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
  );

drop policy if exists strategic_values_insert_org on strategic_values;
create policy strategic_values_insert_org
  on strategic_values for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
    and exists (
      select 1 from strategic_directives d
      where d.id = strategic_directive_id and d.status = 'rascunho'
    )
  );

drop policy if exists strategic_values_update_org on strategic_values;
create policy strategic_values_update_org
  on strategic_values for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager', 'area_manager')
    and exists (
      select 1 from strategic_directives d
      where d.id = strategic_values.strategic_directive_id and d.status = 'rascunho'
    )
  );
