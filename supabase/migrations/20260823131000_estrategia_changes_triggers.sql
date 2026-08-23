-- Trilha de auditoria (inclusive a notificação informativa pra Diretoria
-- quando o Gestor da Qualidade aprova sozinho — todo o log desta tabela
-- fica nesta única trigger, seção 21.6: nenhuma RPC abaixo insere em
-- activity_log manualmente) + RPCs do fluxo de avaliação/aprovação.

create or replace function public.log_change_improvement_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'criou', 'change_improvement', new.id, jsonb_build_object('tipo', new.tipo));
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status <> old.status then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (
      new.org_id, v_actor,
      case new.status
        when 'aguardando_avaliacao' then 'enviou_para_avaliacao'
        when 'aguardando_aprovacao' then 'avaliou'
        when 'aprovada' then 'aprovou'
        when 'rejeitada' then 'rejeitou'
        else 'atualizou'
      end,
      'change_improvement', new.id,
      jsonb_build_object('status_anterior', old.status, 'status_novo', new.status)
    );

    if new.status = 'aprovada' then
      select role into v_role
      from user_organizations
      where user_id = v_actor and org_id = new.org_id and is_active;

      if v_role = 'quality_manager' then
        insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
        values (
          new.org_id, v_actor, 'notificou_diretoria', 'change_improvement', new.id,
          jsonb_build_object('motivo', 'aprovação feita pelo Gestor da Qualidade sem o Administrador')
        );
      end if;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger changes_improvements_activity_log
  after insert or update on changes_improvements
  for each row execute function public.log_change_improvement_activity();

create or replace function public.submit_change_for_evaluation(p_id uuid)
returns changes_improvements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result changes_improvements;
begin
  update changes_improvements
    set status = 'aguardando_avaliacao'
    where id = p_id and status = 'rascunho'
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Registro não encontrado, sem acesso, ou não está em rascunho';
  end if;

  return v_result;
end;
$$;

-- "Marcar como Avaliada" (prompt desta aba): só habilita com os 4 bools
-- respondidos — travado aqui, não só no botão da tela.
create or replace function public.evaluate_change_improvement(
  p_id uuid,
  p_consequencias_bool boolean,
  p_consequencias_detalhe text,
  p_integridade_bool boolean,
  p_integridade_detalhe text,
  p_recurso_bool boolean,
  p_recurso_detalhe text,
  p_responsabilidades_bool boolean,
  p_responsabilidades_detalhe text
)
returns changes_improvements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result changes_improvements;
begin
  if p_consequencias_bool is null or p_integridade_bool is null
     or p_recurso_bool is null or p_responsabilidades_bool is null then
    raise exception 'Responda as 4 perguntas do checklist antes de marcar como avaliada';
  end if;

  update changes_improvements set
    consequencias_bool = p_consequencias_bool, consequencias_detalhe = p_consequencias_detalhe,
    integridade_bool = p_integridade_bool, integridade_detalhe = p_integridade_detalhe,
    recurso_bool = p_recurso_bool, recurso_detalhe = p_recurso_detalhe,
    responsabilidades_bool = p_responsabilidades_bool, responsabilidades_detalhe = p_responsabilidades_detalhe,
    avaliado_por = auth.uid(),
    status = 'aguardando_aprovacao'
  where id = p_id and status = 'aguardando_avaliacao'
  returning * into v_result;

  if v_result.id is null then
    raise exception 'Registro não encontrado, sem acesso, ou não está aguardando avaliação';
  end if;

  return v_result;
end;
$$;

create or replace function public.decide_change_improvement(p_id uuid, p_approve boolean)
returns changes_improvements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result changes_improvements;
begin
  update changes_improvements
    set status = case when p_approve then 'aprovada' else 'rejeitada' end,
        aprovado_por = auth.uid()
    where id = p_id and status = 'aguardando_aprovacao'
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Registro não encontrado, sem acesso, ou não está aguardando aprovação';
  end if;

  return v_result;
end;
$$;
