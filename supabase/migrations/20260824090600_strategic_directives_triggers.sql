-- Trilha de auditoria + trava de papel/imutabilidade + RPCs de
-- formalização/versionamento para Missão/Visão/Valores/Propósito.

create or replace function public.log_strategic_directives_activity()
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
    values (new.org_id, v_actor, 'criou', 'strategic_directives', new.id, jsonb_build_object('status', new.status));
  elsif tg_op = 'UPDATE' and new.status = 'formalizada' and old.status = 'rascunho' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'formalizou', 'strategic_directives', new.id,
      jsonb_build_object('version_label', new.version_label));
  end if;

  return coalesce(new, old);
end;
$$;

create trigger strategic_directives_activity_log
  after insert or update on strategic_directives
  for each row execute function public.log_strategic_directives_activity();

-- Elaboração (Gestor da Qualidade ou Administrador) já é filtrada pela
-- RLS (20260824090500). Aqui só falta: só Administrador (Alta Direção)
-- formaliza, e diretrizes já formalizadas não podem ser editadas
-- diretamente (mesma lição de 20260823131200 — aplicada desde o início
-- desta vez).
create or replace function public.enforce_strategic_directives_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if tg_op = 'UPDATE' and old.status = 'formalizada' and (
    new.missao is distinct from old.missao
    or new.visao is distinct from old.visao
    or new.proposito is distinct from old.proposito
  ) then
    raise exception 'Diretrizes formalizadas não podem ser editadas diretamente — crie uma nova versão';
  end if;

  if new.status = 'formalizada' and (tg_op = 'INSERT' or old.status <> 'formalizada') then
    select role into v_role
    from user_organizations
    where user_id = auth.uid() and org_id = new.org_id and is_active;

    if v_role is null or v_role <> 'admin' then
      raise exception 'Somente o Administrador do Cliente (Alta Direção) pode formalizar as diretrizes estratégicas';
    end if;

    new.formalized_by := coalesce(new.formalized_by, auth.uid());
    new.formalized_at := coalesce(new.formalized_at, now());
  end if;

  return new;
end;
$$;

create trigger strategic_directives_enforce_rules
  before insert or update on strategic_directives
  for each row execute function public.enforce_strategic_directives_rules();

create or replace function public.formalize_strategic_directives(
  p_id uuid,
  p_version_label text
)
returns strategic_directives
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result strategic_directives;
begin
  if p_version_label is null or btrim(p_version_label) = '' then
    raise exception 'Informe o rótulo da versão para formalizar';
  end if;

  update strategic_directives
    set status = 'formalizada', version_label = p_version_label
    where id = p_id and status = 'rascunho'
    returning * into v_result;

  if v_result.id is null then
    raise exception 'Diretrizes não encontradas, sem acesso, ou já formalizadas';
  end if;

  return v_result;
end;
$$;

create or replace function public.start_new_strategic_directives_version()
returns strategic_directives
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid := (auth.jwt() ->> 'org_id')::uuid;
  v_last_formalized strategic_directives;
  v_new_id uuid;
  v_result strategic_directives;
begin
  if exists (select 1 from strategic_directives where org_id = v_org_id and status = 'rascunho') then
    raise exception 'Já existe um rascunho aberto. Formalize-o antes de iniciar uma nova versão.';
  end if;

  select * into v_last_formalized
    from strategic_directives
    where org_id = v_org_id and status = 'formalizada'
    order by formalized_at desc
    limit 1;

  insert into strategic_directives (org_id, status, missao, visao, proposito)
    values (
      v_org_id, 'rascunho',
      coalesce(v_last_formalized.missao, ''), coalesce(v_last_formalized.visao, ''),
      coalesce(v_last_formalized.proposito, '')
    )
    returning id into v_new_id;

  if v_last_formalized.id is not null then
    insert into strategic_values (org_id, strategic_directive_id, nome, descricao, item_order)
    select org_id, v_new_id, nome, descricao, item_order
    from strategic_values
    where strategic_directive_id = v_last_formalized.id;
  end if;

  select * into v_result from strategic_directives where id = v_new_id;
  return v_result;
end;
$$;
