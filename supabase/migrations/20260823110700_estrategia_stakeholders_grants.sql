-- Grants explícitos (seção 21.1 do Guia). DELETE nunca concedido a
-- authenticated — bloqueado também por política (nada apaga).

grant select, insert, update on stakeholder_analyses to authenticated;
grant select, insert, update on stakeholders to authenticated;

grant all on stakeholder_analyses to service_role;
grant all on stakeholders to service_role;
