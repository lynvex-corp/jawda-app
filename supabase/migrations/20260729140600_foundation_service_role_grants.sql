-- Gap encontrado ao testar isolamento de RLS da ABA 4 (ver comentário em
-- 20260729140500_ncs_grants.sql): as tabelas de fundação (ABA 3) também
-- nunca receberam GRANT para service_role, porque este projeto tem
-- `auto_expose_new_tables` desligado. service_role já contorna RLS por
-- convenção da plataforma (é o papel usado por Edge Functions e automação de
-- backend), mas esse bypass só é alcançável pela API se o GRANT de tabela
-- também existir — sem ele, toda chamada volta "permission denied" antes de
-- qualquer política ser avaliada. authenticated/anon não são tocados aqui:
-- o acesso do app a essas tabelas já foi desenhado via RPC (get_current_org,
-- list_my_organizations, set_active_org), não por SELECT direto.
grant all on organizations, units, profiles, user_organizations, user_units_access,
  internal_staff, internal_access_log to service_role;
