-- RLS de org_climate_surveys e org_climate_survey_responses.
--
-- Governança confirmada com o Matheus: quem PROGRAMA a pesquisa e vê
-- resultado agregado é Administrador + Gestor da Qualidade
-- (is_hr_authorized) — deliberadamente DIFERENTE da régua de avaliação de
-- pessoas (admin+area_manager, 20260912090200), que é liderança de
-- pessoas, não módulo de qualidade.
--
-- Quem RESPONDE é qualquer membro ativo da organização — a janela em si
-- (org_climate_surveys) é visível a todo mundo para que se saiba que há
-- pesquisa aberta; o conteúdo de cada resposta (org_climate_survey_responses)
-- só é visível a quem respondeu (a própria linha) e a quem tem governança.

alter table org_climate_surveys enable row level security;

create policy org_climate_surveys_select_org
  on org_climate_surveys for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy org_climate_surveys_insert_org
  on org_climate_surveys for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.is_hr_authorized(org_id)
  );

create policy org_climate_surveys_no_update
  on org_climate_surveys for update
  using (false);

create policy org_climate_surveys_no_delete
  on org_climate_surveys for delete
  using (false);

alter table org_climate_survey_responses enable row level security;

create policy org_climate_survey_responses_select_own_or_hr
  on org_climate_survey_responses for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (user_id = auth.uid() or public.is_hr_authorized(org_id))
  );

-- Gate de janela é real (não só UI): só dá pra responder dentro do período
-- programado, e só a própria pessoa responde por si mesma.
create policy org_climate_survey_responses_insert_self
  on org_climate_survey_responses for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and user_id = auth.uid()
    and exists (
      select 1 from org_climate_surveys s
      where s.id = survey_id
        and s.org_id = org_climate_survey_responses.org_id
        and current_date between s.janela_inicio and s.janela_fim
    )
  );

create policy org_climate_survey_responses_no_update
  on org_climate_survey_responses for update
  using (false);

create policy org_climate_survey_responses_no_delete
  on org_climate_survey_responses for delete
  using (false);
