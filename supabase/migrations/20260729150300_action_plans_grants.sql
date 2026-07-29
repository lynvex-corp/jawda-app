-- Grants explícitos de API para as tabelas desta aba — mesmo gap descoberto
-- na ABA 4 (ver comentário em 20260729140500_ncs_grants.sql):
-- auto_expose_new_tables está desligado, então sem GRANT explícito o
-- PostgREST devolve "permission denied" antes de qualquer política de RLS
-- ser avaliada.
--
-- authenticated: select/insert/update nas 3 tabelas de negócio (delete já
-- bloqueado por política em todas). action_plan_verifications não recebe
-- update/insert de fora do fluxo — só select/insert (update é bloqueado por
-- política, ver 20260729150100_action_plans_rls.sql).
--
-- service_role: acesso total — Edge Functions e automação de backend
-- (ex.: rotina de SLA/atraso da seção 13 do Guia, quando existir).
--
-- action_plan_code_counters é contador interno, mesmo padrão de
-- nc_code_counters — RLS ligado sem política nenhuma já nega acesso por
-- padrão a authenticated/anon/service_role, e só a trigger SECURITY DEFINER
-- dona da tabela grava nela.
grant select, insert, update on action_plans to authenticated;
grant select, insert, update on action_plan_corrective_actions to authenticated;
grant select, insert on action_plan_verifications to authenticated;

grant all on action_plans to service_role;
grant all on action_plan_corrective_actions to service_role;
grant all on action_plan_verifications to service_role;
grant all on action_plan_code_counters to service_role;
