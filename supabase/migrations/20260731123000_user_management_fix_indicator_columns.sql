-- Corrige reassign_pending_items (20260731120000): indicators não tem uma
-- coluna responsible_id — tem responsible_measurement_id (quem mede) e
-- responsible_analysis_id (quem faz a análise crítica), ver
-- 20260730120000_indicators_tables.sql. O erro só apareceu no teste manual
-- desta aba (org de teste sem indicador algum não teria disparado a UPDATE
-- de qualquer forma); corrigido antes de qualquer uso real em produção.
create or replace function public.reassign_pending_items(
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_org_id uuid,
  p_staff_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n int;
begin
  if not public.is_internal_staff() then
    raise exception 'Apenas a equipe interna Lynvex pode reatribuir pendências';
  end if;
  if p_staff_id is distinct from auth.uid() then
    raise exception 'staff_id não corresponde ao usuário autenticado';
  end if;
  if p_from_user_id = p_to_user_id then
    raise exception 'Usuário de destino precisa ser diferente do usuário de origem';
  end if;
  if not exists (
    select 1 from user_organizations
    where user_id = p_to_user_id and org_id = p_org_id and is_active
  ) then
    raise exception 'Usuário de destino não é um membro ativo desta organização';
  end if;

  update ncs set responsible_id = p_to_user_id
    where org_id = p_org_id and responsible_id = p_from_user_id
      and status not in ('encerrado', 'cancelado');
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('ncs', v_n);

  update action_plans set contingency_responsible_id = p_to_user_id
    where org_id = p_org_id and contingency_responsible_id = p_from_user_id
      and status not in ('concluido', 'cancelado');
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('action_plans_contingencia', v_n);

  update action_plan_corrective_actions set who_responsible_id = p_to_user_id
    where org_id = p_org_id and who_responsible_id = p_from_user_id
      and status <> 'encerrada';
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('acoes_corretivas', v_n);

  update audits set lead_auditor_id = p_to_user_id
    where org_id = p_org_id and lead_auditor_id = p_from_user_id
      and status not in ('concluida', 'cancelada');
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('auditorias', v_n);

  update indicators set responsible_measurement_id = p_to_user_id
    where org_id = p_org_id and responsible_measurement_id = p_from_user_id and status = 'active';
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('indicadores_medicao', v_n);

  update indicators set responsible_analysis_id = p_to_user_id
    where org_id = p_org_id and responsible_analysis_id = p_from_user_id and status = 'active';
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('indicadores_analise', v_n);

  update quality_objectives set responsible_id = p_to_user_id
    where org_id = p_org_id and responsible_id = p_from_user_id and status = 'active';
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('objetivos_qualidade', v_n);

  insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
  values (p_org_id, p_staff_id, 'internal_staff', 'reatribuiu_pendencias', 'user_organizations', p_from_user_id,
    jsonb_build_object('para_usuario', p_to_user_id, 'contagem', v_counts));

  perform public.log_admin_org_access(p_staff_id, p_org_id,
    format('Reatribuiu pendências de %s para %s', p_from_user_id, p_to_user_id));

  return v_counts;
end;
$$;

grant execute on function public.reassign_pending_items(uuid, uuid, uuid, uuid) to authenticated;
