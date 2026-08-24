grant select, insert, update on trainings to authenticated;
grant select, insert on training_applicability to authenticated;
grant select, insert, update on training_sessions to authenticated;
grant select, insert, update on training_participants to authenticated;
grant select, insert on awareness_publications to authenticated;
grant select, insert on awareness_quiz_options to authenticated;
grant select, insert on awareness_acknowledgments to authenticated;

grant all on trainings to service_role;
grant all on training_applicability to service_role;
grant all on training_sessions to service_role;
grant all on training_participants to service_role;
grant all on awareness_publications to service_role;
grant all on awareness_quiz_options to service_role;
grant all on awareness_acknowledgments to service_role;
