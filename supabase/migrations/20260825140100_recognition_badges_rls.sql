-- RLS de recognition_badge_events. Leitura liberada pra qualquer membro
-- da própria org (conteúdo de dashboard/engajamento, não sensível — seção
-- "RLS" do prompt desta aba). Escrita só acontece via trigger/cron
-- SECURITY DEFINER (20260825140200), que roda como dono da tabela e
-- ignora RLS — as políticas de insert/update/delete abaixo são só
-- blindagem contra escrita direta do client, nunca usadas no caminho
-- normal.

alter table recognition_badge_events enable row level security;

create policy recognition_badge_events_select_org
  on recognition_badge_events for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy recognition_badge_events_no_insert
  on recognition_badge_events for insert
  with check (false);

create policy recognition_badge_events_no_update
  on recognition_badge_events for update
  using (false);

create policy recognition_badge_events_no_delete
  on recognition_badge_events for delete
  using (false);
