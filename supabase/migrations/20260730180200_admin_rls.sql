-- RLS do Painel Admin. Reaproveita public.is_internal_staff() já criada na
-- fundação (20260729120100_foundation_rls.sql) — não precisa redefinir.
--
-- contracts/contract_modules/contract_norms: internal_staff tem acesso
-- completo (é quem provisiona e gerencia). Usuário cliente tem SELECT
-- limitado à própria org — precisa disso pra ler os módulos contratados e
-- desenhar o cadeado no próprio painel (seção 4/7 do Guia: "o contrato
-- manda no acesso"). Cliente NUNCA grava aqui — só o admin altera contrato.
--
-- plans/invoices/payment_events/delinquency_state: RLS restrita a
-- internal_staff, sem exceção — são as 4 tabelas que o prompt desta aba
-- marca como "NÃO acessíveis por usuário cliente", o ponto de segurança
-- central da separação dos dois painéis.

alter table contracts enable row level security;

create policy contracts_select_staff
  on contracts for select
  using (public.is_internal_staff());

create policy contracts_select_own_org
  on contracts for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy contracts_insert_staff
  on contracts for insert
  with check (public.is_internal_staff());

create policy contracts_update_staff
  on contracts for update
  using (public.is_internal_staff());

-- DELETE bloqueado — contrato encerra via status, nunca apaga.
create policy contracts_no_delete
  on contracts for delete
  using (false);

alter table contract_modules enable row level security;

create policy contract_modules_select_staff
  on contract_modules for select
  using (public.is_internal_staff());

create policy contract_modules_select_own_org
  on contract_modules for select
  using (
    exists (
      select 1 from contracts c
      where c.id = contract_modules.contract_id
        and c.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy contract_modules_insert_staff
  on contract_modules for insert
  with check (public.is_internal_staff());

create policy contract_modules_update_staff
  on contract_modules for update
  using (public.is_internal_staff());

create policy contract_modules_no_delete
  on contract_modules for delete
  using (false);

alter table contract_norms enable row level security;

create policy contract_norms_select_staff
  on contract_norms for select
  using (public.is_internal_staff());

create policy contract_norms_select_own_org
  on contract_norms for select
  using (
    exists (
      select 1 from contracts c
      where c.id = contract_norms.contract_id
        and c.org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

create policy contract_norms_insert_staff
  on contract_norms for insert
  with check (public.is_internal_staff());

create policy contract_norms_update_staff
  on contract_norms for update
  using (public.is_internal_staff());

create policy contract_norms_no_delete
  on contract_norms for delete
  using (false);

-- ===== Tabelas financeiras — internal_staff apenas, sem exceção =====

alter table plans enable row level security;

create policy plans_select_staff on plans for select using (public.is_internal_staff());
create policy plans_insert_staff on plans for insert with check (public.is_internal_staff());
create policy plans_update_staff on plans for update using (public.is_internal_staff());
create policy plans_no_delete on plans for delete using (false);

alter table invoices enable row level security;

create policy invoices_select_staff on invoices for select using (public.is_internal_staff());
create policy invoices_insert_staff on invoices for insert with check (public.is_internal_staff());
create policy invoices_update_staff on invoices for update using (public.is_internal_staff());
create policy invoices_no_delete on invoices for delete using (false);

alter table payment_events enable row level security;

create policy payment_events_select_staff on payment_events for select using (public.is_internal_staff());
create policy payment_events_insert_staff on payment_events for insert with check (public.is_internal_staff());
create policy payment_events_update_staff on payment_events for update using (public.is_internal_staff());
create policy payment_events_no_delete on payment_events for delete using (false);

alter table delinquency_state enable row level security;

create policy delinquency_state_select_staff on delinquency_state for select using (public.is_internal_staff());
create policy delinquency_state_insert_staff on delinquency_state for insert with check (public.is_internal_staff());
create policy delinquency_state_update_staff on delinquency_state for update using (public.is_internal_staff());
create policy delinquency_state_no_delete on delinquency_state for delete using (false);
