-- RLS de hr_learning_settings, training_session_feedback e
-- training_effectiveness_evaluations. Mesmo padrão de acesso pessoal usado
-- em awareness_terms_signatures (20260825090100): só o próprio funcionário
-- insere sua própria avaliação de satisfação; RH (is_hr_authorized) e o
-- próprio participante leem.

alter table hr_learning_settings enable row level security;

-- Leitura livre pra todo mundo da org: o gate de prazo (>4h + dias
-- corridos) é calculado na UI, todo mundo com acesso ao módulo precisa
-- conseguir ler a configuração pra saber quando uma turma fica elegível.
create policy hr_learning_settings_select_org
  on hr_learning_settings for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy hr_learning_settings_upsert_hr
  on hr_learning_settings for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.is_hr_authorized(org_id));

create policy hr_learning_settings_update_hr
  on hr_learning_settings for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.is_hr_authorized(org_id));

create policy hr_learning_settings_no_delete
  on hr_learning_settings for delete
  using (false);

alter table training_session_feedback enable row level security;

create policy training_session_feedback_select_org
  on training_session_feedback for select
  using (
    exists (
      select 1 from training_sessions s
      where s.id = training_session_feedback.training_session_id
        and s.org_id = (auth.jwt() ->> 'org_id')::uuid
        and (
          public.is_hr_authorized(s.org_id)
          or exists (
            select 1 from employees e
            where e.id = training_session_feedback.employee_id and e.linked_user_id = auth.uid()
          )
        )
    )
  );

-- Só o próprio participante avalia a própria satisfação — nunca RH
-- respondendo em nome de alguém, e só de turma em que de fato participou.
create policy training_session_feedback_insert_self
  on training_session_feedback for insert
  with check (
    exists (
      select 1 from training_sessions s
      join training_participants tp
        on tp.training_session_id = s.id and tp.employee_id = training_session_feedback.employee_id
      join employees e on e.id = training_session_feedback.employee_id
      where s.id = training_session_id
        and s.org_id = (auth.jwt() ->> 'org_id')::uuid
        and s.status = 'realizada'
        and e.linked_user_id = auth.uid()
    )
  );

create policy training_session_feedback_no_update
  on training_session_feedback for update
  using (false);

create policy training_session_feedback_no_delete
  on training_session_feedback for delete
  using (false);

alter table training_effectiveness_evaluations enable row level security;

create policy training_effectiveness_evaluations_select_org
  on training_effectiveness_evaluations for select
  using (
    exists (
      select 1 from training_sessions s
      where s.id = training_effectiveness_evaluations.training_session_id
        and s.org_id = (auth.jwt() ->> 'org_id')::uuid
        and (
          public.is_hr_authorized(s.org_id)
          or exists (
            select 1 from training_participants tp
            join employees e on e.id = tp.employee_id
            where tp.training_session_id = s.id and e.linked_user_id = auth.uid()
          )
        )
    )
  );

-- Gate de segurança real (não só sugestão de UI): não dá para avaliar
-- eficácia de turma que ainda não aconteceu. O gate de "carga horária >4h"
-- e "prazo configurável vencido" ficam só na UI — são regra de fluxo de
-- trabalho, não de segurança, e podem precisar de exceção manual no futuro
-- sem exigir nova migração.
create policy training_effectiveness_evaluations_insert_org
  on training_effectiveness_evaluations for insert
  with check (
    exists (
      select 1 from training_sessions s
      where s.id = training_session_id
        and s.org_id = (auth.jwt() ->> 'org_id')::uuid
        and s.status = 'realizada'
        and public.is_hr_authorized(s.org_id)
    )
  );

create policy training_effectiveness_evaluations_update_org
  on training_effectiveness_evaluations for update
  using (
    exists (
      select 1 from training_sessions s
      where s.id = training_effectiveness_evaluations.training_session_id
        and s.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.is_hr_authorized(s.org_id)
    )
  );

create policy training_effectiveness_evaluations_no_delete
  on training_effectiveness_evaluations for delete
  using (false);
