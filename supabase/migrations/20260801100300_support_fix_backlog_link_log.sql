-- Corrige violação da própria seção 21.6 introduzida na migração anterior:
-- convert_ticket_to_backlog_item é `security invoker` (roda como o staff
-- autenticado — precisa ser invoker para a checagem is_support_staff() valer
-- pro chamador real). No caminho "vincular a item existente" ela fazia
-- `insert into activity_log` direto, e authenticated não tem GRANT de
-- insert nessa tabela (de propósito — só trigger SECURITY DEFINER escreve
-- lá). Descoberto ao rodar o teste de ponta a ponta desta aba: "permission
-- denied for table activity_log" ao vincular um segundo ticket a um item
-- já existente.
--
-- Mesmo padrão de log_invoice_change/log_delinquency_state_change
-- (20260731090000_financial_functions.sql): a trilha nasce de uma trigger
-- SECURITY DEFINER presa à tabela de negócio, nunca de insert manual dentro
-- da RPC. O caminho "criar novo item" já tinha isso coberto pelo trigger de
-- INSERT (support_backlog_items_activity_log); faltava o de UPDATE para o
-- caminho de vínculo.

create or replace function public.log_support_backlog_item_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
begin
  if v_actor is null or old.request_count = new.request_count then
    return new;
  end if;

  select org_id into v_org_id from support_tickets where id = new.source_ticket_id;

  insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
  values (v_org_id, v_actor, 'internal_staff', 'vinculou_ticket_a_melhoria', 'support_backlog_item',
    new.id, jsonb_build_object('request_count_novo', new.request_count));

  return new;
end;
$$;

create trigger support_backlog_items_link_activity_log
  after update on support_backlog_items
  for each row execute function public.log_support_backlog_item_link();

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
