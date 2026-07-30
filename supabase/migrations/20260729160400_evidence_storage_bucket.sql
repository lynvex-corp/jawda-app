-- Bucket de evidências (Storage) — GAP encontrado na ABA 6: o prompt desta
-- aba presumia "política de bucket já criada nas abas anteriores", mas
-- nenhuma aba anterior (fundação, NC, Plano de Ação) criou bucket nenhum —
-- toda evidência até agora era só `<input type=file>` em memória, sem
-- upload real. Criando aqui porque o checklist de auditoria interna
-- (audit_checklist_items.evidence_files) é o primeiro fluxo que precisa
-- de fato subir arquivo.
--
-- Bucket único `evidencias`, compartilhado entre módulos (não
-- `audit-evidencias` dedicado) — path já carrega o módulo
-- ({org_id}/audits/..., e no futuro {org_id}/nc/...), então um bucket só
-- cobre tanto auditorias quanto NC/outros módulos sem precisar de política
-- duplicada por bucket. Convenção de path (skill jawda-multitenant, regra
-- 5): {org_id}/{modulo}/{entity_id}/.../{filename} — aqui especificamente
-- {org_id}/audits/{audit_id}/checklist/{checklist_item_id}/{filename}.
--
-- Mecanismo de isolamento: (storage.foldername(name))[1] = org_id via JWT
-- claim (auth.jwt() ->> 'org_id') — o mesmo mecanismo real usado em toda
-- RLS de tabela desde a fundação (JWT custom claim, não
-- current_setting('app.current_org_id') como o exemplo antigo em
-- docs/MODELO_DE_DADOS.md ainda mostra; aquele texto ficou desatualizado
-- quando a fundação trocou para JWT hook — GUIA_DE_ARQUITETURA.md nunca
-- chegou a documentar Storage, então não há contradição a apontar lá).
--
-- Sem política de DELETE — "nada é apagado" (seção 2 do Guia) vale para
-- evidência também. Reenvio é sempre um novo arquivo com nome novo, nunca
-- substituição do existente.
insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

create policy evidencias_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidencias'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
  );

create policy evidencias_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidencias'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
  );
