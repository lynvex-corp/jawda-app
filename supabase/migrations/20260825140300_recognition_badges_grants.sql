-- Grants explícitos (seção 21.1). Só SELECT pra authenticated — toda
-- escrita acontece dentro de trigger/cron SECURITY DEFINER (dono da
-- tabela), o client nunca insere direto nesta tabela.

grant select on recognition_badge_events to authenticated;
grant all on recognition_badge_events to service_role;
