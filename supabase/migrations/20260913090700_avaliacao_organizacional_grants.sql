-- Regra 21.1 do Guia.

grant select, insert on org_climate_surveys to authenticated;
grant all on org_climate_surveys to service_role;

grant select, insert on org_climate_survey_responses to authenticated;
grant all on org_climate_survey_responses to service_role;
