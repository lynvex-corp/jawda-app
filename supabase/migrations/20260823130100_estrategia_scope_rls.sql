-- RLS de scope_documents/scope_not_applicable_items. org_can_write() desde
-- o início (seção 7 do Guia). Itens não aplicáveis só podem ser
-- inseridos/editados enquanto o documento pai está em 'rascunho' — a
-- declaração vigente (ou aguardando aprovação) nunca é editada diretamente,
-- inclusive seus itens.

alter table scope_documents enable row level security;

create policy scope_documents_select_org
  on scope_documents for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy scope_documents_insert_org
  on scope_documents for insert
  with check (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy scope_documents_update_org
  on scope_documents for update
  using (org_id = (auth.jwt() ->> 'org_id')::uuid and public.org_can_write(org_id));

create policy scope_documents_no_delete
  on scope_documents for delete
  using (false);

alter table scope_not_applicable_items enable row level security;

create policy scope_not_applicable_items_select_org
  on scope_not_applicable_items for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy scope_not_applicable_items_insert_org
  on scope_not_applicable_items for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and exists (
      select 1 from scope_documents d
      where d.id = scope_not_applicable_items.scope_document_id and d.status = 'rascunho'
    )
  );

create policy scope_not_applicable_items_update_org
  on scope_not_applicable_items for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and exists (
      select 1 from scope_documents d
      where d.id = scope_not_applicable_items.scope_document_id and d.status = 'rascunho'
    )
  );

create policy scope_not_applicable_items_no_delete
  on scope_not_applicable_items for delete
  using (false);
