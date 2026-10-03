-- Solução de Problemas (metodologia A3) — sub-feature do módulo Não
-- Conformidades (não é módulo contratável: nada em contract_modules).
--
-- Decisões de modelagem (ver conversa de planejamento):
-- 1. Causa raiz: mesmas colunas da NC (`five_whys` jsonb + `root_cause_text`),
--    na própria problem_solutions. NÃO generaliza a tabela da NC — a NC não
--    tem tabela de causa raiz (vive em colunas de `ncs`), e migrar isso
--    mudaria o fluxo da NC existente. O componente de UI é o mesmo
--    (CincoPorques, extraído no commit c975cca).
-- 2. Entregas (milestones): NÃO têm tabela própria. Cada uma é uma linha
--    real de action_plan_corrective_actions num action_plans com
--    origin_type='solucao_problemas' — a mesma fonte que a tela de Planos
--    de Ação lê (evita o bug do "plano invisível" do Bloco 8).
-- 3. Vínculo nos dois sentidos: action_plans.problem_solution_id (plano ->
--    A3) e problem_solutions.milestones_plan_id (A3 -> plano, atalho),
--    mantidos consistentes por trigger.
-- 4. O plano gerado NÃO recebe nc_id: senão a trigger de sincronização da NC
--    (aberta -> em_tratativa, e fechamento por eficácia) passaria a mexer
--    na NC de origem. O vínculo NC -> A3 fica só em
--    problem_solutions.nc_origin_id. A NC existente não muda em nada.
-- 5. Permissão: a RLS de `ncs` não tem checagem de papel (qualquer membro
--    da org insere/atualiza); a mesma régua é espelhada aqui, incluindo
--    unit_id e org_can_write (trava de inadimplência).

-- ============================================================
-- problem_solutions
-- ============================================================
create table problem_solutions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  unit_id uuid references units(id),
  code text not null,                       -- SP_[SEQ]_[ANO] — gerado por trigger
  title text not null,
  nc_origin_id uuid references ncs(id),     -- NC que originou (opcional)
  -- Os 7 campos do formulário A3 (o 6, Entregas, vive em action_plans):
  problem_definition text not null,         -- 1. Definição do Problema
  current_situation text,                   -- 2. Situação Atual
  goal text,                                -- 3. Meta (SMART)
  five_whys jsonb,                          -- 4. Análise da Causa Raiz (5 Porquês)
  root_cause_text text,
  future_situation text,                    -- 5. Situação Futura / Contramedidas
  indicator_id uuid references indicators(id), -- 7. Indicador
  lessons_learned text,                     -- passo 8 (ao encerrar)
  milestones_plan_id uuid references action_plans(id), -- 6. Entregas (atalho)
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'encerrado', 'cancelado')),
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id),
  cancel_reason text,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (org_id, code),
  check (status <> 'cancelado' or cancel_reason is not null),
  check (five_whys is null or jsonb_typeof(five_whys) = 'array')
);

create index problem_solutions_org_id_idx on problem_solutions(org_id);
create index problem_solutions_org_status_idx on problem_solutions(org_id, status);
create index problem_solutions_nc_origin_idx on problem_solutions(nc_origin_id);

-- Contador SP_[SEQ]_[ANO] — mesmo mecanismo de nc_code_counters (UPSERT
-- atômico). Interno: RLS ligado sem policy = inalcançável pela API.
create table problem_solution_code_counters (
  org_id uuid not null references organizations(id) on delete cascade,
  year int not null,
  next_seq int not null default 1,
  primary key (org_id, year)
);
alter table problem_solution_code_counters enable row level security;

-- ============================================================
-- action_plans: nova origem + vínculo com o A3
-- ============================================================
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'action_plans'::regclass
      and conname = 'action_plans_origin_type_check'
  ) then
    alter table action_plans drop constraint action_plans_origin_type_check;
  end if;
end $$;

alter table action_plans add constraint action_plans_origin_type_check
  check (origin_type in (
    'nao_conformidade','auditoria_interna','auditoria_externa','risco_oportunidade',
    'analise_critica','reclamacao_cliente','melhoria_continua','estrategia',
    'avaliacao_desempenho','solucao_problemas'
  ));

alter table action_plans
  add column problem_solution_id uuid references problem_solutions(id);

alter table action_plans add constraint action_plans_problem_solution_origin_check
  check (problem_solution_id is null or origin_type = 'solucao_problemas');

create index action_plans_problem_solution_idx on action_plans(problem_solution_id);

-- ============================================================
-- Triggers
-- ============================================================

-- Código + integridade: toda referência (NC, indicador, plano, unidade)
-- precisa ser da MESMA organização — FK sozinha não impede apontar para um
-- registro de outra org, e a RLS só olha a linha inserida.
create or replace function public.set_problem_solution_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
begin
  if new.nc_origin_id is not null
     and not exists (select 1 from ncs where id = new.nc_origin_id and org_id = new.org_id) then
    raise exception 'NC de origem não pertence a esta organização';
  end if;
  if new.indicator_id is not null
     and not exists (select 1 from indicators where id = new.indicator_id and org_id = new.org_id) then
    raise exception 'Indicador não pertence a esta organização';
  end if;

  insert into problem_solution_code_counters (org_id, year, next_seq)
  values (new.org_id, v_year, 2)
  on conflict (org_id, year) do update set next_seq = problem_solution_code_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  new.code := format('SP_%s_%s', lpad(v_seq::text, 3, '0'), v_year);
  return new;
end;
$$;

create trigger problem_solutions_before_insert
  before insert on problem_solutions
  for each row execute function public.set_problem_solution_code();

-- UPDATE: código e organização são imutáveis; closed_at nasce da transição
-- de status (não do client); A3 encerrado/cancelado não reabre (mesma regra
-- da NC: cria-se um novo); as referências continuam na mesma org.
create or replace function public.guard_problem_solution_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.code <> old.code or new.org_id <> old.org_id then
    raise exception 'Código e organização da Solução de Problemas não podem ser alterados';
  end if;
  if old.status in ('encerrado', 'cancelado') and new.status <> old.status then
    raise exception 'Solução de Problemas % não reabre — crie uma nova', old.status;
  end if;
  if new.nc_origin_id is distinct from old.nc_origin_id and new.nc_origin_id is not null
     and not exists (select 1 from ncs where id = new.nc_origin_id and org_id = new.org_id) then
    raise exception 'NC de origem não pertence a esta organização';
  end if;
  if new.indicator_id is distinct from old.indicator_id and new.indicator_id is not null
     and not exists (select 1 from indicators where id = new.indicator_id and org_id = new.org_id) then
    raise exception 'Indicador não pertence a esta organização';
  end if;
  if new.status = 'encerrado' and old.status <> 'encerrado' then
    new.closed_at := now();
  end if;
  return new;
end;
$$;

create trigger problem_solutions_before_update
  before update on problem_solutions
  for each row execute function public.guard_problem_solution_update();

-- Plano gerado pelo A3: valida a org do A3 e preenche
-- problem_solutions.milestones_plan_id (atalho) — o client faz um insert só.
create or replace function public.link_action_plan_to_problem_solution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.problem_solution_id is not null then
    if not exists (
      select 1 from problem_solutions
      where id = new.problem_solution_id and org_id = new.org_id
    ) then
      raise exception 'Solução de Problemas não pertence a esta organização';
    end if;
    update problem_solutions
       set milestones_plan_id = new.id
     where id = new.problem_solution_id and milestones_plan_id is null;
  end if;
  return new;
end;
$$;

create trigger action_plans_link_problem_solution
  after insert on action_plans
  for each row execute function public.link_action_plan_to_problem_solution();

-- Trilha de auditoria (seção 21.6: só aqui — nenhuma RPC insere em
-- activity_log para esta tabela).
create or replace function public.log_problem_solution_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_action text;
  v_detail jsonb;
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (
      new.org_id, v_actor, 'criou', 'solucao_problemas', new.id, new.code,
      jsonb_build_object('status', new.status, 'nc_origin_id', new.nc_origin_id)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'cancelado' and old.status <> 'cancelado' then
      v_action := 'cancelou';
      v_detail := jsonb_build_object('motivo', new.cancel_reason);
    elsif new.status = 'encerrado' and old.status <> 'encerrado' then
      v_action := 'encerrou';
      v_detail := jsonb_build_object('status_anterior', old.status);
    else
      v_action := 'atualizou';
      v_detail := jsonb_build_object('status_anterior', old.status, 'status_novo', new.status);
    end if;
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, v_actor, v_action, 'solucao_problemas', new.id, new.code, v_detail);
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger problem_solutions_activity_log
  after insert or update on problem_solutions
  for each row execute function public.log_problem_solution_activity();

-- ============================================================
-- RLS — espelha ncs (inclui user_has_unit_access e org_can_write)
-- ============================================================
alter table problem_solutions enable row level security;

create policy problem_solutions_select_org
  on problem_solutions for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

create policy problem_solutions_insert_org
  on problem_solutions for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.org_can_write(org_id)
  );

create policy problem_solutions_update_org
  on problem_solutions for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
    and public.org_can_write(org_id)
  );

-- Nada apaga: cancelar = UPDATE de status com cancel_reason.
create policy problem_solutions_no_delete
  on problem_solutions for delete
  using (false);

-- ============================================================
-- GRANT explícito (Guia 21.1) — sem delete para authenticated
-- ============================================================
grant select, insert, update on problem_solutions to authenticated;
grant all on problem_solutions to service_role;
grant all on problem_solution_code_counters to service_role;
