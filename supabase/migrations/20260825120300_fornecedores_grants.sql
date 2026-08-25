-- Grants explícitos (seção 21.1). delete nunca é concedido a
-- authenticated.

grant select, insert, update on suppliers to authenticated;
grant select, insert, update on supplier_qualification_criteria to authenticated;
grant select, insert on supplier_evaluation_parameters to authenticated;
grant select, insert, update on supplier_evaluations to authenticated;

grant all on suppliers to service_role;
grant all on supplier_qualification_criteria to service_role;
grant all on supplier_evaluation_parameters to service_role;
grant all on supplier_evaluations to service_role;
