-- Grants explícitos (seção 21.1). delete nunca é concedido a
-- authenticated. communication_reads não recebe update — confirmação de
-- ciência é um insert único (unique em communication_id+recipient_user_id).

grant select, insert on communication_processes to authenticated;
grant select, insert on communications to authenticated;
grant select, insert on communication_reads to authenticated;

grant all on communication_processes to service_role;
grant all on communications to service_role;
grant all on communication_reads to service_role;
