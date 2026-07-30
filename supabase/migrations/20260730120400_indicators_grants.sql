-- Grants explícitos de API para as tabelas desta aba (seção 18 do Guia de
-- Arquitetura — auto_expose_new_tables desligado, sem GRANT o PostgREST
-- devolve "permission denied" antes de qualquer RLS ser avaliada).
--
-- DELETE nunca é concedido: todas as 5 tabelas de negócio bloqueiam DELETE
-- via política (nada apaga). indicator_code_counters não recebe grant
-- nenhum para `authenticated` — só a trigger SECURITY DEFINER e o
-- service_role tocam nela.

grant select, insert, update on quality_objectives to authenticated;
grant select, insert, update on indicators to authenticated;
grant select, insert, update on indicator_measurements to authenticated;
grant select, insert, update on indicator_target_history to authenticated;
grant select, insert, update on critical_analysis_periods to authenticated;

grant all on quality_objectives to service_role;
grant all on indicators to service_role;
grant all on indicator_measurements to service_role;
grant all on indicator_target_history to service_role;
grant all on critical_analysis_periods to service_role;
grant all on indicator_code_counters to service_role;
