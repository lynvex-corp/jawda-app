-- Aba "Usuários e Acessos" do Painel Admin. Funções de gestão contínua de
-- acesso — desativação por org (não deleta, o mesmo user pode estar ativo
-- em outra org), reatribuição obrigatória de pendências (seção 8 do Guia:
-- "colaborador que sai: desativação + tela obrigatória de redirecionar
-- pendências para outro") e força de redefinição de senha (seção 18: nunca
-- expor senha, só oferecer ações de "redefinir").
--
-- Todas security definer + checagem interna de is_internal_staff() (defesa
-- em profundidade, mesmo padrão de generate_invoice/mark_invoice_paid) +
-- GRANT explícito restrito a authenticated (seção 21.1) — a própria função
-- barra quem não é staff, então não há necessidade de GRANT por role de
-- banco além de authenticated/service_role.

-- =========================================================================
-- 1. deactivate_user_in_org — desliga o vínculo numa org específica
-- =========================================================================
create or replace function public.deactivate_user_in_org(
  p_user_id uuid,
  p_org_id uuid,
  p_staff_id uuid,
  p_reason text
)
returns user_organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row user_organizations%rowtype;
begin
  if not public.is_internal_staff() then
    raise exception 'Apenas a equipe interna Lynvex pode desativar acesso de usuário';
  end if;
  if p_staff_id is distinct from auth.uid() then
    raise exception 'staff_id não corresponde ao usuário autenticado';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Motivo é obrigatório para desativar o acesso';
  end if;

  update user_organizations
    set is_active = false
    where user_id = p_user_id and org_id = p_org_id
    returning * into v_row;

  if not found then
    raise exception 'Usuário não tem vínculo com esta organização';
  end if;

  insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
  values (p_org_id, p_staff_id, 'internal_staff', 'desativou_acesso_usuario', 'user_organizations', p_user_id,
    jsonb_build_object('motivo', p_reason));

  perform public.log_admin_org_access(p_staff_id, p_org_id,
    format('Desativou acesso do usuário %s: %s', p_user_id, p_reason));

  return v_row;
end;
$$;

grant execute on function public.deactivate_user_in_org(uuid, uuid, uuid, text) to authenticated;

-- =========================================================================
-- 2. reassign_pending_items — transfere pendências em aberto para outro
--    usuário ativo da mesma org, antes/depois de desativar um colaborador
-- =========================================================================
-- Cobre os 5 pontos de "responsável" que existem hoje no modelo: NC
-- (responsible_id), contingência de plano de ação (contingency_responsible_id),
-- ação corretiva (who_responsible_id), auditoria (lead_auditor_id) e
-- indicador/objetivo da qualidade (responsible_id). "Em aberto" segue o
-- enum de status de cada tabela — nunca mexe em registro já encerrado
-- (não é reescrita de histórico, é só troca de dono do que ainda está em
-- curso).
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

  update indicators set responsible_id = p_to_user_id
    where org_id = p_org_id and responsible_id = p_from_user_id and status = 'active';
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('indicadores', v_n);

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

-- =========================================================================
-- 3. force_password_reset — nunca expõe senha, só marca a exigência
-- =========================================================================
-- Supabase Auth não tem um flag nativo de "forçar troca no próximo login"
-- exposto via SQL (isso vive no GoTrue/admin API). Campo custom em
-- profiles + o app checando esse flag no primeiro carregamento do painel
-- cliente (fora do escopo desta migração, é o hook useForcePasswordReset +
-- uma tela de "defina uma nova senha" obrigatória) é o padrão adotado.
alter table profiles add column if not exists must_reset_password boolean not null default false;

create or replace function public.force_password_reset(p_user_id uuid, p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if not public.is_internal_staff() then
    raise exception 'Apenas a equipe interna Lynvex pode forçar redefinição de senha';
  end if;
  if p_staff_id is distinct from auth.uid() then
    raise exception 'staff_id não corresponde ao usuário autenticado';
  end if;

  update profiles set must_reset_password = true where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  -- org_id é só para registrar a trilha no contexto de uma empresa; um
  -- mesmo user pode estar em várias, então usa a org ativa dele como pivô
  -- (mesma lógica de get_current_org, mas para OUTRO usuário — lido direto
  -- de profiles, não do JWT de quem chama).
  select active_org_id into v_org_id from profiles where id = p_user_id;

  if v_org_id is not null then
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (v_org_id, p_staff_id, 'internal_staff', 'forcou_redefinicao_senha', 'profiles', p_user_id, '{}'::jsonb);

    perform public.log_admin_org_access(p_staff_id, v_org_id,
      format('Forçou redefinição de senha do usuário %s', p_user_id));
  end if;
end;
$$;

grant execute on function public.force_password_reset(uuid, uuid) to authenticated;

-- =========================================================================
-- 4. Trilha de mudança de perfil — "Alterar perfil" (item 5 do prompt) é um
--    UPDATE direto em user_organizations feito pelo staff, sem RPC própria
--    (é só um enum trocando de valor). Sem essa trigger essa ação ficaria de
--    fora da trilha, contrariando a seção 2 do Guia ("trilha de auditoria em
--    tudo que importa"). Mesmo padrão de log_contract_module_change: trigger
--    SECURITY DEFINER presa à tabela, dona ignora RLS.
-- =========================================================================
create or replace function public.log_user_organizations_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role and auth.uid() is not null then
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (new.org_id, auth.uid(),
      case when public.is_internal_staff() then 'internal_staff' else 'user' end,
      'alterou_perfil_usuario', 'user_organizations', new.user_id,
      jsonb_build_object('perfil_anterior', old.role, 'perfil_novo', new.role));
  end if;
  return new;
end;
$$;

create trigger user_organizations_role_change_log
  after update on user_organizations
  for each row execute function public.log_user_organizations_role_change();
