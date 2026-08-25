-- Grants explícitos (seção 21.1) — table auto-exposure está desligado no
-- PostgREST, RLS sozinha não basta. delete nunca é concedido a
-- authenticated (nada apaga neste módulo).

grant select, insert, update on quality_policy to authenticated;
grant select, insert, update on documents to authenticated;
grant select, insert on document_revisions to authenticated;
grant select, insert on meeting_minutes to authenticated;
grant select, insert on attendance_lists to authenticated;

grant all on quality_policy to service_role;
grant all on documents to service_role;
grant all on document_revisions to service_role;
grant all on meeting_minutes to service_role;
grant all on attendance_lists to service_role;
