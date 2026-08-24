-- Grants explícitos (seção 21.1 do Guia). DELETE nunca concedido a
-- authenticated — anulação é status, nunca exclusão.

grant select, insert, update on critical_analysis_meetings to authenticated;
grant select, insert, update on critical_analysis_agenda_items to authenticated;
grant select, insert, update on critical_analysis_participants to authenticated;
grant select, insert, update on critical_analysis_action_items to authenticated;

grant all on critical_analysis_meetings to service_role;
grant all on critical_analysis_agenda_items to service_role;
grant all on critical_analysis_participants to service_role;
grant all on critical_analysis_action_items to service_role;
