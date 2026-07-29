-- Geração de código, cálculo de SLA e trilha de auditoria para `ncs`.
-- Tudo em trigger de banco (não no serviço) — mais confiável que deixar o
-- app calcular, e impede que o cliente forje código/SLA/log.

-- Contador de código por organização e ano. Sequencial GERAL por ano (não
-- separa por origem, seção 10 do Guia de Arquitetura). Tabela dedicada em
-- vez de contar linhas de `ncs` porque contar linhas tem race condition sob
-- concorrência; o UPSERT abaixo é atômico.
create table nc_code_counters (
  org_id uuid not null references organizations(id) on delete cascade,
  year int not null,
  next_seq int not null default 1,
  primary key (org_id, year)
);

create or replace function public.set_nc_code_and_sla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
  v_prefix text;
  v_sigla text;
  v_hours int;
begin
  select code_prefix_nc into v_prefix from organizations where id = new.org_id;
  v_prefix := coalesce(v_prefix, 'NC');

  v_sigla := case new.origin
    when 'auditoria_interna' then 'AI'
    when 'auditoria_externa' then 'AE'
    when 'rotina_processo' then 'RP'
    when 'documental' then 'DO'
    when 'reclamacao_cliente' then 'RC'
    when 'analise_critica_direcao' then 'AC'
    when 'incidente_acidente' then 'IN'
    when 'fornecedor' then 'FO'
    when 'indicador' then 'ID'
  end;

  insert into nc_code_counters (org_id, year, next_seq)
  values (new.org_id, v_year, 2)
  on conflict (org_id, year) do update set next_seq = nc_code_counters.next_seq + 1
  returning next_seq - 1 into v_seq;

  new.code := format('%s_%s_%s_%s', v_prefix, v_sigla, lpad(v_seq::text, 3, '0'), v_year);

  -- SLA por gravidade (seção 10 do Guia). "Configurável por empresa" fica
  -- para quando existir uma tabela de configuração de SLA por org; hoje é
  -- fixo, igual ao protótipo (src/lib/mock-data.ts: slaPorGravidade).
  v_hours := case new.severity
    when 'baixa' then 240
    when 'media' then 120
    when 'alta' then 72
    when 'critica' then 24
  end;
  if new.sla_deadline is null then
    new.sla_deadline := coalesce(new.occurred_at, now()) + (v_hours || ' hours')::interval;
  end if;

  -- "A IA propõe, o humano decide" (seção 2/12 do Guia): NC preenchida pela
  -- IA nasce em aguardando_verificacao, nunca já aberta como se fosse
  -- confirmada por humano.
  if new.ai_authored then
    new.status := 'aguardando_verificacao';
  end if;

  return new;
end;
$$;

create trigger ncs_before_insert
  before insert on ncs
  for each row execute function public.set_nc_code_and_sla();

-- Só um Gestor da Qualidade ou Administrador pode aprovar registro
-- preenchido pela IA (seção 10/12 do Guia). Verificado no banco, não só no
-- app — o app pode ter bug ou ser contornado, o trigger não.
create or replace function public.enforce_nc_ai_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if new.ai_approved_by is not null and old.ai_approved_by is null then
    select role into v_role
    from user_organizations
    where user_id = auth.uid() and org_id = new.org_id and is_active;

    if v_role is null or v_role not in ('admin', 'quality_manager') then
      raise exception 'Somente Gestor da Qualidade ou Administrador pode aprovar registro preenchido pela IA';
    end if;

    if new.ai_approved_by <> auth.uid() then
      raise exception 'ai_approved_by deve ser o usuário autenticado que está aprovando';
    end if;

    new.ai_approved_at := coalesce(new.ai_approved_at, now());
  end if;
  return new;
end;
$$;

create trigger ncs_enforce_ai_approval
  before update on ncs
  for each row execute function public.enforce_nc_ai_approval();

-- Trilha de auditoria: "criou/atualizou/cancelou NC ..." (seção 2 do Guia,
-- item 8 do prompt da ABA 4). auth.uid() nulo (ex.: seed/migração rodando
-- como service role) não gera log — activity_log.actor_id é not null e não
-- existe ator humano para registrar nesse caso.
create or replace function public.log_nc_activity()
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
      new.org_id, v_actor, 'criou', 'nc', new.id, new.code,
      jsonb_build_object('status', new.status, 'severity', new.severity, 'origin', new.origin)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'cancelado' and old.status <> 'cancelado' then
      v_action := 'cancelou';
      v_detail := jsonb_build_object('motivo', new.cancel_reason);
    else
      v_action := 'atualizou';
      v_detail := jsonb_build_object('status_anterior', old.status, 'status_novo', new.status);
    end if;
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, entity_code, detail)
    values (new.org_id, v_actor, v_action, 'nc', new.id, new.code, v_detail);
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger ncs_activity_log
  after insert or update on ncs
  for each row execute function public.log_nc_activity();
