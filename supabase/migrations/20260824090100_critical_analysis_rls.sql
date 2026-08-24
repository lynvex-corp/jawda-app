-- RLS de critical_analysis_*. org_can_write() desde o início (seção 7).
--
-- Regras de edição por estado (além de org_id/org_can_write):
--   agenda_items: insert permitido com a reunião em 'programada' ou
--     'em_andamento' (escolher/ajustar pautas); update (preencher
--     "conteúdo analisado"/"comentários") só com a reunião 'em_andamento'
--     — é a "tela de execução da ata" do prompt.
--   participants: attended/approved só mexem com a reunião não encerrada;
--     a trava fina de "só o próprio participante aprova a própria linha,
--     e só quando a reunião está aguardando_aprovacao" fica no trigger
--     (20260824090200), não dá pra expressar em RLS simples porque
--     depende de qual campo mudou.
--   action_items: livre enquanto a reunião não está concluída/anulada.
--
-- critical_analysis_meetings em si: trava de conteúdo (não editar depois
-- de aguardando_aprovacao/concluida, exceto a própria transição) fica no
-- trigger de 20260824090200 — mesma lição aprendida com scope_documents
-- (20260823131200_estrategia_scope_fix_immutable_vigente).

create or replace function public.critical_analysis_org_can_write(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(m.org_id)
      from critical_analysis_meetings m
      where m.id = p_meeting_id
    ),
    false
  );
$$;

alter table critical_analysis_meetings enable row level security;

create policy critical_analysis_meetings_select_org
  on critical_analysis_meetings for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy critical_analysis_meetings_insert_org
  on critical_analysis_meetings for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy critical_analysis_meetings_update_org
  on critical_analysis_meetings for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy critical_analysis_meetings_no_delete
  on critical_analysis_meetings for delete
  using (false);

alter table critical_analysis_agenda_items enable row level security;

create policy critical_analysis_agenda_items_select_org
  on critical_analysis_agenda_items for select
  using (
    exists (
      select 1 from critical_analysis_meetings m
      where m.id = critical_analysis_agenda_items.meeting_id
        and m.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy critical_analysis_agenda_items_insert_org
  on critical_analysis_agenda_items for insert
  with check (
    exists (
      select 1 from critical_analysis_meetings m
      where m.id = meeting_id
        and m.status in ('programada', 'em_andamento')
        and public.critical_analysis_org_can_write(m.id)
    )
  );

create policy critical_analysis_agenda_items_update_org
  on critical_analysis_agenda_items for update
  using (
    exists (
      select 1 from critical_analysis_meetings m
      where m.id = critical_analysis_agenda_items.meeting_id
        and m.status = 'em_andamento'
        and public.critical_analysis_org_can_write(m.id)
    )
  );

create policy critical_analysis_agenda_items_no_delete
  on critical_analysis_agenda_items for delete
  using (false);

alter table critical_analysis_participants enable row level security;

create policy critical_analysis_participants_select_org
  on critical_analysis_participants for select
  using (
    exists (
      select 1 from critical_analysis_meetings m
      where m.id = critical_analysis_participants.meeting_id
        and m.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy critical_analysis_participants_insert_org
  on critical_analysis_participants for insert
  with check (
    exists (
      select 1 from critical_analysis_meetings m
      where m.id = meeting_id
        and m.status in ('programada', 'em_andamento')
        and public.critical_analysis_org_can_write(m.id)
    )
  );

create policy critical_analysis_participants_update_org
  on critical_analysis_participants for update
  using (
    exists (
      select 1 from critical_analysis_meetings m
      where m.id = critical_analysis_participants.meeting_id
        and m.status not in ('concluida', 'anulada')
        and public.critical_analysis_org_can_write(m.id)
    )
  );

create policy critical_analysis_participants_no_delete
  on critical_analysis_participants for delete
  using (false);

alter table critical_analysis_action_items enable row level security;

create policy critical_analysis_action_items_select_org
  on critical_analysis_action_items for select
  using (
    exists (
      select 1 from critical_analysis_meetings m
      where m.id = critical_analysis_action_items.meeting_id
        and m.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy critical_analysis_action_items_insert_org
  on critical_analysis_action_items for insert
  with check (
    exists (
      select 1 from critical_analysis_meetings m
      where m.id = meeting_id
        and m.status not in ('concluida', 'anulada')
        and public.critical_analysis_org_can_write(m.id)
    )
  );

create policy critical_analysis_action_items_update_org
  on critical_analysis_action_items for update
  using (
    exists (
      select 1 from critical_analysis_meetings m
      where m.id = critical_analysis_action_items.meeting_id
        and public.critical_analysis_org_can_write(m.id)
    )
  );

create policy critical_analysis_action_items_no_delete
  on critical_analysis_action_items for delete
  using (false);
