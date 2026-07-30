-- RLS do módulo de Indicadores. Mesmo mecanismo de ncs/action_plans/audits:
-- JWT custom claim (auth.jwt() ->> 'org_id'), sem current_setting. Sem
-- escopo de unidade (nenhuma destas tabelas tem unit_id).

alter table quality_objectives enable row level security;

create policy quality_objectives_select_org
  on quality_objectives for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy quality_objectives_insert_org
  on quality_objectives for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy quality_objectives_update_org
  on quality_objectives for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- DELETE bloqueado — objetivo só arquiva, nunca apaga (seção 2 do Guia).
create policy quality_objectives_no_delete
  on quality_objectives for delete
  using (false);

alter table indicators enable row level security;

create policy indicators_select_org
  on indicators for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy indicators_insert_org
  on indicators for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy indicators_update_org
  on indicators for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- DELETE bloqueado — indicador só arquiva, nunca apaga.
create policy indicators_no_delete
  on indicators for delete
  using (false);

alter table indicator_measurements enable row level security;

create policy indicator_measurements_select_org
  on indicator_measurements for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy indicator_measurements_insert_org
  on indicator_measurements for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy indicator_measurements_update_org
  on indicator_measurements for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- DELETE bloqueado — nada apaga, nem medição.
create policy indicator_measurements_no_delete
  on indicator_measurements for delete
  using (false);

-- indicator_target_history não tem org_id próprio (filho único de
-- `indicators`, mesmo espírito das tabelas filhas de audits — seguro porque
-- todo filho tem exatamente um pai com on delete cascade, e nenhuma linha é
-- referenciada por mais de uma organização). RLS via join contra o pai.
alter table indicator_target_history enable row level security;

create policy indicator_target_history_select_org
  on indicator_target_history for select
  using (
    exists (
      select 1 from indicators i
      where i.id = indicator_target_history.indicator_id
        and i.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy indicator_target_history_insert_org
  on indicator_target_history for insert
  with check (
    exists (
      select 1 from indicators i
      where i.id = indicator_target_history.indicator_id
        and i.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy indicator_target_history_update_org
  on indicator_target_history for update
  using (
    exists (
      select 1 from indicators i
      where i.id = indicator_target_history.indicator_id
        and i.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

-- DELETE bloqueado — histórico de meta nunca apaga (é o que sustenta o
-- gráfico de duas linhas).
create policy indicator_target_history_no_delete
  on indicator_target_history for delete
  using (false);

alter table critical_analysis_periods enable row level security;

create policy critical_analysis_periods_select_org
  on critical_analysis_periods for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy critical_analysis_periods_insert_org
  on critical_analysis_periods for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy critical_analysis_periods_update_org
  on critical_analysis_periods for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy critical_analysis_periods_no_delete
  on critical_analysis_periods for delete
  using (false);

-- indicator_code_counters: RLS ligada sem nenhuma política (nega tudo por
-- padrão a authenticated/anon/service_role) — só a trigger SECURITY DEFINER
-- dona da tabela grava nela. Mesmo padrão de nc_code_counters.
alter table indicator_code_counters enable row level security;
