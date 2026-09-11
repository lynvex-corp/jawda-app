-- Regra 21.1 do Guia.

grant select, insert, update on process_map_versions to authenticated;
grant all on process_map_versions to service_role;
