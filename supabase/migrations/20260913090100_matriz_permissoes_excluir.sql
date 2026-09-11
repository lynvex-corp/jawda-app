-- Bloco 5, item 6/8: matriz de permissões — "Excluir".
--
-- Em nenhuma das tabelas envolvidas "Excluir" é um DELETE de verdade —
-- confirmado antes de escrever esta migração: ncs, action_plans, audits
-- (e todas as outras do sistema) têm DELETE bloqueado (`using (false)`,
-- seção 20 do Guia — nada apaga). "Excluir" aqui é o cancelamento —
-- transição de status para 'cancelado'/'cancelada', que já existe como
-- mecanismo em cada módulo (cancelled_at/cancelled_by/cancel_reason).
--
-- Cancelar é um UPDATE comum — mesma política de _update_org que já cobre
-- qualquer edição de conteúdo. Não dá para diferenciar "editar descrição"
-- de "cancelar" só com RLS (uma USING/WITH CHECK não enxerga OLD e NEW ao
-- mesmo tempo do jeito que um trigger enxerga) — por isso quem decide é um
-- trigger BEFORE UPDATE, não uma policy nova.
--
-- Papéis que podem cancelar, por módulo (cruzado dos prints):
--   NC          — admin, quality_manager, auditor (Auditor ganhou "acesso
--                 completo" a NC nesta rodada)
--   Auditoria   — admin, quality_manager, auditor (mesmo motivo)
--   Plano de Ação — admin, quality_manager (Auditor NÃO tem acesso completo
--                 aqui — os prints só deram isso pra NC e Auditorias)

create or replace function public.enforce_nc_cancel_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelado' and old.status <> 'cancelado'
     and public.user_role_in_org(new.org_id) not in ('admin', 'quality_manager', 'auditor') then
    raise exception 'Seu perfil não pode cancelar Não Conformidade — fale com o Gestor da Qualidade ou o Administrador';
  end if;
  return new;
end;
$$;

drop trigger if exists ncs_enforce_cancel_role on ncs;
create trigger ncs_enforce_cancel_role
  before update on ncs
  for each row execute function public.enforce_nc_cancel_role();

create or replace function public.enforce_action_plan_cancel_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelado' and old.status <> 'cancelado'
     and public.user_role_in_org(new.org_id) not in ('admin', 'quality_manager') then
    raise exception 'Seu perfil não pode cancelar Plano de Ação — fale com o Gestor da Qualidade ou o Administrador';
  end if;
  return new;
end;
$$;

drop trigger if exists action_plans_enforce_cancel_role on action_plans;
create trigger action_plans_enforce_cancel_role
  before update on action_plans
  for each row execute function public.enforce_action_plan_cancel_role();

create or replace function public.enforce_audit_cancel_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelada' and old.status <> 'cancelada'
     and public.user_role_in_org(new.org_id) not in ('admin', 'quality_manager', 'auditor') then
    raise exception 'Seu perfil não pode cancelar Auditoria — fale com o Gestor da Qualidade ou o Administrador';
  end if;
  return new;
end;
$$;

drop trigger if exists audits_enforce_cancel_role on audits;
create trigger audits_enforce_cancel_role
  before update on audits
  for each row execute function public.enforce_audit_cancel_role();
