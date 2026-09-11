-- Regra 21.1 do Guia: GRANT em paralelo à RLS em toda tabela nova.

grant select, insert, update on process_maps to authenticated;
grant all on process_maps to service_role;

grant select, insert, delete on process_map_collaborators to authenticated;
grant all on process_map_collaborators to service_role;
