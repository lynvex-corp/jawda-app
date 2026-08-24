-- Fix: training_applicability é a célula marcada/desmarcada da matriz
-- cargo × treinamento — um toggle de associação, sem conteúdo próprio e
-- sem valor de trilha histórica (diferente de um registro de negócio como
-- NC/plano/auditoria, onde "nada apaga" existe porque a exclusão em si é
-- informação relevante). Bloquear DELETE aqui (como saiu em
-- 20260825091100, seguindo por reflexo o padrão geral) só cria fricção
-- na UI de matriz sem nenhum ganho — desmarcar uma célula errada exige
-- poder desfazer. Permitindo DELETE só nesta tabela, com a mesma trava de
-- org_id/org_can_write via join.

drop policy training_applicability_no_update on training_applicability;
create policy training_applicability_no_update
  on training_applicability for update
  using (false);

drop policy training_applicability_no_delete on training_applicability;
create policy training_applicability_delete_org
  on training_applicability for delete
  using (
    exists (
      select 1 from trainings t
      where t.id = training_applicability.training_id
        and t.org_id = (auth.jwt() ->> 'org_id')::uuid
        and public.org_can_write(t.org_id)
    )
  );

grant delete on training_applicability to authenticated;
