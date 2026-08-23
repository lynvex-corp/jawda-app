-- Grants explícitos (seção 21.1 do Guia). DELETE nunca concedido a
-- authenticated. risk_reassessments não recebe update/delete (append-only).
-- risk_opportunity_code_counters não recebe grant nenhum a authenticated —
-- só a trigger e o service_role tocam nela.

grant select, insert, update on risks_opportunities to authenticated;
grant select, insert on risk_reassessments to authenticated;

grant all on risks_opportunities to service_role;
grant all on risk_reassessments to service_role;
grant all on risk_opportunity_code_counters to service_role;
