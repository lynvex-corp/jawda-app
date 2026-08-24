-- RLS de Avaliação de Desempenho. performance_cycles é catálogo/config,
-- sem dado pessoal — leitura org-wide, como trainings. As demais seguem a
-- regra explícita do prompt: o usuário vê a avaliação se
-- avaliador_user_id = auth.uid() OU se o perfil dele é 'admin' (Alta
-- Direção). Gestor da Qualidade só vê se ele mesmo for o avaliador de
-- alguma avaliação específica — resolvido sozinho pela condição acima,
-- sem checar role nenhum além de 'admin'.

alter table performance_cycles enable row level security;

create policy performance_cycles_select_org
  on performance_cycles for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy performance_cycles_insert_org
  on performance_cycles for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy performance_cycles_update_org
  on performance_cycles for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy performance_cycles_no_delete
  on performance_cycles for delete
  using (false);

create or replace function public.can_see_performance_evaluation(p_org_id uuid, p_avaliador_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_avaliador_user_id = auth.uid() or public.user_role_in_org(p_org_id) = 'admin';
$$;

alter table performance_evaluations enable row level security;

create policy performance_evaluations_select_org
  on performance_evaluations for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.can_see_performance_evaluation(org_id, avaliador_user_id)
  );

-- Quem programa a avaliação (RH/Gestão) não precisa ser o avaliador —
-- só precisa poder escrever na org. A visibilidade de quem programou sem
-- ser o avaliador nem admin fica resolvida pela política de select acima
-- (não vê mais depois de criar, a não ser que seja admin ou o próprio
-- avaliador) — comportamento intencional, evita vazar avaliação de
-- terceiros pra quem só agenda o ciclo.
create policy performance_evaluations_insert_org
  on performance_evaluations for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy performance_evaluations_update_org
  on performance_evaluations for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.can_see_performance_evaluation(org_id, avaliador_user_id)
    and public.org_can_write(org_id)
  );

create policy performance_evaluations_no_delete
  on performance_evaluations for delete
  using (false);

alter table performance_cha_answers enable row level security;

create policy performance_cha_answers_select_org
  on performance_cha_answers for select
  using (
    exists (
      select 1 from performance_evaluations e
      where e.id = performance_cha_answers.evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
    )
  );

create policy performance_cha_answers_insert_org
  on performance_cha_answers for insert
  with check (
    exists (
      select 1 from performance_evaluations e
      where e.id = evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
        and public.org_can_write(e.org_id)
    )
  );

create policy performance_cha_answers_update_org
  on performance_cha_answers for update
  using (
    exists (
      select 1 from performance_evaluations e
      where e.id = performance_cha_answers.evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
        and public.org_can_write(e.org_id)
    )
  );

create policy performance_cha_answers_no_delete
  on performance_cha_answers for delete
  using (false);

alter table performance_decision_matrix enable row level security;

create policy performance_decision_matrix_select_org
  on performance_decision_matrix for select
  using (
    exists (
      select 1 from performance_evaluations e
      where e.id = performance_decision_matrix.evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
    )
  );

create policy performance_decision_matrix_insert_org
  on performance_decision_matrix for insert
  with check (
    exists (
      select 1 from performance_evaluations e
      where e.id = evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
        and public.org_can_write(e.org_id)
    )
  );

create policy performance_decision_matrix_update_org
  on performance_decision_matrix for update
  using (
    exists (
      select 1 from performance_evaluations e
      where e.id = performance_decision_matrix.evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
        and public.org_can_write(e.org_id)
    )
  );

create policy performance_decision_matrix_no_delete
  on performance_decision_matrix for delete
  using (false);

alter table performance_feedback enable row level security;

create policy performance_feedback_select_org
  on performance_feedback for select
  using (
    exists (
      select 1 from performance_evaluations e
      where e.id = performance_feedback.evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
    )
  );

create policy performance_feedback_insert_org
  on performance_feedback for insert
  with check (
    exists (
      select 1 from performance_evaluations e
      where e.id = evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
        and public.org_can_write(e.org_id)
    )
  );

create policy performance_feedback_update_org
  on performance_feedback for update
  using (
    exists (
      select 1 from performance_evaluations e
      where e.id = performance_feedback.evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
        and public.org_can_write(e.org_id)
    )
  );

create policy performance_feedback_no_delete
  on performance_feedback for delete
  using (false);
