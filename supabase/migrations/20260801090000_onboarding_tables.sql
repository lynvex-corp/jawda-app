-- Onboarding e Consultoria do Admin. Dá sentido ao status 'em_onboarding'
-- criado na Aba 12 (conversão de oportunidade em cliente): checklist de
-- implantação finito e, depois de concluído, jornada de acompanhamento
-- mensal de consultoria (contínua, sem fim definido).
--
-- Consultoria é serviço opcional (decisão do questionário comercial) — não
-- existia nenhum jeito de marcar isso no schema. Caminho escolhido: boolean
-- simples em organizations (has_consulting), não uma tabela nova — não há
-- necessidade de histórico ou múltiplos valores, só um interruptor.
alter table organizations add column has_consulting boolean not null default false;

-- =========================================================================
-- 1. Tabelas
-- =========================================================================

-- Template fixo de 8 etapas (seed via trigger, seção abaixo). Editável por
-- organização depois de nascida (é a linha em si que se edita), mas o
-- conjunto de etapas não é configurável nesta versão — mesmo tratamento que
-- os 6 objetivos padrão de qualidade da Aba 9.
create table onboarding_stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  stage_order integer not null,
  stage_name text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluida', 'atrasada')),
  responsible_staff_id uuid references internal_staff(id),
  expected_date date,
  completed_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, stage_order)
);

create index onboarding_stages_org_id_idx on onboarding_stages(org_id);

create table onboarding_checklist_items (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references onboarding_stages(id) on delete cascade,
  description text not null,
  is_done boolean not null default false,
  done_at timestamptz,
  done_by uuid references internal_staff(id),
  attachment_url text,
  created_at timestamptz not null default now()
);

create index onboarding_checklist_items_stage_id_idx on onboarding_checklist_items(stage_id);

-- Trilha de 12 meses. Só passa a existir (seed via trigger) quando a
-- organização já concluiu o onboarding (status = 'active' vindo de
-- 'em_onboarding') E tem consultoria contratada (has_consulting = true) —
-- as duas condições podem se cumprir em qualquer ordem.
create table consulting_journey (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  month_number integer not null check (month_number between 1 and 12),
  theme text not null,
  status text not null default 'nao_iniciado'
    check (status in ('nao_iniciado', 'em_andamento', 'atrasado', 'concluido')),
  consultant_staff_id uuid references internal_staff(id),
  session_date date,
  session_notes text,
  deliverables text,
  created_at timestamptz not null default now(),
  unique (org_id, month_number)
);

create index consulting_journey_org_id_idx on consulting_journey(org_id);

-- Selo de maturidade, versionado — mesmo padrão de histórico com vigência
-- da seção 21.5 (indicator_target_history / update_indicator_target).
create table maturity_level_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  level text not null check (level in ('inicial', 'estruturado', 'gerenciado', 'otimizado')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  assessed_by uuid references internal_staff(id),
  assessment_notes text
);

create index maturity_level_history_org_id_idx on maturity_level_history(org_id);
-- Garante uma única vigência aberta por organização — mesmo espírito do
-- contracts_org_active_idx (seção 21.5/ABA 8).
create unique index maturity_level_history_org_open_idx
  on maturity_level_history(org_id) where valid_until is null;

-- =========================================================================
-- 2. RLS — leitura para qualquer internal_staff; escrita para staff de
-- operations/consulting/super_admin. Tabelas 100% internas: nenhuma política
-- de acesso do lado do cliente (mesma natureza de opportunities/proposals da
-- Aba 12 — onboarding e consultoria são operação da Lynvex, não tela do
-- cliente nesta versão).
-- =========================================================================

create or replace function public.is_onboarding_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from internal_staff s
    where s.id = auth.uid() and s.is_active and s.role in ('operations', 'consulting', 'super_admin')
  );
$$;

alter table onboarding_stages enable row level security;

create policy onboarding_stages_select_staff
  on onboarding_stages for select
  using (public.is_internal_staff());

create policy onboarding_stages_insert_staff
  on onboarding_stages for insert
  with check (public.is_onboarding_staff());

create policy onboarding_stages_update_staff
  on onboarding_stages for update
  using (public.is_onboarding_staff());

create policy onboarding_stages_no_delete
  on onboarding_stages for delete
  using (false);

alter table onboarding_checklist_items enable row level security;

create policy onboarding_checklist_items_select_staff
  on onboarding_checklist_items for select
  using (public.is_internal_staff());

create policy onboarding_checklist_items_insert_staff
  on onboarding_checklist_items for insert
  with check (public.is_onboarding_staff());

create policy onboarding_checklist_items_update_staff
  on onboarding_checklist_items for update
  using (public.is_onboarding_staff());

create policy onboarding_checklist_items_no_delete
  on onboarding_checklist_items for delete
  using (false);

alter table consulting_journey enable row level security;

create policy consulting_journey_select_staff
  on consulting_journey for select
  using (public.is_internal_staff());

create policy consulting_journey_insert_staff
  on consulting_journey for insert
  with check (public.is_onboarding_staff());

create policy consulting_journey_update_staff
  on consulting_journey for update
  using (public.is_onboarding_staff());

create policy consulting_journey_no_delete
  on consulting_journey for delete
  using (false);

alter table maturity_level_history enable row level security;

create policy maturity_level_history_select_staff
  on maturity_level_history for select
  using (public.is_internal_staff());

create policy maturity_level_history_insert_staff
  on maturity_level_history for insert
  with check (public.is_onboarding_staff());

create policy maturity_level_history_update_staff
  on maturity_level_history for update
  using (public.is_onboarding_staff());

create policy maturity_level_history_no_delete
  on maturity_level_history for delete
  using (false);

-- =========================================================================
-- 3. GRANT explícito (seção 21.1 — table auto-exposure desligado)
-- =========================================================================

grant select, insert, update on onboarding_stages to authenticated;
grant select, insert, update on onboarding_checklist_items to authenticated;
grant select, insert, update on consulting_journey to authenticated;
grant select, insert, update on maturity_level_history to authenticated;

grant all on onboarding_stages to service_role;
grant all on onboarding_checklist_items to service_role;
grant all on consulting_journey to service_role;
grant all on maturity_level_history to service_role;
-- delete NUNCA é concedido a authenticated (nada apaga)

-- =========================================================================
-- 4. Seed automático das 8 etapas — trigger AFTER INSERT ON organizations,
-- só quando a organização já nasce em onboarding. Segue o precedente da
-- Aba 9 (seed_default_quality_objectives): trigger na própria tabela
-- organizations garante a semente em qualquer caminho de criação (wizard
-- 'Nova Empresa' ou conversão do funil comercial), sem depender de cada
-- chamador lembrar de popular manualmente. Wizard 'Nova Empresa' provisiona
-- direto como 'active' (sem onboarding) — só quem nasce 'em_onboarding'
-- ganha o checklist.
create or replace function public.seed_onboarding_stages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'em_onboarding' then
    insert into onboarding_stages (org_id, stage_order, stage_name) values
      (new.id, 1, 'Contrato assinado'),
      (new.id, 2, 'Kickoff realizado'),
      (new.id, 3, 'Ambiente configurado'),
      (new.id, 4, 'Migração de dados'),
      (new.id, 5, 'Treinamento da equipe'),
      (new.id, 6, 'Go-live'),
      (new.id, 7, 'Acompanhamento 30 dias'),
      (new.id, 8, 'Onboarding concluído');
  end if;
  return new;
end;
$$;

create trigger organizations_seed_onboarding_stages
  after insert on organizations
  for each row execute function public.seed_onboarding_stages();

-- =========================================================================
-- 5. Trilha de organizations — organizations nunca teve trigger de
-- activity_log em UPDATE antes desta migração (conferido nas migrações
-- anteriores: só contracts/contract_modules escrevem lá a partir de
-- organizations). Legítimo criar aqui (regra 21.6 — só evita insert manual
-- quando JÁ existe trigger cobrindo a tabela mutada).
create or replace function public.log_organization_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (new.id, v_actor, 'internal_staff', 'alterou_status_organizacao', 'organization', new.id,
      jsonb_build_object('status_anterior', old.status, 'status_novo', new.status));
  end if;

  return new;
end;
$$;

create trigger organizations_activity_log
  after update on organizations
  for each row execute function public.log_organization_status_change();

-- =========================================================================
-- 6. Gancho automático de conclusão — a última etapa do template chama-se
-- literalmente 'Onboarding concluído' (stage_order 8): quando ela fecha
-- como 'concluida', a organização sai de 'em_onboarding' para 'active'
-- sozinha, sem depender de o front-end lembrar de chamar nada. O UPDATE em
-- organizations feito aqui dispara o trigger da seção 5 (log da mudança de
-- status) e o da seção 8 (seed da jornada de consultoria) — nenhuma escrita
-- redundante em activity_log é feita aqui.
create or replace function public.log_onboarding_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, v_actor, 'internal_staff',
      case when new.status = 'concluida' then 'concluiu_etapa_onboarding' else 'atualizou_etapa_onboarding' end,
      'onboarding_stage', new.id, new.stage_name,
      jsonb_build_object('status_anterior', old.status, 'status_novo', new.status));

    if new.stage_name = 'Onboarding concluído' and new.status = 'concluida' then
      update organizations set status = 'active' where id = new.org_id and status = 'em_onboarding';
    end if;
  end if;

  return new;
end;
$$;

create trigger onboarding_stages_activity_log
  after update on onboarding_stages
  for each row execute function public.log_onboarding_stage_change();

-- =========================================================================
-- 7. Trilha de avanço de mês da consultoria
-- =========================================================================

create or replace function public.log_consulting_journey_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, v_actor, 'internal_staff', 'avancou_mes_consultoria', 'consulting_journey', new.id,
      'M' || new.month_number,
      jsonb_build_object('mes', new.month_number, 'tema', new.theme,
        'status_anterior', old.status, 'status_novo', new.status));
  end if;

  return new;
end;
$$;

create trigger consulting_journey_activity_log
  after update on consulting_journey
  for each row execute function public.log_consulting_journey_change();

-- =========================================================================
-- 8. Seed automático da jornada de consultoria — trigger AFTER INSERT OR
-- UPDATE ON organizations. Dispara quando as duas condições estão
-- satisfeitas (has_consulting = true E status = 'active'), em qualquer
-- ordem de chegada: organização provisionada direto como 'active' com
-- has_consulting já marcado (INSERT), organização que sai de
-- 'em_onboarding' pra 'active' já com has_consulting marcado (UPDATE via
-- seção 6), ou organização já ativa que só depois marca has_consulting =
-- true (UPDATE via tela). not exists() torna o seed idempotente — nunca
-- duplica a trilha de 12 meses se o gatilho disparar mais de uma vez.
create or replace function public.seed_consulting_journey_if_eligible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.has_consulting and new.status = 'active'
     and (tg_op = 'INSERT' or old.has_consulting is distinct from new.has_consulting
          or old.status is distinct from new.status)
     and not exists (select 1 from consulting_journey where org_id = new.id) then
    insert into consulting_journey (org_id, month_number, theme) values
      (new.id, 1, 'Diagnóstico e mapeamento'),
      (new.id, 2, 'Definição de escopo'),
      (new.id, 3, 'Estrutura documental'),
      (new.id, 4, 'Riscos e oportunidades'),
      (new.id, 5, 'Indicadores e objetivos'),
      (new.id, 6, 'Gestão de NC'),
      (new.id, 7, 'Planos de ação'),
      (new.id, 8, 'Preparação para auditoria interna'),
      (new.id, 9, 'Auditoria interna'),
      (new.id, 10, 'Análise crítica'),
      (new.id, 11, 'Preparação para certificação'),
      (new.id, 12, 'Auditoria de certificação');
  end if;
  return new;
end;
$$;

create trigger organizations_seed_consulting_journey
  after insert or update on organizations
  for each row execute function public.seed_consulting_journey_if_eligible();

-- =========================================================================
-- 9. Trilha de alteração do selo de maturidade — insert-only (RPC da seção
-- 10 fecha a vigência anterior com UPDATE simples, sem trocar valor de
-- negócio nenhum; o evento que importa é a nova avaliação nascendo).
create or replace function public.log_maturity_level_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return new;
  end if;

  insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
  values (new.org_id, v_actor, 'internal_staff', 'alterou_nivel_maturidade', 'maturity_level_history', new.id,
    jsonb_build_object('level', new.level, 'assessment_notes', new.assessment_notes));

  return new;
end;
$$;

create trigger maturity_level_history_activity_log
  after insert on maturity_level_history
  for each row execute function public.log_maturity_level_change();

-- =========================================================================
-- 10. RPCs
-- =========================================================================

-- Fecha a vigência anterior do selo de maturidade e abre a nova — mesmo
-- padrão de update_indicator_target (seção 21.5).
create or replace function public.update_maturity_level(
  p_org_id uuid,
  p_level text,
  p_assessment_notes text default null
)
returns maturity_level_history
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result maturity_level_history;
begin
  if not public.is_onboarding_staff() then
    raise exception 'Apenas staff de operações, consultoria ou super_admin pode alterar o nível de maturidade';
  end if;

  update maturity_level_history
    set valid_until = now()
    where org_id = p_org_id and valid_until is null;

  insert into maturity_level_history (org_id, level, valid_from, valid_until, assessed_by, assessment_notes)
  values (p_org_id, p_level, now(), null, auth.uid(), p_assessment_notes)
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.update_maturity_level(uuid, text, text) to authenticated;

-- Válvula manual de conclusão de onboarding — o caminho automático (seção
-- 6) já cobre "última etapa fechou"; esta função existe para o staff
-- encerrar o onboarding manualmente num caso excepcional (ex.: checklist
-- não foi usado à risca mas a implantação já está de fato concluída). Não
-- duplica a trilha: o UPDATE aqui dispara o mesmo trigger da seção 5.
create or replace function public.admin_force_complete_onboarding(p_org_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_onboarding_staff() then
    raise exception 'Apenas staff de operações, consultoria ou super_admin pode concluir onboarding';
  end if;

  update organizations set status = 'active' where id = p_org_id and status = 'em_onboarding';
end;
$$;

grant execute on function public.admin_force_complete_onboarding(uuid) to authenticated;
