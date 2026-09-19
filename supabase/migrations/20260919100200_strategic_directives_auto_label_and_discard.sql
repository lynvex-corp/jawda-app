-- Bloco 7, itens 4 e 5 (espelha 20260919100100, mesma lógica pra
-- Diretrizes Estratégicas / Missão-Visão-Valores-Propósito): rótulo
-- automático "Diretrizes Estratégicas_01.2026" incrementando por ano, e
-- "Cancelar alteração" pra sair de um rascunho sem formalizar nada.

create table strategic_directives_version_counters (
  org_id uuid not null references organizations(id) on delete cascade,
  year int not null,
  next_seq int not null default 1,
  primary key (org_id, year)
);

grant all on strategic_directives_version_counters to service_role;

create or replace function public.next_strategic_directives_version_label()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := (auth.jwt() ->> 'org_id')::uuid;
  v_year int := extract(year from now())::int;
  v_seq int;
begin
  insert into strategic_directives_version_counters (org_id, year, next_seq)
  values (v_org_id, v_year, 2)
  on conflict (org_id, year) do update set next_seq = strategic_directives_version_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  return 'Diretrizes Estratégicas_' || lpad(v_seq::text, 2, '0') || '.' || v_year;
end;
$$;

alter table strategic_directives drop constraint if exists strategic_directives_status_check;
alter table strategic_directives
  add constraint strategic_directives_status_check
  check (status in ('rascunho', 'formalizada', 'descartada'));

drop function if exists public.formalize_strategic_directives(uuid, text);

create or replace function public.formalize_strategic_directives(p_id uuid)
returns strategic_directives
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result strategic_directives;
  v_label text;
begin
  perform 1 from strategic_directives where id = p_id and status = 'rascunho' for update;
  if not found then
    raise exception 'Diretrizes não encontradas, sem acesso, ou já formalizadas';
  end if;

  v_label := public.next_strategic_directives_version_label();

  update strategic_directives
    set status = 'formalizada', version_label = v_label
    where id = p_id
    returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.discard_strategic_directives_draft(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update strategic_directives
    set status = 'descartada'
    where id = p_id and status = 'rascunho';

  if not found then
    raise exception 'Rascunho não encontrado, sem acesso, ou já formalizado';
  end if;
end;
$$;

-- strategic_values do rascunho descartado fica órfão de propósito (vira
-- histórico junto com o directive 'descartada', mesma lógica de
-- strategic_values de uma diretriz formalizada — nunca são apagados).

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
  elsif tg_op = 'UPDATE' and new.status = 'descartada' and old.status = 'rascunho' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'descartou_rascunho', 'strategic_directives', new.id, '{}'::jsonb);
  end if;

  return coalesce(new, old);
end;
$$;
