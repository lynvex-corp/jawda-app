-- Bucket de Storage para o dossiê de Pessoas (seção 21.2 do Guia: conferir
-- explicitamente antes de assumir que já existe — não existia nenhum
-- bucket dedicado, só `evidencias`/`documentos`/`logos-empresas`).
--
-- Bucket dedicado (não reaproveita `documentos`) porque o conteúdo aqui
-- é mais sensível que documento de módulo de negócio comum — inclui ASO
-- (dado de saúde) e documento pessoal (seção 18 do prompt desta aba pede
-- régua mais alta). A política do bucket espelha EXATAMENTE a mesma regra
-- de employee_attachments (is_hr_authorized OU dono do próprio dossiê),
-- em vez do padrão mais aberto "qualquer membro da org" usado em
-- `evidencias`.
--
-- Convenção de path: {org_id}/employees/{employee_id}/{filename}.
-- Sem política de UPDATE nem DELETE — anexo é imutável (mesma regra da
-- tabela employee_attachments).

insert into storage.buckets (id, name, public)
values ('pessoas-dossie', 'pessoas-dossie', false)
on conflict (id) do nothing;

create policy pessoas_dossie_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pessoas-dossie'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
    and (
      public.is_hr_authorized((auth.jwt() ->> 'org_id')::uuid)
      or exists (
        select 1 from employees e
        where e.org_id = (auth.jwt() ->> 'org_id')::uuid
          and e.linked_user_id = auth.uid()
          and (storage.foldername(name))[3] = e.id::text
      )
    )
  );

create policy pessoas_dossie_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pessoas-dossie'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
    and public.is_hr_authorized((auth.jwt() ->> 'org_id')::uuid)
  );
