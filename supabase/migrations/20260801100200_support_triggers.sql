-- Triggers e RPCs do módulo de Suporte.
--
-- 21.6 checado: nem support_tickets, nem support_messages, nem
-- support_backlog_items tinham qualquer trigger de log antes desta
-- migração (são tabelas novas, criadas em 20260801100000_support_tables).
-- Portanto as funções abaixo são a ÚNICA escrita em activity_log para essas
-- tabelas — nenhuma RPC deve inserir manualmente por cima disso depois.

-- =========================================================================
-- 1. Timestamps de resolução/fechamento — client nunca seta resolved_at/
-- closed_at na mão, mesmo espírito de "cálculo em trigger" usado em
-- opportunities.stage_changed_at (20260731150200_commercial_triggers.sql).
-- =========================================================================

create or replace function public.set_support_ticket_timestamps()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'resolvido' and new.resolved_at is null then
      new.resolved_at := now();
    elsif new.status = 'fechado' and new.closed_at is null then
      new.closed_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger support_tickets_set_timestamps
  before update on support_tickets
  for each row execute function public.set_support_ticket_timestamps();

-- =========================================================================
-- 2. Trilha de criação/mudança de status do ticket
-- =========================================================================

create or replace function public.log_support_ticket_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_type text;
begin
  if v_actor is null then
    return new;
  end if;

  v_actor_type := case when public.is_support_staff() then 'internal_staff' else 'user' end;

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, v_actor_type, 'abriu_ticket', 'support_ticket', new.id,
      jsonb_build_object('subject', new.subject, 'type', new.type, 'priority', new.priority));
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, v_actor_type, 'mudou_status_ticket', 'support_ticket', new.id,
      jsonb_build_object('status_anterior', old.status, 'status_novo', new.status));
  end if;

  return new;
end;
$$;

create trigger support_tickets_activity_log
  after insert or update on support_tickets
  for each row execute function public.log_support_ticket_change();

-- =========================================================================
-- 3. Primeira resposta do staff — marca first_response_at automaticamente
-- (KPI de tempo de 1ª resposta não depende de cálculo manual no front) e
-- registra a resposta na trilha da organização do ticket.
-- =========================================================================

create or replace function public.handle_support_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_action text;
begin
  select org_id into v_org_id from support_tickets where id = new.ticket_id;

  if new.sender_type = 'staff' then
    update support_tickets
      set first_response_at = coalesce(first_response_at, new.created_at)
      where id = new.ticket_id;
    v_action := 'staff_respondeu_ticket';
  else
    v_action := 'cliente_respondeu_ticket';
  end if;

  insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    v_org_id, new.sender_id,
    case when new.sender_type = 'staff' then 'internal_staff' else 'user' end,
    v_action, 'support_ticket', new.ticket_id,
    jsonb_build_object('message_id', new.id)
  );

  return new;
end;
$$;

create trigger support_messages_after_insert
  after insert on support_messages
  for each row execute function public.handle_support_message_insert();

-- =========================================================================
-- 4. Trilha de criação de item de backlog
-- =========================================================================

create or replace function public.log_support_backlog_item_insert()
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

  -- Sem org_id: item de backlog é interno, não pertence a uma organização
  -- (pode agregar pedidos de várias). Loga como internal_access_log-style,
  -- direto em activity_log usando o org do ticket de origem quando existir,
  -- só para dar contexto de "onde nasceu" — mesma lógica de
  -- commercial_activity_log ficar fora de activity_log quando não há
  -- organização ainda, mas aqui a tabela já é activity_log-compatível
  -- porque o ticket de origem tem org_id.
  insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
  select t.org_id, v_actor, 'internal_staff', 'criou_item_backlog', 'support_backlog_item', new.id,
    jsonb_build_object('title', new.title, 'source_ticket_id', new.source_ticket_id)
  from support_tickets t
  where t.id = new.source_ticket_id;

  return new;
end;
$$;

create trigger support_backlog_items_activity_log
  after insert on support_backlog_items
  for each row execute function public.log_support_backlog_item_insert();

-- =========================================================================
-- 5. RPC "Transformar em melhoria" — cria um item novo OU vincula a um já
-- existente (incrementa request_count). Decisão de qual dos dois caminhos
-- é sempre do staff (ver nota em support_tables sobre não automatizar
-- matching de texto).
-- =========================================================================

create or replace function public.convert_ticket_to_backlog_item(
  p_ticket_id uuid,
  p_existing_backlog_id uuid default null,
  p_title text default null,
  p_description text default null
)
returns support_backlog_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result support_backlog_items;
  v_actor uuid := auth.uid();
  v_org_id uuid;
begin
  if not public.is_support_staff() then
    raise exception 'Apenas staff de suporte ou super_admin pode transformar um ticket em melhoria';
  end if;

  select org_id into v_org_id from support_tickets where id = p_ticket_id;
  if v_org_id is null then
    raise exception 'Ticket não encontrado';
  end if;

  if p_existing_backlog_id is not null then
    update support_backlog_items
      set request_count = request_count + 1, updated_at = now()
      where id = p_existing_backlog_id
      returning * into v_result;

    if v_result.id is null then
      raise exception 'Item de backlog não encontrado';
    end if;

    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (v_org_id, v_actor, 'internal_staff', 'vinculou_ticket_a_melhoria', 'support_backlog_item',
      v_result.id, jsonb_build_object('ticket_id', p_ticket_id));
  else
    if p_title is null then
      raise exception 'Título é obrigatório para criar um novo item de backlog';
    end if;

    insert into support_backlog_items (source_ticket_id, title, description)
    values (p_ticket_id, p_title, p_description)
    returning * into v_result;
  end if;

  return v_result;
end;
$$;

grant execute on function public.convert_ticket_to_backlog_item(uuid, uuid, text, text) to authenticated;
