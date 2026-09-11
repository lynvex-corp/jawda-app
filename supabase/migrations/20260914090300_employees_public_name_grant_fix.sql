-- Achado ao verificar o Bloco A: a migração 20260914090000 deu GRANT
-- SELECT em employees_public_name só pra `authenticated` (o papel que a
-- aplicação usa de verdade), mas esqueceu `service_role` — por isso a
-- checagem com a chave de service_role voltou "permission denied".
-- Sem efeito para o app em si (que nunca usa service_role no cliente),
-- mas corrige pra ficar consistente com o padrão do resto do sistema.

grant select on employees_public_name to service_role;
