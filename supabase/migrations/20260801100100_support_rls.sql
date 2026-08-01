-- RLS do módulo de Suporte. Diferente de `ncs` (seção 4 do Guia: sem bypass
-- de staff em tabela de negócio do cliente), aqui o bypass é o próprio
-- requisito do módulo — staff de suporte precisa ver/atender chamados de
-- TODAS as organizações, é a fila de trabalho dele.

create or replace function public.is_support_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from internal_staff s
    where s.id = auth.uid() and s.is_active and s.role in ('support', 'super_admin')
  );
$$;

alter table support_tickets enable row level security;

create policy support_tickets_select
  on support_tickets for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid or public.is_support_staff());

create policy support_tickets_insert
  on support_tickets for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid or public.is_support_staff());

create policy support_tickets_update
  on support_tickets for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid or public.is_support_staff());

-- Nada apaga (seção 2 do Guia) — sem policy de delete, e authenticated não
-- recebe grant de delete nesta tabela.
create policy support_tickets_no_delete
  on support_tickets for delete
  using (false);

alter table support_messages enable row level security;

-- Escopo por ticket, não por org_id direto (a tabela não tem a coluna) —
-- join com support_tickets, que já carrega a política de org/staff.
create policy support_messages_select
  on support_messages for select
  using (
    exists (
      select 1 from support_tickets t
      where t.id = support_messages.ticket_id
        and (t.org_id = (auth.jwt() ->> 'org_id')::uuid or public.is_support_staff())
    )
  );

-- Cliente só posta como 'client' e com o próprio uid; staff só posta como
-- 'staff' e com o próprio uid — evita um lado forjar mensagem em nome do
-- outro dentro do mesmo ticket.
create policy support_messages_insert
  on support_messages for insert
  with check (
    (
      sender_type = 'client'
      and sender_id = auth.uid()
      and exists (
        select 1 from support_tickets t
        where t.id = support_messages.ticket_id
          and t.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
    or (
      sender_type = 'staff'
      and sender_id = auth.uid()
      and public.is_support_staff()
    )
  );

-- Thread é imutável: sem policy de update/delete, e authenticated não tem
-- grant de update/delete em support_messages.
create policy support_messages_no_update
  on support_messages for update
  using (false);

create policy support_messages_no_delete
  on support_messages for delete
  using (false);

-- Ferramenta interna de priorização — não visível para o cliente nesta
-- versão (item 3 do prompt da aba).
alter table support_backlog_items enable row level security;

create policy support_backlog_items_select_staff
  on support_backlog_items for select
  using (public.is_internal_staff());

create policy support_backlog_items_insert_support
  on support_backlog_items for insert
  with check (public.is_support_staff());

create policy support_backlog_items_update_support
  on support_backlog_items for update
  using (public.is_support_staff());

create policy support_backlog_items_no_delete
  on support_backlog_items for delete
  using (false);
