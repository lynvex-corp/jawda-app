-- Bloco 10, itens 3, 6, 7 (Editar) e 9.
--
-- Achado ao investigar "Salvar rascunho não funciona": não é só um botão
-- sem onClick (era isso também) — as etapas 3-5 do wizard (Análise de
-- Causa, Plano de Ação, Avaliação de Eficácia) nunca gravam nada no banco.
-- O comentário original do código ("action_plans, etc. não foram migrados
-- ainda") ficou desatualizado — esses módulos já são reais desde a Aba 5.
--
-- Decisão (confirmada com o usuário): simplificar o wizard para terminar
-- na Análise de Causa (que passa a ser real aqui) e usar o fluxo já
-- existente e correto de Planos de Ação para Plano/Eficácia — a tela de
-- detalhe da NC já tem um card que manda pra lá com a NC vinculada
-- (nc_id), só as etapas fake do wizard nunca usavam esse caminho.
--
-- Esta migração:
-- 1. Adiciona colunas de causa raiz em `ncs` (nunca existiram).
-- 2. Estende a governança de IA já existente (ai_authored/ai_approved_by,
--    de 20260729140300) para também valer em UPDATE, não só INSERT —
--    porque causa raiz é preenchida DEPOIS da NC já criada.
-- 3. Fecha a NC automaticamente quando o plano de ação vinculado (nc_id)
--    aprova na eficácia — não existia (achado ao investigar item 9):
--    "a NC permanece aberta durante todo o ciclo... só encerra quando uma
--    ação aprova na eficácia" (seção 11 do Guia) nunca foi implementado
--    como trigger, só como frase de intenção.

alter table ncs
  add column if not exists root_cause_tool text check (root_cause_tool in ('5porques', 'ishikawa')),
  add column if not exists root_cause_problem text,
  add column if not exists five_whys jsonb,
  add column if not exists ishikawa_notes jsonb,
  add column if not exists root_cause_text text,
  add column if not exists root_cause_completed_at timestamptz;

-- ============================================================
-- Governança de IA — estende para UPDATE (item 3)
-- ============================================================
--
-- Regra confirmada: aprovação exigida sempre que a IA foi usada, mesmo se
-- editada depois (mais simples e mais conservador para auditoria — não
-- precisa rastrear "editou o suficiente?").
--
-- enforce_nc_ai_approval (20260729140300) já valida QUEM pode aprovar
-- (admin/quality_manager) em qualquer UPDATE que preencha ai_approved_by.
-- Falta: (a) quando a análise de causa é salva com ai_authored=true pela
-- primeira vez, forçar o status para 'aguardando_verificacao' (mesma regra
-- que já existia só para INSERT); (b) aprovar devolve a NC para
-- 'em_analise' (equivalente ao que aconteceria se tivesse sido humana);
-- (c) bloquear qualquer tentativa de tirar o status de
-- 'aguardando_verificacao' sem aprovação.
create or replace function public.enforce_nc_ai_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if new.ai_approved_by is not null and old.ai_approved_by is null then
    select role into v_role
    from user_organizations
    where user_id = auth.uid() and org_id = new.org_id and is_active;

    if v_role is null or v_role not in ('admin', 'quality_manager') then
      raise exception 'Somente Gestor da Qualidade ou Administrador pode aprovar registro preenchido pela IA';
    end if;

    if new.ai_approved_by <> auth.uid() then
      raise exception 'ai_approved_by deve ser o usuário autenticado que está aprovando';
    end if;

    new.ai_approved_at := coalesce(new.ai_approved_at, now());

    if new.status = 'aguardando_verificacao' then
      new.status := 'em_analise';
    end if;

    return new;
  end if;

  if new.ai_authored and not coalesce(old.ai_authored, false) then
    new.status := 'aguardando_verificacao';
    return new;
  end if;

  if coalesce(old.status, '') = 'aguardando_verificacao'
     and new.status is distinct from old.status
     and new.status <> 'aguardando_verificacao'
     and new.ai_approved_by is null
     and old.ai_authored then
    raise exception 'Análise de causa gerada por IA precisa de aprovação antes de continuar';
  end if;

  return new;
end;
$$;

-- ============================================================
-- Fecha a NC quando o plano vinculado aprova na eficácia (item 9)
-- ============================================================
--
-- Estende sync_action_plan_status (20260729150200) em vez de criar
-- trigger paralela — ela já roda depois de todo insert/update em
-- action_plan_corrective_actions e já sabe se existe ação aprovada
-- (v_any_aprovada). Só falta propagar pra NC quando o plano tem nc_id.
create or replace function public.sync_action_plan_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid := coalesce(new.action_plan_id, old.action_plan_id);
  v_any_aprovada boolean;
  v_any_aguardando_verificacao boolean;
  v_any_ativa boolean;
  v_new_status text;
  v_current_status text;
  v_nc_id uuid;
begin
  select status, nc_id into v_current_status, v_nc_id from action_plans where id = v_plan_id;
  if v_current_status = 'cancelado' then
    return coalesce(new, old);
  end if;

  select
    exists (select 1 from action_plan_corrective_actions where action_plan_id = v_plan_id and status = 'aprovada'),
    exists (select 1 from action_plan_corrective_actions where action_plan_id = v_plan_id and status = 'aguardando_verificacao'),
    exists (select 1 from action_plan_corrective_actions where action_plan_id = v_plan_id and status in ('aguardando_aprovacao', 'planejada', 'em_execucao'))
  into v_any_aprovada, v_any_aguardando_verificacao, v_any_ativa;

  v_new_status := case
    when v_any_aprovada then 'concluido'
    when v_any_aguardando_verificacao then 'em_avaliacao'
    when v_any_ativa then 'em_execucao'
    else v_current_status
  end;

  if v_new_status <> v_current_status then
    update action_plans set status = v_new_status where id = v_plan_id;
  end if;

  -- "A NC permanece aberta durante todo o ciclo... só encerra quando uma
  -- ação aprova na eficácia" (seção 11 do Guia) — nunca implementado.
  if v_any_aprovada and v_nc_id is not null then
    update ncs
      set status = 'encerrado'
      where id = v_nc_id and status not in ('encerrado', 'cancelado');
  end if;

  return coalesce(new, old);
end;
$$;
