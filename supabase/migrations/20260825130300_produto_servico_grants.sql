-- Grants explícitos (seção 21.1). delete nunca é concedido a
-- authenticated.

grant select, insert, update on service_demands to authenticated;
grant select, insert, update on service_demand_stages to authenticated;

grant all on service_demands to service_role;
grant all on service_demand_stages to service_role;
