grant select, insert, update on performance_cycles to authenticated;
grant select, insert, update on performance_evaluations to authenticated;
grant select, insert, update on performance_cha_answers to authenticated;
grant select, insert, update on performance_decision_matrix to authenticated;
grant select, insert, update on performance_feedback to authenticated;

grant all on performance_cycles to service_role;
grant all on performance_evaluations to service_role;
grant all on performance_cha_answers to service_role;
grant all on performance_decision_matrix to service_role;
grant all on performance_feedback to service_role;
