-- RLS de swot_analyses/swot_cards. Mesmo padrão de indicators (sem
-- user_has_unit_access, não há unit_id nestas tabelas) + org_can_write()
-- desde o início (seção 7 do Guia — a trava de inadimplência já é padrão
-- para módulo novo, não precisa de migração de correção depois como
-- aconteceu com ncs/action_plans/audits em 20260801110100).

alter table swot_analyses enable row level security;

create policy swot_analyses_select_org
  on swot_analyses for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy swot_analyses_insert_org
  on swot_analyses for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy swot_analyses_update_org
  on swot_analyses for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

-- DELETE bloqueado — nada apaga (seção 2 do Guia).
create policy swot_analyses_no_delete
  on swot_analyses for delete
  using (false);

alter table swot_cards enable row level security;

create policy swot_cards_select_org
  on swot_cards for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy swot_cards_insert_org
  on swot_cards for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy swot_cards_update_org
  on swot_cards for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy swot_cards_no_delete
  on swot_cards for delete
  using (false);
