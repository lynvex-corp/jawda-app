-- Bloco 3, item 3: desfazer a revogação de um documento, com justificativa
-- obrigatória e registro de quem justificou e quando.
--
-- ESTADO ANTERIOR: "Inutilizar/Revogar" era um UPDATE cru de status, sem
-- caminho de volta na UI e sem nenhum registro além da linha de activity_log
-- gravada pelo trigger. Não havia como reverter, nem como explicar por quê.
--
-- POR QUE TABELA E NÃO TRIO DE COLUNAS: o padrão do projeto para transição
-- terminal com motivo é o trio na própria linha (annulment_reason/
-- annulled_by/annulled_at em critical_analysis_meetings, cancel_reason em
-- ncs). Aqui não serve: revogar e reverter é um ciclo que pode se repetir, e
-- um trio de colunas só guarda a última vez. Uma tabela preserva todas as
-- reversões — que é justamente o que se quer poder mostrar numa auditoria.

create table if not exists document_revocation_reversals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  document_id uuid not null references documents(id) on delete cascade,
  -- not null + o btrim na RPC: justificativa vazia não passa nem por engano.
  justification text not null,
  reversed_by uuid not null references profiles(id) default auth.uid(),
  reversed_at timestamptz not null default now()
);

create index if not exists document_revocation_reversals_doc_idx
  on document_revocation_reversals (document_id, reversed_at desc);

alter table document_revocation_reversals enable row level security;

drop policy if exists document_revocation_reversals_select_org on document_revocation_reversals;
create policy document_revocation_reversals_select_org
  on document_revocation_reversals for select
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

-- Mesma régua de quem podia revogar (documents_update_org): quem revoga é
-- quem pode desfazer.
drop policy if exists document_revocation_reversals_insert_org on document_revocation_reversals;
create policy document_revocation_reversals_insert_org
  on document_revocation_reversals for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.org_can_write(org_id)
    and public.user_role_in_org(org_id) in ('admin', 'quality_manager')
  );

-- Justificativa registrada não se edita nem se apaga — é a evidência.
drop policy if exists document_revocation_reversals_no_update on document_revocation_reversals;
create policy document_revocation_reversals_no_update
  on document_revocation_reversals for update
  using (false);

drop policy if exists document_revocation_reversals_no_delete on document_revocation_reversals;
create policy document_revocation_reversals_no_delete
  on document_revocation_reversals for delete
  using (false);

grant select, insert on document_revocation_reversals to authenticated;
grant all on document_revocation_reversals to service_role;

-- ============================================================
-- RPC: reverter a revogação
--
-- security invoker de propósito — roda com o papel de quem chamou, então as
-- policies acima e a de documents valem para ela sem precisar duplicar a
-- checagem de papel aqui dentro.
--
-- Regra 21.6: documents JÁ tem trigger de log (documents_activity_log). Esta
-- função NÃO escreve em activity_log — o trigger cobre, e a extensão dele
-- logo abaixo passa a registrar também a transição de volta.
-- ============================================================

create or replace function public.reverse_document_revocation(
  p_document_id uuid,
  p_justification text
)
returns documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result documents;
begin
  if p_justification is null or btrim(p_justification) = '' then
    raise exception 'A justificativa é obrigatória para reverter uma revogação';
  end if;

  -- Registra a justificativa ANTES de mexer no status: se a atualização do
  -- documento falhar (RLS, por exemplo), a transação inteira volta atrás e
  -- não sobra justificativa órfã de uma reversão que não aconteceu.
  insert into document_revocation_reversals (document_id, justification)
  select id, btrim(p_justification)
    from documents
   where id = p_document_id
     and status = 'inutilizado_revogado';

  if not found then
    raise exception 'Documento não encontrado, sem acesso, ou não está revogado';
  end if;

  -- Volta direto para vigente: a justificativa registrada acima é o próprio
  -- ato de aprovação da volta.
  update documents
     set status = 'vigente'
   where id = p_document_id
     and status = 'inutilizado_revogado'
   returning * into v_result;

  return v_result;
end;
$$;

comment on function public.reverse_document_revocation(uuid, text) is
  'Desfaz a revogação de um documento, exigindo justificativa. Grava a justificativa em document_revocation_reversals (com autor e data) e devolve o documento para status vigente. Falha se o documento não estiver revogado ou se a justificativa vier vazia.';

-- ============================================================
-- Trigger de trilha: passa a registrar também a volta
--
-- Antes só logava a ida para 'inutilizado_revogado'. Sem esta extensão, a
-- reversão ficaria registrada apenas na tabela nova, e a trilha de auditoria
-- mostraria um documento revogado que, sem explicação, volta a aparecer como
-- vigente.
-- ============================================================

create or replace function public.log_documents_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'criou', 'documents', new.id, jsonb_build_object('code', new.code));
  elsif tg_op = 'UPDATE' and new.status = 'inutilizado_revogado' and old.status <> 'inutilizado_revogado' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'inutilizou_ou_revogou', 'documents', new.id, jsonb_build_object('code', new.code));
  elsif tg_op = 'UPDATE' and old.status = 'inutilizado_revogado' and new.status <> 'inutilizado_revogado' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'reverteu_revogacao', 'documents', new.id,
      jsonb_build_object('code', new.code, 'novo_status', new.status));
  end if;

  return coalesce(new, old);
end;
$$;
