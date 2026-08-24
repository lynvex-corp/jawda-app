-- RLS de Cargos e Perfis. job_positions/job_position_trainings seguem o
-- padrão comum de qualquer tabela de negócio (org_id + org_can_write).
-- employees/employee_attachments/competency_actions/
-- awareness_terms_signatures são as sensíveis — SELECT restrito a
-- role IN ('admin','quality_manager') OU ao próprio funcionário
-- (employees.linked_user_id = auth.uid()), conforme seção 18 do prompt
-- desta aba.
--
-- DECISÃO SOBRE GRANT (pedida explicitamente no prompt desta aba):
-- mantive o GRANT padrão (select/insert/update a `authenticated`, seção
-- 21.1), em vez de revogar SELECT e forçar toda leitura por RPC. Motivo:
--   1. GRANT é um controle grosso (a tabela inteira); RLS é o controle
--      real, linha a linha. Um Colaborador comum consultando `employees`
--      direto recebe ZERO linhas de qualquer outra pessoa, com ou sem
--      GRANT — a confidencialidade já está 100% garantida pela política
--      abaixo, não pelo GRANT.
--   2. Tentei o caminho "sem GRANT, só via RPC": esbarra em um problema
--      real do Postgres, não só de gosto — uma função SECURITY INVOKER
--      sem GRANT na tabela simplesmente falha (o chamador não tem
--      privilégio nenhum), e uma função SECURITY DEFINER *ignora* RLS
--      por padrão, o que obrigaria reimplementar a checagem de acesso
--      à mão dentro da função — duplicando a lógica de segurança em dois
--      lugares (a política E a função) com risco real de um dia
--      divergir. Isso é pior pra segurança do sistema no longo prazo do
--      que manter uma única fonte de verdade (a política de RLS).
--   3. O ganho real de "forçar tudo por RPC" seria só viabilizar log
--      obrigatório de leitura (Postgres não dispara trigger em SELECT,
--      então não dá pra logar leitura só com trigger — ver
--      20260825090200). Esse ganho específico eu resolvo de um jeito
--      mais simples e sem duplicar a checagem de acesso: uma RPC
--      pequena e independente (log_employee_dossie_access), chamada
--      pelo frontend no momento em que a tela de dossiê individual abre,
--      que só grava o log — não é ela quem decide se os dados podem ser
--      lidos, só registra que a leitura aconteceu. Um bug ou chamada
--      direta que pule essa RPC deixa uma lacuna na trilha de auditoria
--      (sabemos que os dados só foram vistos por quem já tinha
--      permissão), nunca uma exposição de dado — a política de RLS
--      continua sendo a única barreira real, e ela não tem como ser
--      contornada por fora do banco.
-- DELETE nunca é concedido em nenhuma tabela deste módulo (nada apaga).

create or replace function public.is_hr_authorized(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_organizations
    where user_id = auth.uid() and org_id = p_org_id and is_active
      and role in ('admin', 'quality_manager')
  );
$$;

alter table job_positions enable row level security;

create policy job_positions_select_org
  on job_positions for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy job_positions_insert_org
  on job_positions for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy job_positions_update_org
  on job_positions for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy job_positions_no_delete
  on job_positions for delete
  using (false);

alter table job_position_trainings enable row level security;

create policy job_position_trainings_select_org
  on job_position_trainings for select
  using (
    exists (
      select 1 from job_positions p
      where p.id = job_position_trainings.job_position_id
        and p.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy job_position_trainings_insert_org
  on job_position_trainings for insert
  with check (
    exists (
      select 1 from job_positions p
      where p.id = job_position_id
        and p.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(p.org_id)
    )
  );

create policy job_position_trainings_update_org
  on job_position_trainings for update
  using (
    exists (
      select 1 from job_positions p
      where p.id = job_position_trainings.job_position_id
        and p.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(p.org_id)
    )
  );

create policy job_position_trainings_no_delete
  on job_position_trainings for delete
  using (false);

alter table employees enable row level security;

create policy employees_select_org
  on employees for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (public.is_hr_authorized(org_id) or linked_user_id = auth.uid())
  );

create policy employees_insert_org
  on employees for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.is_hr_authorized(org_id)
    and public.org_can_write(org_id)
  );

create policy employees_update_org
  on employees for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.is_hr_authorized(org_id)
    and public.org_can_write(org_id)
  );

create policy employees_no_delete
  on employees for delete
  using (false);

alter table employee_attachments enable row level security;

create policy employee_attachments_select_org
  on employee_attachments for select
  using (
    exists (
      select 1 from employees e
      where e.id = employee_attachments.employee_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and (public.is_hr_authorized(e.org_id) or e.linked_user_id = auth.uid())
    )
  );

create policy employee_attachments_insert_org
  on employee_attachments for insert
  with check (
    exists (
      select 1 from employees e
      where e.id = employee_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.is_hr_authorized(e.org_id)
        and public.org_can_write(e.org_id)
    )
  );

create policy employee_attachments_no_update
  on employee_attachments for update
  using (false);

create policy employee_attachments_no_delete
  on employee_attachments for delete
  using (false);

alter table competency_actions enable row level security;

create policy competency_actions_select_org
  on competency_actions for select
  using (
    exists (
      select 1 from employees e
      where e.id = competency_actions.employee_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and (public.is_hr_authorized(e.org_id) or e.linked_user_id = auth.uid())
    )
  );

create policy competency_actions_insert_org
  on competency_actions for insert
  with check (
    exists (
      select 1 from employees e
      where e.id = employee_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.is_hr_authorized(e.org_id)
        and public.org_can_write(e.org_id)
    )
  );

create policy competency_actions_update_org
  on competency_actions for update
  using (
    exists (
      select 1 from employees e
      where e.id = competency_actions.employee_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.is_hr_authorized(e.org_id)
        and public.org_can_write(e.org_id)
    )
  );

create policy competency_actions_no_delete
  on competency_actions for delete
  using (false);

alter table lgpd_acceptances enable row level security;

create policy lgpd_acceptances_select_own_or_hr
  on lgpd_acceptances for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (user_id = auth.uid() or public.is_hr_authorized(org_id))
  );

create policy lgpd_acceptances_insert_own
  on lgpd_acceptances for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and user_id = auth.uid());

create policy lgpd_acceptances_no_update
  on lgpd_acceptances for update
  using (false);

create policy lgpd_acceptances_no_delete
  on lgpd_acceptances for delete
  using (false);

alter table awareness_terms_signatures enable row level security;

create policy awareness_terms_signatures_select_org
  on awareness_terms_signatures for select
  using (
    exists (
      select 1 from employees e
      where e.id = awareness_terms_signatures.employee_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and (public.is_hr_authorized(e.org_id) or e.linked_user_id = auth.uid())
    )
  );

-- Só o próprio funcionário assina o próprio termo (nunca RH assinando em
-- nome de alguém — a assinatura perderia o sentido).
create policy awareness_terms_signatures_insert_self
  on awareness_terms_signatures for insert
  with check (
    exists (
      select 1 from employees e
      where e.id = employee_id
        and e.org_id = (auth.jwt() ->> 'org_id')::uuid
        and e.linked_user_id = auth.uid()
        and public.org_can_write(e.org_id)
    )
  );

create policy awareness_terms_signatures_no_update
  on awareness_terms_signatures for update
  using (false);

create policy awareness_terms_signatures_no_delete
  on awareness_terms_signatures for delete
  using (false);
