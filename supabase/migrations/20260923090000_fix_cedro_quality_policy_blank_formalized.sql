-- Correção manual de dado em produção — Cedro Engenharia (cliente real,
-- não a org de teste), 2026-09-23.
--
-- Achado numa auditoria de propagação dos Blocos 6-10: a Política da
-- Qualidade da Cedro tinha DUAS linhas com status = 'formalizada':
--   - 7e9c81cc-6af3-45d6-8961-2c5ace9a6f4d ("Política_rev00", conteúdo
--     real, formalized_at 2026-09-14 17:43:12)
--   - 223dbc94-110e-44a6-a69a-1286305d1f67 (rótulo ".", content vazio,
--     formalized_at 2026-09-14 17:49:48 — MAIS recente)
--
-- `useQualityPolicyCurrent` (src/lib/queries/documentos.ts) busca a versão
-- vigente com `order by formalized_at desc limit 1`, então a Cedro estava
-- vendo a política EM BRANCO como se fosse a vigente, desde 2026-09-14.
--
-- Causa raiz: em 2026-09-14, `formalize_quality_policy(p_id, p_version_label)`
-- (20260825100200, versão antiga com rótulo digitado) só validava que o
-- RÓTULO não fosse vazio — nunca validou o CONTEÚDO. O rótulo "." confirma
-- que essa linha foi formalizada por essa função antiga (a atual, sem
-- rótulo manual, só existe desde 20260919100100). A versão vigente da
-- função tinha herdado a mesma lacuna; corrigida em
-- 20260921090000_quality_policy_formalize_requires_content.sql, que agora
-- impede formalizar com conteúdo vazio ou só espaços, em qualquer
-- organização — sem essa correção, o mesmo problema podia se repetir.
--
-- Esta migração é só a correção do DADO já existente, feita fora do fluxo
-- normal de UI (não há tela para "desformalizar" uma política) — daí não
-- passar pelo trigger `log_quality_policy_activity` (que só cobre
-- rascunho→formalizada e rascunho→descartada, não formalizada→descartada,
-- transição que não existe fora deste caso excepcional). Registrado aqui
-- em vez de em `activity_log` para não inserir fora de trigger (convenção
-- da seção 21.6 do Guia, reforçada no comentário de
-- 20260919100100_quality_policy_auto_label_and_discard.sql).
--
-- Não é DELETE (seção 20 do Guia, "nada é apagado") — marca 'descartada',
-- mesmo padrão do "Cancelar alteração" do Bloco 7. Não toca em content/
-- version_label/formalized_at/formalized_by: preserva o registro exato do
-- que aconteceu, só tira a linha do status que a query de "vigente" olha.
-- Alvo único, travado por id + org_id + status (idempotente).
update quality_policy
   set status = 'descartada'
 where id = '223dbc94-110e-44a6-a69a-1286305d1f67'
   and org_id = '4384a9fa-30b7-44bb-acf7-b07ade014c91'
   and status = 'formalizada';

-- Segunda parte do mesmo incidente, achada ao testar o efeito do fix
-- acima: `useQualityPolicyCurrent` busca primeiro `status = 'rascunho'`
-- (.maybeSingle()) e só cai para a última `formalizada` se NÃO houver
-- rascunho aberto. Existe um rascunho vazio (f9fba456-d550-4998-a431-
-- 8e9235f4459c) criado por Rachid Maluf 6 segundos depois de formalizar a
-- linha vazia acima (17:49:54, contra 17:49:48 da formalização) — sequência
-- consistente com: formalizou em branco, percebeu, clicou "Nova versão"
-- pra tentar corrigir, mas `start_new_quality_policy_version` copia o
-- conteúdo da ÚLTIMA formalizada, que no momento já era a vazia — o
-- rascunho novo nasceu vazio também, e nunca foi editado desde então.
-- Sem descartar este rascunho, a correção acima sozinha não bastaria: a
-- Cedro continuaria vendo esse rascunho em branco em vez de
-- "Política_rev00" como vigente. Mesmo efeito de clicar "Cancelar
-- alteração" na tela (RPC discard_quality_policy_draft) — UPDATE direto
-- aqui só pra documentar as duas pontas do mesmo incidente juntas.
update quality_policy
   set status = 'descartada'
 where id = 'f9fba456-d550-4998-a431-8e9235f4459c'
   and org_id = '4384a9fa-30b7-44bb-acf7-b07ade014c91'
   and status = 'rascunho';
