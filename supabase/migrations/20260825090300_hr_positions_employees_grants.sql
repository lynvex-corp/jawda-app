-- Grants explícitos (seção 21.1). Ver 20260825090100 para a decisão sobre
-- manter o GRANT padrão em vez de restringir SELECT nas tabelas
-- sensíveis. employee_attachments não recebe UPDATE (anexo é imutável —
-- se errou, anexa de novo, nunca sobrescreve evidência). DELETE nunca é
-- concedido em nenhuma tabela deste módulo.

grant select, insert, update on job_positions to authenticated;
grant select, insert, update on job_position_trainings to authenticated;
grant select, insert, update on employees to authenticated;
grant select, insert on employee_attachments to authenticated;
grant select, insert, update on competency_actions to authenticated;
grant select, insert on lgpd_acceptances to authenticated;
grant select, insert on awareness_terms_signatures to authenticated;

grant all on job_positions to service_role;
grant all on job_position_trainings to service_role;
grant all on employees to service_role;
grant all on employee_attachments to service_role;
grant all on competency_actions to service_role;
grant all on lgpd_acceptances to service_role;
grant all on awareness_terms_signatures to service_role;
