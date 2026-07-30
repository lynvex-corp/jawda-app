-- Auditoria de GRANTS em todas as tabelas do schema public, pedida depois
-- de encontrarmos o mesmo bug de classe duas vezes (ncs/activity_log na
-- ABA 4, profiles/user_organizations na ABA 5): auto_expose_new_tables
-- desligado faz com que uma tabela sem GRANT explícito devolva "permission
-- denied" antes de qualquer política de RLS ser avaliada — mesmo com a
-- política correta escrita.
--
-- Método: para cada tabela do public, comparamos o GRANT atual do papel
-- `authenticated`/`service_role` contra o que as próprias políticas de RLS
-- já autorizam (cmd de cada policy com qual/with_check diferente de
-- `false`). Não damos nenhum grant além do que a política já permite —
-- India DELETE nunca é concedido a `authenticated` nas tabelas que têm
-- "nada é apagado" (política `using (false)`), e nenhuma tabela ganha
-- INSERT/UPDATE que a política já bloqueia.
--
-- Tabelas auditadas e sem gap (nada a fazer aqui): profiles, ncs,
-- activity_log, action_plans, action_plan_corrective_actions,
-- action_plan_verifications, action_plan_code_counters.
--
-- Gaps encontrados e corrigidos nesta migração:
--
-- organizations — política já permite SELECT (empresa própria + time
--   interno) e UPDATE (idem) e INSERT (só time interno), mas authenticated
--   nunca recebeu nenhum dos três. Sem isso, nenhuma tela que um dia ler
--   organizations direto (fora da RPC get_current_org/list_my_organizations)
--   funcionaria — mesmo bug silencioso de profiles, só que ainda não
--   descoberto porque nada usa ainda.
-- units — mesma lacuna: política de SELECT/INSERT/UPDATE por org (+ time
--   interno) já existe, grant nunca foi dado.
-- user_organizations — SELECT já tinha sido corrigido na ABA 5
--   (20260729150400), mas INSERT/UPDATE (usados por convite/gestão de
--   usuário dentro da própria org, política user_organizations_insert_org /
--   _update_org) continuavam faltando.
-- user_units_access — SELECT/INSERT/UPDATE por org (+ time interno) já
--   autorizados na política, grant nunca existiu.
-- internal_staff — internal_staff.id referencia auth.users(id): o time
--   Lynvex também loga via Supabase Auth e chega no Postgres como o mesmo
--   papel `authenticated` (não existe um papel de banco separado por tipo
--   de usuário). Política já permite SELECT (o próprio registro ou
--   super_admin) e INSERT/UPDATE (só super_admin) — sem grant, o painel
--   administrativo nunca conseguiria ler o próprio staff.
-- internal_access_log — mesma lógica: SELECT/INSERT/UPDATE (o próprio
--   registro ou super_admin) já autorizados na política, faltava o grant.
-- nc_code_counters — grant de service_role ficou pela metade desde a ABA 4
--   (só REFERENCES/TRIGGER/TRUNCATE, que são grants irrelevantes pra
--   leitura/escrita real). O contador gêmeo desta tabela
--   (action_plan_code_counters, criado na ABA 5) já recebeu
--   `grant all ... to service_role` desde o início — aqui só equalizamos.
--   authenticated continua sem nenhum grant nas duas tabelas de contador,
--   de propósito: são tabelas com RLS ligada e zero políticas, só a
--   trigger SECURITY DEFINER (dona da tabela) ou service_role via
--   automação de backend deveriam tocar nelas.

grant select, insert, update on organizations to authenticated;
grant select, insert, update on units to authenticated;
grant insert, update on user_organizations to authenticated;
grant select, insert, update on user_units_access to authenticated;
grant select, insert, update on internal_staff to authenticated;
grant select, insert, update on internal_access_log to authenticated;

grant all on nc_code_counters to service_role;
