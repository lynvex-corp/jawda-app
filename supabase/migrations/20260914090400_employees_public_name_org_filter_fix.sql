-- CORREÇÃO CRÍTICA: employees_public_name (20260914090000) vazava nome de
-- funcionário entre organizações. A view usa security_invoker=false de
-- propósito (bypassa a RLS de `employees`, que normalmente restringe a
-- RH/o próprio funcionário) — mas ao bypassar a RLS, o filtro de
-- `org_id = jwt` que a RLS também fazia foi embora junto, e eu não repus
-- explicitamente na view. Sem esse filtro, o SELECT devolve TODA a tabela
-- employees pra qualquer usuário autenticado, de qualquer organização.
--
-- Confirmado em produção antes desta correção: consulta como authenticated
-- devolveu funcionário da Cedro Engenharia E da org de teste na mesma
-- resposta.
--
-- Fix: repor o filtro de org_id dentro da própria view — é o único
-- pedaço de isolamento que a RLS fazia e que precisa sobreviver ao
-- bypass.

create or replace view employees_public_name
  with (security_invoker = false)
  as
  select id, org_id, nome
  from employees
  where org_id = (auth.jwt() ->> 'org_id')::uuid;
