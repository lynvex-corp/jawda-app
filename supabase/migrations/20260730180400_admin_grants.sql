-- Grants explícitos das tabelas desta aba (seção 18 do Guia — sem GRANT o
-- PostgREST nega antes de qualquer RLS ser avaliada). DELETE nunca
-- concedido: as 7 tabelas bloqueiam exclusão via política.
--
-- Nota: authenticated recebe o grant em TODAS, inclusive nas 4 financeiras
-- — o grant é por papel do Postgres (authenticated cobre cliente E
-- internal_staff, não existe papel separado por tipo de usuário), quem
-- decide quem vê o quê é a política de RLS, não o grant. Sem o grant aqui,
-- nem o internal_staff conseguiria ler a própria tabela financeira.

grant select, insert, update on contracts to authenticated;
grant select, insert, update on contract_modules to authenticated;
grant select, insert, update on contract_norms to authenticated;
grant select, insert, update on plans to authenticated;
grant select, insert, update on invoices to authenticated;
grant select, insert, update on payment_events to authenticated;
grant select, insert, update on delinquency_state to authenticated;

grant all on contracts to service_role;
grant all on contract_modules to service_role;
grant all on contract_norms to service_role;
grant all on plans to service_role;
grant all on invoices to service_role;
grant all on payment_events to service_role;
grant all on delinquency_state to service_role;
