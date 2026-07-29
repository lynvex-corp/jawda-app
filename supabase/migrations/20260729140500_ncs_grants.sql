-- Grants explícitos de API para as tabelas desta aba.
--
-- Gap descoberto ao testar isolamento de RLS entre organizações (item 11 do
-- prompt da ABA 4): este projeto tem `auto_expose_new_tables` desligado (é o
-- novo padrão do Supabase — ver comentário em supabase/config.toml), então
-- uma tabela nova só fica alcançável pela API (PostgREST) se receber GRANT
-- explícito. RLS é a segunda trava, não a primeira — sem o GRANT, toda
-- consulta (mesmo respeitando RLS) volta "permission denied" antes de a
-- policy ser avaliada. Sem isso, os hooks de src/lib/queries/ncs.ts não
-- funcionariam em produção nem localmente.
--
-- authenticated: select/insert/update em ncs (delete já é bloqueado pela
-- política ncs_no_delete, então não precisa do grant) e select em
-- activity_log (insert/update/delete só acontecem via trigger SECURITY
-- DEFINER, que roda como dono da tabela — não precisa de grant).
--
-- service_role: acesso total nas duas tabelas — é o papel que Edge Functions
-- e automação de backend usam (ex.: a rotina agendada de SLA da seção 13 do
-- Guia de Arquitetura, quando existir), e o próprio bypass de RLS do
-- service_role só é útil se o GRANT de tabela também existir.
--
-- nc_code_counters é contador interno, usado só pela trigger de geração de
-- código (também SECURITY DEFINER) — nunca deve ser alcançável pela API.
-- RLS ligado sem nenhuma política = acesso negado por padrão para
-- authenticated/anon/service_role, o que é o comportamento desejado aqui.
grant select, insert, update on ncs to authenticated;
grant select on activity_log to authenticated;

grant all on ncs to service_role;
grant all on activity_log to service_role;

alter table nc_code_counters enable row level security;
