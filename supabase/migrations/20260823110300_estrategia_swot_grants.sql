-- Grants explícitos (seção 21.1 do Guia — auto_expose_new_tables desligado,
-- sem isso o PostgREST devolve "permission denied" mesmo com RLS correta).
-- DELETE nunca é concedido a authenticated (nada apaga — bloqueado também
-- por política). Nenhum grant de EXECUTE explícito nas RPCs: este projeto
-- não revoga o privilégio padrão do Postgres (EXECUTE em função nova vai
-- para PUBLIC automaticamente) — mesmo comportamento observado em
-- update_indicator_target (20260730120400_indicators_grants.sql não
-- concede execute nela).

grant select, insert, update on swot_analyses to authenticated;
grant select, insert, update on swot_cards to authenticated;

grant all on swot_analyses to service_role;
grant all on swot_cards to service_role;
