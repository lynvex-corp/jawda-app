-- Bloco 4, itens 1 e 4.
--
-- ITEM 4 — Gestor de Área ganha acesso a cargos/pessoas/matriz de
-- treinamento. Função NOVA (can_manage_hr_structure), não uma extensão de
-- is_hr_authorized: essa função também protege employee_attachments,
-- competency_actions, lgpd_acceptances e awareness_terms_signatures — dado
-- sensível (ASO, documento pessoal), que o item 4 não pediu para abrir a
-- Gestor de Área. Ampliar is_hr_authorized vazaria isso de brinde. A função
-- nova cobre só o que o item pediu: cargos (job_positions), pessoas
-- (employees) e matriz de treinamento (job_position_trainings).
--
-- job_positions e job_position_trainings hoje só exigem org_can_write no
-- INSERT/UPDATE — qualquer membro com escrita cria cargo. Isso não é
-- extensão, é aperto: a partir desta migração, cargo e matriz de
-- treinamento passam a exigir papel também, coisa que nunca tiveram.
--
-- ITEM 1 — "Excluir" em Cargos e Perfis. employees e job_positions têm
-- DELETE bloqueado (using (false), seção 20 do Guia — nada apaga). Vira
-- inativação: is_active novo nas duas tabelas, sem motivo obrigatório
-- (decisão explícita — card de rascunho ou cadastro errado não precisa de
-- justificativa para corrigir). Mesmo padrão do soft delete dos cards do
-- SWOT no Bloco 2.

create or replace function public.can_manage_hr_structure(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_organizations
    where user_id = auth.uid() and org_id = p_org_id and is_active
      and role in ('admin', 'quality_manager', 'area_manager')
  );
$$;

-- ---- is_active ----

alter table employees
  add column if not exists is_active boolean not null default true;

alter table job_positions
  add column if not exists is_active boolean not null default true;

-- Listagens ativas são o caminho comum; índice parcial cobre exatamente isso.
create index if not exists employees_active_idx on employees (org_id) where is_active;
create index if not exists job_positions_active_idx on job_positions (org_id) where is_active;

-- ---- job_positions: aperta insert/update, mantém select aberto ----
-- (select continua sem checagem de papel — qualquer membro da org pode ver
-- os cargos, inclusive o próprio, o que já era o comportamento e não muda).

drop policy if exists job_positions_insert_org on job_positions;
create policy job_positions_insert_org
  on job_positions for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.can_manage_hr_structure(org_id)
  );

drop policy if exists job_positions_update_org on job_positions;
create policy job_positions_update_org
  on job_positions for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.can_manage_hr_structure(org_id)
  );

-- ---- job_position_trainings: idem ----

drop policy if exists job_position_trainings_insert_org on job_position_trainings;
create policy job_position_trainings_insert_org
  on job_position_trainings for insert
  with check (
    exists (
      select 1 from job_positions p
      where p.id = job_position_id
        and p.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(p.org_id)
        and public.can_manage_hr_structure(p.org_id)
    )
  );

drop policy if exists job_position_trainings_update_org on job_position_trainings;
create policy job_position_trainings_update_org
  on job_position_trainings for update
  using (
    exists (
      select 1 from job_positions p
      where p.id = job_position_trainings.job_position_id
        and p.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(p.org_id)
        and public.can_manage_hr_structure(p.org_id)
    )
  );

-- ---- employees: troca is_hr_authorized por can_manage_hr_structure ----
-- (select continua com o "ou é o próprio funcionário" — self-service não muda).

drop policy if exists employees_select_org on employees;
create policy employees_select_org
  on employees for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (public.can_manage_hr_structure(org_id) or linked_user_id = auth.uid())
  );

drop policy if exists employees_insert_org on employees;
create policy employees_insert_org
  on employees for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.can_manage_hr_structure(org_id)
    and public.org_can_write(org_id)
  );

drop policy if exists employees_update_org on employees;
create policy employees_update_org
  on employees for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.can_manage_hr_structure(org_id)
    and public.org_can_write(org_id)
  );

-- employee_attachments, competency_actions, lgpd_acceptances e
-- awareness_terms_signatures NÃO são tocados aqui — continuam em
-- is_hr_authorized (admin + quality_manager), sem Gestor de Área. Se isso
-- também precisar mudar, é decisão separada.

-- ---- job_position_trainings: DELETE passa a ser permitido ----
-- Achado ao implementar a edição de cargo: a política original bloqueava
-- DELETE (using (false)), no mesmo padrão de "nada apaga" usado para
-- employees/job_positions. Mas job_position_trainings não é registro de
-- auditoria de um evento — é a lista VIGENTE de requisitos do cargo (mais
-- parecido com uma lista de tags que se reescreve a cada edição do que
-- com uma NC ou um plano de ação). Editar cargo troca a lista inteira
-- (delete + insert), e sem DELETE essa edição não tem como funcionar.
-- Restrito a quem já pode editar o cargo (can_manage_hr_structure).
drop policy if exists job_position_trainings_no_delete on job_position_trainings;
create policy job_position_trainings_delete_org
  on job_position_trainings for delete
  using (
    exists (
      select 1 from job_positions p
      where p.id = job_position_trainings.job_position_id
        and p.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(p.org_id)
        and public.can_manage_hr_structure(p.org_id)
    )
  );
