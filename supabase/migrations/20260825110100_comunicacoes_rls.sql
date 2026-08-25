-- RLS de Comunicações. Diferente de Documentos (Parte 1), a especificação
-- diz explicitamente que o comunicador pode ser "qualquer perfil, não mais
-- fixo a 4" — então insert de communication_processes/communications é
-- liberado a qualquer membro ativo da própria org (só org_id + trava de
-- inadimplência), sem restrição extra de papel.
--
-- communication_reads só aceita o próprio usuário confirmando ciência de
-- si mesmo — ninguém marca "Ciente" em nome de outro.

alter table communication_processes enable row level security;

create policy communication_processes_select_org
  on communication_processes for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy communication_processes_insert_org
  on communication_processes for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy communication_processes_no_update
  on communication_processes for update
  using (false);

create policy communication_processes_no_delete
  on communication_processes for delete
  using (false);

alter table communications enable row level security;

create policy communications_select_org
  on communications for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy communications_insert_org
  on communications for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy communications_no_update
  on communications for update
  using (false);

create policy communications_no_delete
  on communications for delete
  using (false);

alter table communication_reads enable row level security;

create policy communication_reads_select_org
  on communication_reads for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy communication_reads_insert_self
  on communication_reads for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and recipient_user_id = auth.uid()
  );

create policy communication_reads_no_update
  on communication_reads for update
  using (false);

create policy communication_reads_no_delete
  on communication_reads for delete
  using (false);
