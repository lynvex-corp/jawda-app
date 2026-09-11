-- Bloco 3, item 4: notificação real, com destinatário.
--
-- ESTADO ANTERIOR: não existia notificação nenhuma no banco. O sino do topo
-- (components/app/notifications-drawer.tsx) lia de `useJawda()` — dados
-- semeados em memória por seedNotifications() a cada carregamento da página,
-- iguais para todo mundo, perdidos ao dar refresh. A seção 13 do Guia
-- descreve o conceito (sino + e-mail + varredura agendada) mas nada disso
-- tinha sido implementado.
--
-- Esta tabela cobre só a parte "dentro do sistema (sino, badge)". E-mail
-- transacional (Resend) e a rotina agendada de prazos continuam pendentes —
-- o desenho aqui não atrapalha nenhum dos dois: ambos passariam a inserir
-- nesta mesma tabela.
--
-- Colunas espelham o que o drawer já renderiza hoje (title, description,
-- tone, link, lido/não lido), para a migração do componente ser troca de
-- fonte de dados e não redesenho de tela.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- Destinatário. É o que não existia antes: notificação sem dono não tem
  -- como ser "a notificação de alguém".
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text not null,
  tone text not null default 'info' check (tone in ('info', 'success', 'warning', 'danger')),
  -- Rota para onde o clique leva. Texto livre porque o roteamento é do
  -- frontend; o banco não conhece as rotas.
  link text,
  -- Origem, para rastrear de onde a notificação veio sem precisar parsear o texto.
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- O sino consulta sempre "minhas notificações, mais recentes primeiro".
create index if not exists notifications_user_idx
  on notifications (user_id, created_at desc);
-- E o badge conta só as não lidas.
create index if not exists notifications_user_unread_idx
  on notifications (user_id)
  where read_at is null;

-- ============================================================
-- RLS — notificação é estritamente pessoal
-- ============================================================

alter table notifications enable row level security;

-- Nem o Administrador da organização lê a notificação dos outros: o filtro é
-- user_id = auth.uid(), não org_id. org_id existe só para escopo/limpeza.
drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own
  on notifications for select
  using (user_id = auth.uid());

-- O único UPDATE previsto é marcar como lida.
drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own
  on notifications for update
  using (user_id = auth.uid());

-- Sem policy de INSERT para o cliente: notificação é gerada pelo sistema
-- (triggers security definer, que não passam por RLS). Se o cliente pudesse
-- inserir, um usuário poderia forjar notificação na conta de outro.
drop policy if exists notifications_no_client_insert on notifications;
create policy notifications_no_client_insert
  on notifications for insert
  with check (false);

drop policy if exists notifications_no_delete on notifications;
create policy notifications_no_delete
  on notifications for delete
  using (false);

-- Regra 21.1. Sem INSERT para authenticated, coerente com a policy acima.
grant select, update on notifications to authenticated;
grant all on notifications to service_role;

-- ============================================================
-- Disparo: participante entrou numa Ata ou Lista de Frequência
-- ============================================================

-- security definer porque quem cria a ata (quality_manager) não tem — e não
-- deve ter — permissão de escrever na caixa de notificação de outra pessoa.
create or replace function public.notify_participant_to_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_titulo text;
  v_descricao text;
  v_entity_type text;
  v_entity_id uuid;
  -- Leva direto para a aba onde a confirmação aparece. Sem o parâmetro, o
  -- clique cairia na aba padrão (Internos) e o usuário não acharia o botão.
  v_link text;
begin
  -- Só quem tem conta no sistema pode receber notificação. Colaborador
  -- cadastrado em Pessoas sem usuário vinculado (linked_user_id nulo) entra
  -- na lista de presença normalmente, mas não tem onde confirmar — a
  -- confirmação dele fica por conta do registro em papel, como hoje.
  select e.linked_user_id, e.org_id into v_user_id, v_org_id
    from employees e
   where e.id = new.employee_id;

  if v_user_id is null then
    return new;
  end if;

  -- Os campos são lidos via to_jsonb em vez de new.<campo> porque a mesma
  -- função serve às duas tabelas, e cada uma tem um nome de FK diferente.
  -- Acessar new.meeting_minute_id quando o gatilho veio da outra tabela
  -- levantaria 'record "new" has no field'. Com to_jsonb, campo ausente é
  -- só null.
  if tg_table_name = 'meeting_minute_participants' then
    v_entity_type := 'meeting_minutes';
    v_link := '/documentos?aba=atas';
    v_entity_id := (to_jsonb(new) ->> 'meeting_minute_id')::uuid;
    select 'Confirme sua presença: ' || m.title,
           'Você foi registrado como participante da ata de '
             || to_char(m.meeting_date, 'DD/MM/YYYY')
             || '. Confirme sua presença para que ela conste como evidência.'
      into v_titulo, v_descricao
      from meeting_minutes m
     where m.id = v_entity_id;
  else
    v_entity_type := 'attendance_lists';
    v_link := '/documentos?aba=frequencia';
    v_entity_id := (to_jsonb(new) ->> 'attendance_list_id')::uuid;
    select 'Confirme sua presença: ' || l.event_title,
           'Você foi registrado na lista de frequência de '
             || to_char(l.event_date, 'DD/MM/YYYY')
             || '. Confirme sua presença para que ela conste como evidência.'
      into v_titulo, v_descricao
      from attendance_lists l
     where l.id = v_entity_id;
  end if;

  insert into notifications (org_id, user_id, title, description, tone, link, entity_type, entity_id)
  values (v_org_id, v_user_id, v_titulo, v_descricao, 'warning', v_link, v_entity_type, v_entity_id);

  -- Carimba que a notificação saiu. Fica no AFTER INSERT (e não no BEFORE)
  -- porque só faz sentido marcar depois que a notificação existe de fato.
  -- Não há risco de recursão: o gatilho é só de INSERT.
  if tg_table_name = 'meeting_minute_participants' then
    update meeting_minute_participants set notified_at = now() where id = new.id;
  else
    update attendance_list_participants set notified_at = now() where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists meeting_minute_participants_notify on meeting_minute_participants;
create trigger meeting_minute_participants_notify
  after insert on meeting_minute_participants
  for each row execute function public.notify_participant_to_confirm();

drop trigger if exists attendance_list_participants_notify on attendance_list_participants;
create trigger attendance_list_participants_notify
  after insert on attendance_list_participants
  for each row execute function public.notify_participant_to_confirm();
