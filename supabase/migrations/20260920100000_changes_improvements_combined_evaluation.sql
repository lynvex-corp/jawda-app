-- Bloco 9, itens 2, 3 e 6 (Mudanças e Melhoria — ISO 9001 6.3).
--
-- Item 2: hoje o fluxo é rascunho -> submit_change_for_evaluation (Enviar)
-- -> evaluate_change_improvement (exige status 'aguardando_avaliacao') ->
-- decide_change_improvement. Isso obriga um passo de "enviar" separado
-- antes de poder avaliar. A partir de agora, quem cadastra já avalia no
-- mesmo formulário — create_and_evaluate_change_improvement faz os dois
-- passos numa transação só, indo direto para 'aguardando_aprovacao'.
--
-- submit_change_for_evaluation e evaluate_change_improvement NÃO são
-- removidas: há 1 registro real (Cedro Engenharia) já parado em
-- 'aguardando_avaliacao' pelo fluxo antigo, e não existe fluxo automático
-- pra migrar avaliação de terceiro — alguém precisa efetivamente responder
-- a Lista de Verificação. As duas funções continuam existindo só pra esse
-- tipo de registro legado conseguir ser concluído pela tela.
create or replace function public.create_and_evaluate_change_improvement(
  p_tipo text,
  p_descricao text,
  p_proposito text,
  p_data_inicio date,
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
    raise exception 'Responda as 4 perguntas da Lista de Verificação antes de registrar';
  end if;

  insert into changes_improvements (
    tipo, descricao, proposito, data_inicio,
    consequencias_bool, consequencias_detalhe,
    integridade_bool, integridade_detalhe,
    recurso_bool, recurso_detalhe,
    responsabilidades_bool, responsabilidades_detalhe,
    avaliado_por, status
  ) values (
    p_tipo, p_descricao, p_proposito, p_data_inicio,
    p_consequencias_bool, p_consequencias_detalhe,
    p_integridade_bool, p_integridade_detalhe,
    p_recurso_bool, p_recurso_detalhe,
    p_responsabilidades_bool, p_responsabilidades_detalhe,
    auth.uid(), 'aguardando_aprovacao'
  )
  returning * into v_result;

  return v_result;
end;
$$;

-- Item 2 (achado ao investigar): decidir (aprovar/rejeitar) não tinha
-- nenhuma trava de papel — qualquer perfil com acesso de escrita podia.
-- Restringe a Gestor da Qualidade/Administrador, mantendo cadastro e
-- avaliação abertos a admin/quality_manager/area_manager (RLS de
-- insert/update de 20260913090000, não tocada aqui).
create or replace function public.decide_change_improvement(p_id uuid, p_approve boolean)
returns changes_improvements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result changes_improvements;
  v_role text;
begin
  select role into v_role
  from user_organizations
  where user_id = auth.uid() and org_id = (auth.jwt() ->> 'org_id')::uuid and is_active;

  if v_role is null or v_role not in ('admin', 'quality_manager') then
    raise exception 'Somente Gestor da Qualidade ou Administrador do Cliente pode aprovar ou rejeitar';
  end if;

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

-- Item 3: edição de descrição/propósito/data de início após qualquer
-- status (inclusive aprovada) já é permitida pela RLS de update existente
-- (org_can_write + papel autorizado, sem trava por status). Só faltava a
-- trilha registrar essa edição — hoje o trigger só loga INSERT e mudança
-- de status; uma edição de conteúdo sem mudar status não deixava rastro
-- nenhum (achado do item 6, mesmo espírito da seção 32 do Guia: trilha em
-- tudo que importa).
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
  elsif tg_op = 'UPDATE' and new.status = old.status and (
    new.descricao is distinct from old.descricao
    or new.proposito is distinct from old.proposito
    or new.data_inicio is distinct from old.data_inicio
  ) then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'editou', 'change_improvement', new.id, '{}'::jsonb);
  end if;

  return coalesce(new, old);
end;
$$;
