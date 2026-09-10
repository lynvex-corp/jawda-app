-- Bloco 2, item 1: excluir card do SWOT.
--
-- A seção 20 do Guia ("O que jamais fazer") proíbe deletar registro e manda
-- usar soft delete. A policy `swot_cards_no_delete ... using (false)` já
-- existia justamente para isso, e o grant de swot_cards nunca teve DELETE
-- (regra 21.1). Então a lixeira da UI é um UPDATE que carimba deleted_at,
-- não um DELETE — nenhum grant e nenhuma policy precisam mudar, porque
-- UPDATE já é concedido e já passa por org_can_write().
--
-- Sem coluna de motivo: um card de rascunho é anotação de trabalho, e
-- exigir justificativa para remover algo digitado errado seria fricção sem
-- ganho de evidência. A restrição que preserva a evidência é outra, e está
-- na UI: a lixeira só aparece enquanto a análise é 'rascunho'. Depois de
-- formalizada a análise inteira vira somente leitura (LockedDocumentBanner),
-- então não há como apagar card de versão formalizada.

alter table swot_cards
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references profiles(id);

-- Índice parcial: as listagens sempre filtram `deleted_at is null`, então só
-- as linhas vivas precisam ser indexadas.
create index if not exists swot_cards_ativos_idx
  on swot_cards (swot_analysis_id)
  where deleted_at is null;

-- Coerência: ou os dois campos estão preenchidos, ou nenhum.
alter table swot_cards
  drop constraint if exists swot_cards_soft_delete_coerente;
alter table swot_cards
  add constraint swot_cards_soft_delete_coerente
  check ((deleted_at is null) = (deleted_by is null));
