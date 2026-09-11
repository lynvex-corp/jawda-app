-- Regra 21.1 do Guia.

grant select, insert, delete on process_map_raci to authenticated;
grant all on process_map_raci to service_role;
