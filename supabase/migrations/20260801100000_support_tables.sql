-- Módulo de Suporte (ABA 14) — chamados abertos pelo cliente, atendidos pelo
-- staff. Fecha o roadmap original do Painel Admin.
--
-- Canais de e-mail/WhatsApp/telefone: NÃO nesta versão (v2). Suporte na v1 é
-- só chat dentro do sistema. Base de conhecimento fica de fora também.

-- =========================================================================
-- 1. Horário comercial — não existia nenhuma função reutilizável de "dias
-- úteis" no projeto (a seção 10 do Guia define SLA de NC em horas corridas:
-- ver 20260729140300_ncs_triggers.sql, `new.sla_deadline := ... + hours`,
-- sem considerar fim de semana ou janela comercial). Criando aqui porque o
-- SLA de resposta de Suporte (1 dia útil) precisa respeitar 8h-18h e pular
-- fim de semana de verdade — uma "1 dia útil" que cai numa sexta às 17h não
-- pode vencer sábado. Fica pendente para o futuro: migrar o cálculo de SLA
-- de NC para usar esta mesma função em vez do `+ interval` corrido atual
-- (não é feito agora para não misturar refatoração de módulo já em produção
-- nesta aba).
create or replace function public.add_business_hours(p_start timestamptz, p_hours integer)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_current timestamptz := p_start;
  v_remaining numeric := p_hours;
  v_day_end timestamptz;
  v_available numeric;
begin
  -- Normaliza o ponto de partida para dentro da próxima janela comercial
  -- válida (pula fim de semana e horário fora de 8h-18h).
  loop
    if extract(isodow from v_current) in (6, 7) then
      v_current := date_trunc('day', v_current) + interval '1 day' + interval '8 hours';
      continue;
    end if;

    if v_current < date_trunc('day', v_current) + interval '8 hours' then
      v_current := date_trunc('day', v_current) + interval '8 hours';
    elsif v_current >= date_trunc('day', v_current) + interval '18 hours' then
      v_current := date_trunc('day', v_current) + interval '1 day' + interval '8 hours';
      continue;
    end if;

    exit;
  end loop;

  loop
    v_day_end := date_trunc('day', v_current) + interval '18 hours';
    v_available := extract(epoch from (v_day_end - v_current)) / 3600;

    if v_remaining <= v_available then
      return v_current + (v_remaining || ' hours')::interval;
    end if;

    v_remaining := v_remaining - v_available;
    v_current := date_trunc('day', v_current) + interval '1 day' + interval '8 hours';

    while extract(isodow from v_current) in (6, 7) loop
      v_current := v_current + interval '1 day';
    end loop;
  end loop;
end;
$$;

-- =========================================================================
-- 2. Tabelas
-- =========================================================================

create sequence support_ticket_number_seq;

-- `number` não estava no desenho original do prompt, mas a fila do staff
-- (item 7) precisa de um identificador curto e sequencial pra exibir e
-- buscar chamado ("número") — mesmo padrão de `proposals.number`
-- (20260731150000_commercial_tables.sql).
create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique default nextval('support_ticket_number_seq'),
  org_id uuid not null references organizations(id) on delete cascade,
  opened_by uuid not null references profiles(id) default auth.uid(),
  subject text not null,
  type text not null
    check (type in ('duvida', 'erro_bug', 'melhoria', 'suporte_metodologico', 'treinamento')),
  priority text not null default 'media'
    check (priority in ('baixa', 'media', 'alta', 'critica')),
  status text not null default 'aberto'
    check (status in ('aberto', 'em_atendimento', 'aguardando_cliente', 'resolvido', 'fechado')),
  assigned_staff_id uuid references internal_staff(id),
  -- Calculado em horário comercial (add_business_hours acima). 1 dia útil =
  -- 10h de janela comercial (8h-18h), não 24h corridas.
  sla_deadline timestamptz not null default public.add_business_hours(now(), 10),
  csat_rating integer check (csat_rating between 1 and 5),
  created_at timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz
);

create index support_tickets_org_id_idx on support_tickets(org_id);
create index support_tickets_org_status_idx on support_tickets(org_id, status);
create index support_tickets_assigned_staff_idx on support_tickets(assigned_staff_id);

-- Sem FK única de sender_id: sender_type decide se é profiles(id) (client)
-- ou internal_staff(id) (staff) — mesmo motivo de commercial_activity_log
-- não conseguir um único FK quando o ator pode ser de duas tabelas
-- diferentes, só que aqui é coluna de negócio, não de log.
create table support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('client', 'staff')),
  sender_id uuid not null,
  message text not null,
  attachment_url text,
  created_at timestamptz not null default now()
);

create index support_messages_ticket_id_idx on support_messages(ticket_id, created_at);

-- request_count é incrementado manualmente pelo staff (RPC
-- link_ticket_to_backlog_item, ver support_triggers): decidir se um novo
-- ticket "melhoria" é de fato a mesma demanda de um item já existente
-- depende de leitura humana do pedido — matching automático por texto
-- daria falso positivo/negativo demais para o volume da v1.
create table support_backlog_items (
  id uuid primary key default gen_random_uuid(),
  source_ticket_id uuid references support_tickets(id),
  title text not null,
  description text,
  stage text not null default 'ideia'
    check (stage in ('ideia', 'priorizado', 'em_desenvolvimento', 'entregue')),
  request_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_backlog_items_stage_idx on support_backlog_items(stage);

-- =========================================================================
-- 3. GRANT explícito (seção 21.1 — table auto-exposure desligado)
-- =========================================================================

grant select, insert, update on support_tickets to authenticated;
grant select, insert on support_messages to authenticated;
grant select, insert, update on support_backlog_items to authenticated;
grant usage on sequence support_ticket_number_seq to authenticated;

grant all on support_tickets to service_role;
grant all on support_messages to service_role;
grant all on support_backlog_items to service_role;
grant all on sequence support_ticket_number_seq to service_role;
-- delete NUNCA é concedido a authenticated (nada apaga) — support_messages
-- também não recebe grant de update: thread é imutável depois de enviada.
