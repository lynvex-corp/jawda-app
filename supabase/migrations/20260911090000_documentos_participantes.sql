-- Bloco 3, item 1 (participantes vindos de Cargos e Perfis) e base do item 4
-- (confirmação individual de presença).
--
-- POR QUE TABELA NOVA, E NÃO AJUSTE NO JSONB QUE JÁ EXISTE:
-- meeting_minutes.participants e attendance_lists.participants são jsonb de
-- texto livre ([{nome}] / [{nome, confirmado}]) — sem vínculo com pessoa
-- cadastrada, então não há como saber de quem é cada nome nem notificar
-- ninguém. Pior: as duas tabelas-pai têm policy `no_update ... using (false)`,
-- são imutáveis por design. Marcar "confirmado" dentro do jsonb exigiria um
-- UPDATE na linha-pai, que a RLS recusa. Não é preferência de modelagem: com
-- o desenho atual a confirmação individual é impossível.
--
-- As colunas jsonb NÃO são removidas. As 2 listas que já existem em produção
-- guardam nomes digitados à mão que não têm para onde migrar (não há
-- employee correspondente), e apagar registro contraria a seção 20 do Guia.
-- Elas ficam como histórico; o que nasce daqui em diante usa as tabelas novas.
--
-- Modelagem espelha critical_analysis_participants, que já resolve exatamente
-- este problema no módulo de Análise Crítica (participante + flag de
-- aprovação + carimbo). Sem org_id nas tabelas filhas, pelo mesmo motivo que
-- lá: o escopo de organização vem do join com a tabela-pai.

create table if not exists meeting_minute_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_minute_id uuid not null references meeting_minutes(id) on delete cascade,
  employee_id uuid not null references employees(id),
  confirmed boolean not null default false,
  confirmed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (meeting_minute_id, employee_id),
  check (confirmed = (confirmed_at is not null))
);

create index if not exists meeting_minute_participants_ata_idx
  on meeting_minute_participants (meeting_minute_id);
create index if not exists meeting_minute_participants_employee_idx
  on meeting_minute_participants (employee_id);

create table if not exists attendance_list_participants (
  id uuid primary key default gen_random_uuid(),
  attendance_list_id uuid not null references attendance_lists(id) on delete cascade,
  employee_id uuid not null references employees(id),
  confirmed boolean not null default false,
  confirmed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (attendance_list_id, employee_id),
  check (confirmed = (confirmed_at is not null))
);

create index if not exists attendance_list_participants_lista_idx
  on attendance_list_participants (attendance_list_id);
create index if not exists attendance_list_participants_employee_idx
  on attendance_list_participants (employee_id);

-- Campos novos do item 1. Todos anuláveis: as linhas que já existem não têm
-- como preenchê-los retroativamente, e a tabela-pai é imutável (no_update),
-- então nem seria possível preencher depois.
--
-- `folder` é texto livre porque NÃO existe entidade de pasta no schema. Se a
-- intenção for pasta de verdade (hierarquia, navegação, filtro), isso é
-- funcionalidade à parte — aqui é só o rótulo de onde o registro deve ser
-- arquivado.
alter table meeting_minutes
  add column if not exists meeting_time time,
  add column if not exists speaker_name text,
  add column if not exists folder text;

alter table attendance_lists
  add column if not exists event_time time,
  add column if not exists speaker_name text,
  add column if not exists folder text;

-- ============================================================
-- RLS
-- ============================================================

alter table meeting_minute_participants enable row level security;

drop policy if exists meeting_minute_participants_select_org on meeting_minute_participants;
create policy meeting_minute_participants_select_org
  on meeting_minute_participants for select
  using (
    exists (
      select 1 from meeting_minutes m
      where m.id = meeting_minute_participants.meeting_minute_id
        and m.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

-- Quem cria a ata monta a lista de participantes: mesma régua de
-- meeting_minutes_insert_org (admin ou quality_manager).
drop policy if exists meeting_minute_participants_insert_org on meeting_minute_participants;
create policy meeting_minute_participants_insert_org
  on meeting_minute_participants for insert
  with check (
    exists (
      select 1 from meeting_minutes m
      where m.id = meeting_minute_id
        and m.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(m.org_id)
        and public.user_role_in_org(m.org_id) in ('admin', 'quality_manager')
    )
  );

-- UPDATE é a confirmação de presença, e SÓ o próprio participante confirma a
-- si mesmo — nem o gestor da qualidade confirma presença por outra pessoa,
-- senão a confirmação não vale como evidência. Mesmo padrão self-service que
-- employees já usa (linked_user_id = auth.uid()).
drop policy if exists meeting_minute_participants_confirm_self on meeting_minute_participants;
create policy meeting_minute_participants_confirm_self
  on meeting_minute_participants for update
  using (
    exists (
      select 1 from employees e
      where e.id = meeting_minute_participants.employee_id
        and e.linked_user_id = auth.uid()
        and public.org_can_write(e.org_id)
    )
  );

drop policy if exists meeting_minute_participants_no_delete on meeting_minute_participants;
create policy meeting_minute_participants_no_delete
  on meeting_minute_participants for delete
  using (false);

alter table attendance_list_participants enable row level security;

drop policy if exists attendance_list_participants_select_org on attendance_list_participants;
create policy attendance_list_participants_select_org
  on attendance_list_participants for select
  using (
    exists (
      select 1 from attendance_lists l
      where l.id = attendance_list_participants.attendance_list_id
        and l.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

drop policy if exists attendance_list_participants_insert_org on attendance_list_participants;
create policy attendance_list_participants_insert_org
  on attendance_list_participants for insert
  with check (
    exists (
      select 1 from attendance_lists l
      where l.id = attendance_list_id
        and l.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(l.org_id)
        and public.user_role_in_org(l.org_id) in ('admin', 'quality_manager')
    )
  );

drop policy if exists attendance_list_participants_confirm_self on attendance_list_participants;
create policy attendance_list_participants_confirm_self
  on attendance_list_participants for update
  using (
    exists (
      select 1 from employees e
      where e.id = attendance_list_participants.employee_id
        and e.linked_user_id = auth.uid()
        and public.org_can_write(e.org_id)
    )
  );

drop policy if exists attendance_list_participants_no_delete on attendance_list_participants;
create policy attendance_list_participants_no_delete
  on attendance_list_participants for delete
  using (false);

-- ============================================================
-- GRANTS (regra 21.1 — sem isto a API responde "permission denied" mesmo
-- com a policy correta, porque table auto-exposure está desligado)
-- ============================================================

grant select, insert, update on meeting_minute_participants to authenticated;
grant all on meeting_minute_participants to service_role;

grant select, insert, update on attendance_list_participants to authenticated;
grant all on attendance_list_participants to service_role;

-- ============================================================
-- RPCs de criação: pai + participantes na MESMA transação.
--
-- Sem isto, o cliente teria que fazer dois passos (insert da ata, depois
-- insert dos participantes). Se o segundo falhasse, sobraria uma ata sem
-- participante nenhum — e como meeting_minutes tem policy `no_update`, não
-- daria para corrigir o registro, só criar outro por cima.
--
-- security invoker: rodam com o papel de quem chamou, então as policies de
-- insert declaradas acima (admin/quality_manager) continuam valendo sem
-- precisar repetir a checagem aqui dentro.
--
-- Os gatilhos de notificação disparam por linha inserida em
-- *_participants — portanto rodam dentro desta transação, e se a criação
-- for revertida nenhuma notificação sobra.
-- ============================================================

create or replace function public.create_meeting_minute_with_participants(
  p_title text,
  p_meeting_date date,
  p_agenda text,
  p_deliberations text,
  p_employee_ids uuid[],
  p_meeting_time time default null,
  p_speaker_name text default null,
  p_folder text default null
)
returns meeting_minutes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result meeting_minutes;
begin
  insert into meeting_minutes (
    title, meeting_date, agenda, deliberations, meeting_time, speaker_name, folder
  )
  values (
    p_title, p_meeting_date, p_agenda, p_deliberations, p_meeting_time, p_speaker_name, p_folder
  )
  returning * into v_result;

  -- distinct: o seletor por cargo e o seletor por pessoa podem trazer a
  -- mesma pessoa duas vezes; sem isto o unique (ata, employee) derrubaria
  -- a criação inteira por um clique duplicado do usuário.
  insert into meeting_minute_participants (meeting_minute_id, employee_id)
  select v_result.id, x
    from unnest(coalesce(p_employee_ids, '{}'::uuid[])) as x
   group by x;

  return v_result;
end;
$$;

create or replace function public.create_attendance_list_with_participants(
  p_event_title text,
  p_event_date date,
  p_employee_ids uuid[],
  p_event_time time default null,
  p_speaker_name text default null,
  p_folder text default null
)
returns attendance_lists
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result attendance_lists;
begin
  insert into attendance_lists (
    event_title, event_date, event_time, speaker_name, folder
  )
  values (
    p_event_title, p_event_date, p_event_time, p_speaker_name, p_folder
  )
  returning * into v_result;

  insert into attendance_list_participants (attendance_list_id, employee_id)
  select v_result.id, x
    from unnest(coalesce(p_employee_ids, '{}'::uuid[])) as x
   group by x;

  return v_result;
end;
$$;

-- ============================================================
-- RPC de confirmação de presença.
--
-- security invoker de propósito: a policy *_confirm_self é que garante que
-- ninguém confirma presença por outra pessoa. Se fosse definer, a checagem
-- sumiria e qualquer um poderia confirmar por qualquer um.
-- ============================================================

create or replace function public.confirm_meeting_attendance(
  p_participant_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update meeting_minute_participants
     set confirmed = true, confirmed_at = now()
   where id = p_participant_id and confirmed = false;

  if not found then
    -- Também cai aqui quando a linha existe mas pertence a outra pessoa: a
    -- RLS simplesmente não a enxerga para update.
    raise exception 'Participação não encontrada, já confirmada, ou não é sua';
  end if;
end;
$$;

create or replace function public.confirm_attendance_list_presence(
  p_participant_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update attendance_list_participants
     set confirmed = true, confirmed_at = now()
   where id = p_participant_id and confirmed = false;

  if not found then
    raise exception 'Participação não encontrada, já confirmada, ou não é sua';
  end if;
end;
$$;
