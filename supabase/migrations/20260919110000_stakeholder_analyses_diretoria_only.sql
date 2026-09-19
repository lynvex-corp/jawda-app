-- Bloco 8, item 6: Partes Interessadas passa a seguir o mesmo padrão de
-- Política da Qualidade / Diretrizes Estratégicas (Bloco 7) — rótulo de
-- versão gerado sozinho ("Análise de partes interessadas_01.2026",
-- incrementando por ano) e submódulo exclusivo da Diretoria.
--
-- Achado ao investigar: a RLS de stakeholder_analyses/stakeholders não
-- tinha NENHUMA trava de papel (só org_id e org_can_write) — qualquer
-- usuário com acesso de escrita podia criar e formalizar. Esta migração
-- fecha essa lacuna junto com o rótulo automático.

drop policy if exists stakeholder_analyses_insert_org on stakeholder_analyses;
create policy stakeholder_analyses_insert_org
  on stakeholder_analyses for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
  );

drop policy if exists stakeholder_analyses_update_org on stakeholder_analyses;
create policy stakeholder_analyses_update_org
  on stakeholder_analyses for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
  );

drop policy if exists stakeholders_insert_org on stakeholders;
create policy stakeholders_insert_org
  on stakeholders for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
  );

drop policy if exists stakeholders_update_org on stakeholders;
create policy stakeholders_update_org
  on stakeholders for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) = 'admin'
  );

-- ============================================================
-- Rótulo automático — mesmo mecanismo de quality_policy_version_counters
-- (20260919100100): tabela de contador dedicada + UPSERT atômico por
-- org/ano, só acessível pela função abaixo (sem grant a authenticated).
-- ============================================================

create table stakeholder_analysis_version_counters (
  org_id uuid not null references organizations(id) on delete cascade,
  year int not null,
  next_seq int not null default 1,
  primary key (org_id, year)
);

grant all on stakeholder_analysis_version_counters to service_role;

create or replace function public.next_stakeholder_analysis_version_label()
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
  insert into stakeholder_analysis_version_counters (org_id, year, next_seq)
  values (v_org_id, v_year, 2)
  on conflict (org_id, year) do update set next_seq = stakeholder_analysis_version_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  return 'Análise de partes interessadas_' || lpad(v_seq::text, 2, '0') || '.' || v_year;
end;
$$;

drop function if exists public.formalize_stakeholder_analysis(uuid, text);

create or replace function public.formalize_stakeholder_analysis(p_analysis_id uuid)
returns stakeholder_analyses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result stakeholder_analyses;
  v_label text;
begin
  perform 1 from stakeholder_analyses where id = p_analysis_id and status = 'rascunho' for update;
  if not found then
    raise exception 'Análise não encontrada, sem acesso, ou já formalizada';
  end if;

  v_label := public.next_stakeholder_analysis_version_label();

  update stakeholder_analyses
    set status = 'formalizada',
        version_label = v_label,
        formalized_at = now(),
        formalized_by = auth.uid()
    where id = p_analysis_id
    returning * into v_result;

  return v_result;
end;
$$;
