-- Trilha de auditoria + RPCs de formalização/versionamento (Política da
-- Qualidade, 6ª repetição do padrão da seção 21.5) e de revisão de
-- documento (nunca sobrescrever revisão anterior — seção "Parte 1" do
-- prompt desta aba).

create or replace function public.log_quality_policy_activity()
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
    values (new.org_id, v_actor, 'criou', 'quality_policy', new.id, jsonb_build_object('status', new.status));
  elsif tg_op = 'UPDATE' and new.status = 'formalizada' and old.status = 'rascunho' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'formalizou', 'quality_policy', new.id,
      jsonb_build_object('version_label', new.version_label));
  end if;

  return coalesce(new, old);
end;
$$;

create trigger quality_policy_activity_log
  after insert or update on quality_policy
  for each row execute function public.log_quality_policy_activity();

-- Elaboração (Gestor da Qualidade ou Administrador) já filtrada pela RLS
-- (20260825100100). Aqui: só Administrador (Alta Direção) formaliza, e
-- política já formalizada não pode ser editada diretamente.
create or replace function public.enforce_quality_policy_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if tg_op = 'UPDATE' and old.status = 'formalizada' and new.content is distinct from old.content then
    raise exception 'Política da Qualidade formalizada não pode ser editada diretamente — crie uma nova versão';
  end if;

  if new.status = 'formalizada' and (tg_op = 'INSERT' or old.status <> 'formalizada') then
    select role into v_role
    from user_organizations
    where user_id = auth.uid() and org_id = new.org_id and is_active;

    if v_role is null or v_role <> 'admin' then
      raise exception 'Somente o Administrador do Cliente (Alta Direção) pode formalizar a Política da Qualidade';
    end if;

    new.formalized_by := coalesce(new.formalized_by, auth.uid());
    new.formalized_at := coalesce(new.formalized_at, now());
  end if;

  return new;
end;
$$;

create trigger quality_policy_enforce_rules
  before insert or update on quality_policy
  for each row execute function public.enforce_quality_policy_rules();

create or replace function public.formalize_quality_policy(
  p_id uuid,
  p_version_label text
)
returns quality_policy
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result quality_policy;
begin
  if p_version_label is null or btrim(p_version_label) = '' then
    raise exception 'Informe o rótulo da versão para formalizar';
  end if;

  update quality_policy
    set status = 'formalizada', version_label = p_version_label
    where id = p_id and status = 'rascunho'
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Política não encontrada, sem acesso, ou já formalizada';
  end if;

  return v_result;
end;
$$;

create or replace function public.start_new_quality_policy_version()
returns quality_policy
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid := (auth.jwt() ->> 'org_id')::uuid;
  v_last_formalized quality_policy;
  v_new_id uuid;
  v_result quality_policy;
begin
  if exists (select 1 from quality_policy where org_id = v_org_id and status = 'rascunho') then
    raise exception 'Já existe um rascunho aberto. Formalize-o antes de iniciar uma nova versão.';
  end if;

  select * into v_last_formalized
    from quality_policy
    where org_id = v_org_id and status = 'formalizada'
    order by formalized_at desc
    limit 1;

  insert into quality_policy (org_id, status, content)
    values (v_org_id, 'rascunho', coalesce(v_last_formalized.content, ''))
    returning id into v_new_id;

  select * into v_result from quality_policy where id = v_new_id;
  return v_result;
end;
$$;

-- Trilha de auditoria de `documents` — criação e a transição para
-- 'inutilizado_revogado' (ação sensível, restrita a Gestor da
-- Qualidade/Diretoria pela RLS de update).
create or replace function public.log_documents_activity()
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
    values (new.org_id, v_actor, 'criou', 'documents', new.id, jsonb_build_object('code', new.code));
  elsif tg_op = 'UPDATE' and new.status = 'inutilizado_revogado' and old.status <> 'inutilizado_revogado' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'inutilizou_ou_revogou', 'documents', new.id, jsonb_build_object('code', new.code));
  end if;

  return coalesce(new, old);
end;
$$;

create trigger documents_activity_log
  after insert or update on documents
  for each row execute function public.log_documents_activity();

-- Registrar revisão de documento — insert em document_revisions e avanço
-- de documents.current_revision/last_revision_date na mesma transação,
-- nunca via dois statements soltos do client (evita revisão "perdida" se
-- só um dos dois passos for aplicado). Documento que estava em revisão
-- volta a 'vigente' ao registrar a nova revisão.
create or replace function public.register_document_revision(
  p_document_id uuid,
  p_content_or_file_url text
)
returns documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_next_revision int;
  v_result documents;
begin
  select current_revision + 1 into v_next_revision
    from documents
    where id = p_document_id
    for update;

  if v_next_revision is null then
    raise exception 'Documento não encontrado ou sem acesso';
  end if;

  insert into document_revisions (org_id, document_id, revision_number, content_or_file_url)
    select org_id, id, v_next_revision, p_content_or_file_url
    from documents where id = p_document_id;

  update documents
    set current_revision = v_next_revision,
        last_revision_date = current_date,
        status = case when status = 'em_revisao' then 'vigente' else status end
    where id = p_document_id
    returning * into v_result;

  return v_result;
end;
$$;
