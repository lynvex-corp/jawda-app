-- Grants explícitos (seção 21.1 do Guia). DELETE nunca concedido a
-- authenticated.

grant select, insert, update on scope_documents to authenticated;
grant select, insert, update on scope_not_applicable_items to authenticated;

grant all on scope_documents to service_role;
grant all on scope_not_applicable_items to service_role;
