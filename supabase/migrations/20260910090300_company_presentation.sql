-- Bloco 2, item 10a: "Apresentação da Empresa", primeira aba da nova seção
-- Identidade Organizacional.
--
-- Modelada como documento versionado, igual a quality_policy — mesma forma,
-- mesmas RPCs, mesmo ciclo rascunho -> formalizada. Isso é de propósito: as
-- três abas da seção (Apresentação, Política da Qualidade, Missão/Visão/
-- Valores) passam a se comportar igual, e a tela reusa LockedDocumentBanner
-- e VersionHistoryCard sem componente novo.
--
-- Diferença deliberada em relação à Política da Qualidade: lá só o
-- Administrador (Alta Direção) formaliza, porque a política é o compromisso
-- formal da direção com o sistema de gestão. A apresentação institucional
-- não tem esse peso normativo, então quem pode elaborar também pode
-- formalizar (admin ou quality_manager). Se você quiser o mesmo rigor da
-- política, é trocar a checagem em enforce_company_presentation_rules.

create table if not exists company_presentation (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  status text not null default 'rascunho' check (status in ('rascunho', 'formalizada')),
  version_label text,
  content text,
  formalized_at timestamptz,
  formalized_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  check (
    status <> 'formalizada'
    or (version_label is not null and formalized_at is not null and formalized_by is not null)
  )
);

create index if not exists company_presentation_org_idx
  on company_presentation (org_id, status);

-- ============================================================
-- RLS
-- ============================================================

alter table company_presentation enable row level security;

drop policy if exists company_presentation_select_org on company_presentation;
create policy company_presentation_select_org
  on company_presentation for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

drop policy if exists company_presentation_insert_org on company_presentation;
create policy company_presentation_insert_org
  on company_presentation for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

drop policy if exists company_presentation_update_org on company_presentation;
create policy company_presentation_update_org
  on company_presentation for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

-- DELETE bloqueado — nada apaga (seção 20 do Guia).
drop policy if exists company_presentation_no_delete on company_presentation;
create policy company_presentation_no_delete
  on company_presentation for delete
  using (false);

-- ============================================================
-- GRANTS (regra 21.1 — RLS sozinha não basta, table auto-exposure está
-- desligado no PostgREST; sem isto a API responde "permission denied"
-- mesmo com a policy correta)
-- ============================================================

grant select, insert, update on company_presentation to authenticated;
grant all on company_presentation to service_role;

-- ============================================================
-- Trilha de auditoria + regras
-- ============================================================

create or replace function public.log_company_presentation_activity()
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
    values (new.org_id, v_actor, 'criou', 'company_presentation', new.id,
      jsonb_build_object('status', new.status));
  elsif tg_op = 'UPDATE' and new.status = 'formalizada' and old.status = 'rascunho' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'formalizou', 'company_presentation', new.id,
      jsonb_build_object('version_label', new.version_label));
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists company_presentation_activity_log on company_presentation;
create trigger company_presentation_activity_log
  after insert or update on company_presentation
  for each row execute function public.log_company_presentation_activity();

create or replace function public.enforce_company_presentation_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'formalizada'
     and new.content is distinct from old.content then
    raise exception 'Apresentação formalizada não pode ser editada diretamente — crie uma nova versão';
  end if;

  if new.status = 'formalizada' and (tg_op = 'INSERT' or old.status <> 'formalizada') then
    new.formalized_by := coalesce(new.formalized_by, auth.uid());
    new.formalized_at := coalesce(new.formalized_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists company_presentation_enforce_rules on company_presentation;
create trigger company_presentation_enforce_rules
  before insert or update on company_presentation
  for each row execute function public.enforce_company_presentation_rules();

-- ============================================================
-- RPCs (mesmo par de quality_policy).
--
-- Regra 21.6: company_presentation já tem trigger de log acima, então
-- NENHUMA destas funções escreve em activity_log — o trigger cobre.
-- ============================================================

create or replace function public.formalize_company_presentation(
  p_id uuid,
  p_version_label text
)
returns company_presentation
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result company_presentation;
begin
  if p_version_label is null or btrim(p_version_label) = '' then
    raise exception 'Informe o rótulo da versão para formalizar';
  end if;

  update company_presentation
     set status = 'formalizada', version_label = p_version_label
   where id = p_id and status = 'rascunho'
   returning * into v_result;

  if v_result.id is null then
    raise exception 'Apresentação não encontrada, sem acesso, ou já formalizada';
  end if;

  return v_result;
end;
$$;

create or replace function public.start_new_company_presentation_version()
returns company_presentation
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid := (auth.jwt() ->> 'org_id')::uuid;
  v_last_content text;
  v_new_id uuid;
  v_result company_presentation;
begin
  if exists (
    select 1 from company_presentation
     where org_id = v_org_id and status = 'rascunho'
  ) then
    raise exception 'Já existe um rascunho aberto. Formalize-o antes de iniciar uma nova versão.';
  end if;

  -- A nova versão nasce com o texto da última formalizada: apresentação
  -- institucional muda por ajuste pontual, não por reescrita do zero.
  select content into v_last_content
    from company_presentation
   where org_id = v_org_id and status = 'formalizada'
   order by formalized_at desc
   limit 1;

  insert into company_presentation (org_id, status, content)
    values (v_org_id, 'rascunho', v_last_content)
    returning id into v_new_id;

  select * into v_result from company_presentation where id = v_new_id;
  return v_result;
end;
$$;
