-- Grants explícitos de API para as tabelas desta aba — checklist da seção
-- 18 do Guia de Arquitetura (auto_expose_new_tables desligado: sem GRANT,
-- PostgREST devolve "permission denied" antes de qualquer política de RLS
-- ser avaliada).
--
-- authenticated: select/insert/update nas 6 tabelas de negócio (delete já
-- bloqueado por política em todas — nada apaga).
--
-- service_role: acesso total em tudo, incluindo os 2 contadores internos —
-- é o papel que Edge Functions e automação de backend usam.
--
-- audit_code_counters / audit_finding_code_counters são contadores
-- internos, mesmo padrão de nc_code_counters/action_plan_code_counters:
-- RLS ligado sem nenhuma política já nega acesso por padrão a
-- authenticated/anon/service_role, e só a trigger SECURITY DEFINER dona da
-- tabela grava neles — por isso NÃO recebem grant para authenticated.
grant select, insert, update on audits to authenticated;
grant select, insert, update on audit_auditors to authenticated;
grant select, insert, update on audit_plan_items to authenticated;
grant select, insert, update on audit_checklist_items to authenticated;
grant select, insert, update on audit_findings to authenticated;
grant select, insert, update on audit_reports to authenticated;

grant all on audits to service_role;
grant all on audit_auditors to service_role;
grant all on audit_plan_items to service_role;
grant all on audit_checklist_items to service_role;
grant all on audit_findings to service_role;
grant all on audit_reports to service_role;
grant all on audit_code_counters to service_role;
grant all on audit_finding_code_counters to service_role;
