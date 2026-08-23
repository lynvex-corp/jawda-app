-- Trilha de auditoria + trava de aprovação + RPCs para o Escopo do Sistema.

create or replace function public.log_scope_document_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'criou', 'scope_document', new.id, jsonb_build_object('revision_number', new.revision_number));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'aguardando_aprovacao' and old.status = 'rascunho' then
      insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
      values (new.org_id, v_actor, 'enviou_para_aprovacao', 'scope_document', new.id, jsonb_build_object('revision_number', new.revision_number));
    elsif new.status = 'vigente' and old.status <> 'vigente' then
      insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
      values (new.org_id, v_actor, 'aprovou', 'scope_document', new.id, jsonb_build_object('revision_number', new.revision_number));
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger scope_documents_activity_log
  after insert or update on scope_documents
  for each row execute function public.log_scope_document_activity();

-- Trava de negócio (defesa em profundidade, além da RPC): bloqueia enviar
-- pra aprovação ou aprovar direto se existir item não aplicável sem
-- justificativa (teste explícito do prompt desta aba), e exige que só
-- 'admin' (Alta Direção) aprove.
create or replace function public.enforce_scope_document_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if new.status in ('aguardando_aprovacao', 'vigente') and old.status = 'rascunho' then
    if exists (
      select 1 from scope_not_applicable_items i
      where i.scope_document_id = new.id and (i.justification is null or btrim(i.justification) = '')
    ) then
      raise exception 'Existem itens não aplicáveis sem justificativa — trate antes de enviar para aprovação';
    end if;
  end if;

  if new.status = 'vigente' and old.status <> 'vigente' then
    select role into v_role
    from user_organizations
    where user_id = auth.uid() and org_id = new.org_id and is_active;

    if v_role is null or v_role <> 'admin' then
      raise exception 'Somente o Administrador do Cliente (Alta Direção) pode aprovar o escopo';
    end if;

    new.approved_by := coalesce(new.approved_by, auth.uid());
    new.approved_at := coalesce(new.approved_at, now());
  end if;

  return new;
end;
$$;

create trigger scope_documents_enforce_approval
  before update on scope_documents
  for each row execute function public.enforce_scope_document_approval();

create or replace function public.submit_scope_for_approval(p_scope_document_id uuid)
returns scope_documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result scope_documents;
begin
  update scope_documents
    set status = 'aguardando_aprovacao'
    where id = p_scope_document_id and status = 'rascunho'
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Documento não encontrado, sem acesso, ou não está em rascunho';
  end if;

  return v_result;
end;
$$;

create or replace function public.approve_scope_document(p_scope_document_id uuid)
returns scope_documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result scope_documents;
begin
  update scope_documents
    set status = 'vigente', approved_by = auth.uid(), approved_at = now()
    where id = p_scope_document_id and status = 'aguardando_aprovacao'
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Documento não encontrado, sem acesso, ou não está aguardando aprovação';
  end if;

  return v_result;
end;
$$;

create or replace function public.start_new_scope_revision()
returns scope_documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid := (auth.jwt() ->> 'org_id')::uuid;
  v_last_vigente scope_documents;
  v_next_rev int;
  v_new_id uuid;
  v_result scope_documents;
begin
  if exists (
    select 1 from scope_documents where org_id = v_org_id and status in ('rascunho', 'aguardando_aprovacao')
  ) then
    raise exception 'Já existe uma revisão em andamento. Conclua-a antes de iniciar uma nova.';
  end if;

  select * into v_last_vigente
    from scope_documents
    where org_id = v_org_id and status = 'vigente'
    order by revision_number desc
    limit 1;

  v_next_rev := coalesce(v_last_vigente.revision_number, 0) + 1;

  insert into scope_documents (org_id, declaracao_texto, status, revision_number)
    values (v_org_id, coalesce(v_last_vigente.declaracao_texto, ''), 'rascunho', v_next_rev)
    returning id into v_new_id;

  if v_last_vigente.id is not null then
    insert into scope_not_applicable_items (org_id, scope_document_id, requirement_description, justification)
    select org_id, v_new_id, requirement_description, justification
    from scope_not_applicable_items
    where scope_document_id = v_last_vigente.id;
  end if;

  select * into v_result from scope_documents where id = v_new_id;
  return v_result;
end;
$$;
