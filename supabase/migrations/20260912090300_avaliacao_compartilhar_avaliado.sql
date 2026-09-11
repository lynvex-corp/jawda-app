-- Bloco 4, item 7: falta o toggle "Compartilhar com o avaliado" mostrado no
-- print de referência — não existe coluna nenhuma para isso hoje.
--
-- Confidencialidade por padrão (false): a avaliação só é visível ao
-- avaliado quando o avaliador decide compartilhar explicitamente. Sem essa
-- coluna, a devolutiva ficaria sempre invisível para quem foi avaliado, ou
-- sempre visível — nenhuma das duas é a regra descrita no print
-- ("Ao avaliado são compartilhados os itens e notas do CHA, a nota geral e
-- o registro da devolutiva" — implica que é uma decisão, não um padrão
-- fixo).
--
-- Fica em performance_feedback (não em performance_evaluations) porque só
-- faz sentido compartilhar depois que existe devolutiva para compartilhar.

alter table performance_feedback
  add column if not exists compartilhado_com_avaliado boolean not null default false;

-- ============================================================
-- SELECT do avaliado sobre a própria avaliação — hoje só existe leitura
-- para admin e para o próprio avaliador (can_see_performance_evaluation).
-- O avaliado nunca conseguia ver a própria avaliação, nem quando
-- compartilhada — a coluna acima ficaria sem efeito sem esta policy.
-- ============================================================

create or replace function public.can_evaluatee_see_evaluation(p_evaluation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from performance_evaluations e
    join employees emp on emp.id = e.employee_id
    join performance_feedback f on f.evaluation_id = e.id
    where e.id = p_evaluation_id
      and emp.linked_user_id = auth.uid()
      and f.compartilhado_com_avaliado
  );
$$;

drop policy if exists performance_evaluations_select_org on performance_evaluations;
create policy performance_evaluations_select_org
  on performance_evaluations for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (
      public.can_see_performance_evaluation(org_id, avaliador_user_id)
      or public.can_evaluatee_see_evaluation(id)
    )
  );

drop policy if exists performance_cha_answers_select_org on performance_cha_answers;
create policy performance_cha_answers_select_org
  on performance_cha_answers for select
  using (
    exists (
      select 1 from performance_evaluations e
      where e.id = performance_cha_answers.evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and (
          public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
          or public.can_evaluatee_see_evaluation(e.id)
        )
    )
  );

drop policy if exists performance_decision_matrix_select_org on performance_decision_matrix;
create policy performance_decision_matrix_select_org
  on performance_decision_matrix for select
  using (
    exists (
      select 1 from performance_evaluations e
      where e.id = performance_decision_matrix.evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and (
          public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
          or public.can_evaluatee_see_evaluation(e.id)
        )
    )
  );

drop policy if exists performance_feedback_select_org on performance_feedback;
create policy performance_feedback_select_org
  on performance_feedback for select
  using (
    exists (
      select 1 from performance_evaluations e
      where e.id = performance_feedback.evaluation_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and (
          public.can_see_performance_evaluation(e.org_id, e.avaliador_user_id)
          or public.can_evaluatee_see_evaluation(e.id)
        )
    )
  );
