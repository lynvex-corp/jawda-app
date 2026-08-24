-- RLS de Gestão de Aprendizagem. Padrão comum de módulo de negócio
-- (org_id + org_can_write) — sem o travamento extra de employees (esta
-- sub-aba não guarda ASO nem documento pessoal).

alter table trainings enable row level security;

create policy trainings_select_org
  on trainings for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy trainings_insert_org
  on trainings for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy trainings_update_org
  on trainings for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy trainings_no_delete
  on trainings for delete
  using (false);

alter table training_applicability enable row level security;

create policy training_applicability_select_org
  on training_applicability for select
  using (
    exists (
      select 1 from trainings t
      where t.id = training_applicability.training_id and t.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy training_applicability_insert_org
  on training_applicability for insert
  with check (
    exists (
      select 1 from trainings t
      where t.id = training_id
        and t.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(t.org_id)
    )
  );

create policy training_applicability_no_update
  on training_applicability for update
  using (false);

create policy training_applicability_no_delete
  on training_applicability for delete
  using (false);

alter table training_sessions enable row level security;

create policy training_sessions_select_org
  on training_sessions for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy training_sessions_insert_org
  on training_sessions for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy training_sessions_update_org
  on training_sessions for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy training_sessions_no_delete
  on training_sessions for delete
  using (false);

alter table training_participants enable row level security;

create policy training_participants_select_org
  on training_participants for select
  using (
    exists (
      select 1 from training_sessions s
      where s.id = training_participants.training_session_id
        and s.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy training_participants_insert_org
  on training_participants for insert
  with check (
    exists (
      select 1 from training_sessions s
      where s.id = training_session_id
        and s.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(s.org_id)
    )
  );

create policy training_participants_update_org
  on training_participants for update
  using (
    exists (
      select 1 from training_sessions s
      where s.id = training_participants.training_session_id
        and s.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(s.org_id)
    )
  );

create policy training_participants_no_delete
  on training_participants for delete
  using (false);

alter table awareness_publications enable row level security;

create policy awareness_publications_select_org
  on awareness_publications for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy awareness_publications_insert_org
  on awareness_publications for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy awareness_publications_no_update
  on awareness_publications for update
  using (false);

create policy awareness_publications_no_delete
  on awareness_publications for delete
  using (false);

alter table awareness_quiz_options enable row level security;

create policy awareness_quiz_options_select_org
  on awareness_quiz_options for select
  using (
    exists (
      select 1 from awareness_publications p
      where p.id = awareness_quiz_options.publication_id and p.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy awareness_quiz_options_insert_org
  on awareness_quiz_options for insert
  with check (
    exists (
      select 1 from awareness_publications p
      where p.id = publication_id
        and p.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(p.org_id)
    )
  );

create policy awareness_quiz_options_no_update
  on awareness_quiz_options for update
  using (false);

create policy awareness_quiz_options_no_delete
  on awareness_quiz_options for delete
  using (false);

alter table awareness_acknowledgments enable row level security;

create policy awareness_acknowledgments_select_org
  on awareness_acknowledgments for select
  using (
    exists (
      select 1 from awareness_publications p
      where p.id = awareness_acknowledgments.publication_id and p.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy awareness_acknowledgments_insert_org
  on awareness_acknowledgments for insert
  with check (
    exists (
      select 1 from awareness_publications p
      where p.id = publication_id
        and p.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(p.org_id)
    )
  );

create policy awareness_acknowledgments_no_update
  on awareness_acknowledgments for update
  using (false);

create policy awareness_acknowledgments_no_delete
  on awareness_acknowledgments for delete
  using (false);
