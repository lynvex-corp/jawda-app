-- Bloco 10, item 3 (metade "sugestão de plano de ação"). Mesma regra da
-- NC (governança de IA — seção 12 do Guia), agora para
-- action_plan_corrective_actions: quando uma ação corretiva nasce de uma
-- proposta de IA aplicada no wizard de Planos de Ação
-- (src/components/planos-de-acao/nova-wizard.tsx), precisa de aprovação
-- do Gestor da Qualidade ou Administrador antes de virar registro
-- definitivo — mesmo texto do item 3.
--
-- Reaproveita a MESMA trava de aprovação que já existe pra reprovação de
-- eficácia escalada (guard_corrective_action_update, seção 11 do Guia):
-- ambas usam required_approval_role + approved_by. Não é o mesmo motivo
-- de negócio, mas é o mesmo mecanismo — status 'aguardando_aprovacao' e
-- o botão "Aprovar" que já existe na tela de detalhe do plano passam a
-- servir os dois casos, com o rótulo do motivo diferenciado no app.

alter table action_plan_corrective_actions
  add column if not exists ai_authored boolean not null default false;

-- set_corrective_action_defaults (20260729150200) já roda BEFORE INSERT e
-- já calcula required_approval_role quando escalation_level > 0. Estende
-- para o caso de IA: nasce direto aguardando aprovação do Gestor da
-- Qualidade, sem precisar de reprovação nenhuma pra chegar lá.
create or replace function public.set_corrective_action_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_unit_id uuid;
begin
  select org_id, unit_id into v_org_id, v_unit_id from action_plans where id = new.action_plan_id;
  if v_org_id is null then
    raise exception 'action_plan_id inválido.';
  end if;
  new.org_id := v_org_id;
  new.unit_id := v_unit_id;

  if new.seq is null then
    select coalesce(max(seq), 0) + 1 into new.seq
    from action_plan_corrective_actions
    where action_plan_id = new.action_plan_id;
  end if;

  if new.escalation_level > 0 and new.required_approval_role is null then
    new.required_approval_role := case when new.escalation_level <= 1 then 'quality_manager' else 'admin' end;
  end if;

  if new.ai_authored and new.escalation_level = 0 then
    new.status := 'aguardando_aprovacao';
    new.required_approval_role := 'quality_manager';
  end if;

  return new;
end;
$$;
