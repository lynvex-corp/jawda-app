-- Bloco 7, itens 3 e 4: rótulo de versão da Política da Qualidade deixa de
-- ser digitado (Dialog tinha um Input livre) e passa a ser gerado sozinho
-- no padrão "Política da Qualidade_01.2026", incrementando por ano —
-- mesmo desenho de nc_code_counters (seção 21 do Guia: tabela de contador
-- dedicada + UPSERT atômico, evita race condition sob concorrência).
--
-- Também adiciona "Cancelar alteração": hoje, depois de abrir um rascunho
-- (primeiro ou via "Nova versão"), não existe como desistir — a única saída
-- é formalizar algo. discard_quality_policy_draft resolve isso marcando o
-- rascunho como 'descartada' (nunca DELETE — seção 20 do Guia, "nada é
-- apagado") e devolvendo a tela para a última versão formalizada.

create table quality_policy_version_counters (
  org_id uuid not null references organizations(id) on delete cascade,
  year int not null,
  next_seq int not null default 1,
  primary key (org_id, year)
);

-- Sem grant a `authenticated` de propósito, igual a nc_code_counters —
-- só a função abaixo (security definer) toca esta tabela.
grant all on quality_policy_version_counters to service_role;

create or replace function public.next_quality_policy_version_label()
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
  insert into quality_policy_version_counters (org_id, year, next_seq)
  values (v_org_id, v_year, 2)
  on conflict (org_id, year) do update set next_seq = quality_policy_version_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  return 'Política da Qualidade_' || lpad(v_seq::text, 2, '0') || '.' || v_year;
end;
$$;

-- Novo status 'descartada' — rascunho abandonado, nunca vira formalizada,
-- some das telas (current só olha rascunho/formalizada) mas fica no banco
-- para trilha.
alter table quality_policy drop constraint if exists quality_policy_status_check;
alter table quality_policy
  add constraint quality_policy_status_check
  check (status in ('rascunho', 'formalizada', 'descartada'));

drop function if exists public.formalize_quality_policy(uuid, text);

create or replace function public.formalize_quality_policy(p_id uuid)
returns quality_policy
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result quality_policy;
  v_label text;
begin
  perform 1 from quality_policy where id = p_id and status = 'rascunho' for update;
  if not found then
    raise exception 'Política não encontrada, sem acesso, ou já formalizada';
  end if;

  v_label := public.next_quality_policy_version_label();

  update quality_policy
    set status = 'formalizada', version_label = v_label
    where id = p_id
    returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.discard_quality_policy_draft(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update quality_policy
    set status = 'descartada'
    where id = p_id and status = 'rascunho';

  if not found then
    raise exception 'Rascunho não encontrado, sem acesso, ou já formalizado';
  end if;
end;
$$;

-- Trilha de auditoria do descarte — a tabela já tem trigger de log
-- (log_quality_policy_activity, 20260825100200) para INSERT e formalização;
-- regra 21.6 do Guia diz para não inserir de novo em activity_log fora do
-- trigger, então a ação "descartou" entra no próprio trigger, não aqui.
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
  elsif tg_op = 'UPDATE' and new.status = 'descartada' and old.status = 'rascunho' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'descartou_rascunho', 'quality_policy', new.id, '{}'::jsonb);
  end if;

  return coalesce(new, old);
end;
$$;
