-- Regra 21.1 do Guia: GRANT em paralelo à RLS em toda tabela nova — sem
-- isso o PostgREST recusa a tabela inteira (exposição automática é off).

grant select, insert, update on hr_learning_settings to authenticated;
grant all on hr_learning_settings to service_role;

grant select, insert on training_session_feedback to authenticated;
grant all on training_session_feedback to service_role;

grant select, insert, update on training_effectiveness_evaluations to authenticated;
grant all on training_effectiveness_evaluations to service_role;
