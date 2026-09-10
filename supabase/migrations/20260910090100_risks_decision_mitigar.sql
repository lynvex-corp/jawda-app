-- Bloco 2, item 8: faltava "Mitigar" no campo Decisão de Riscos e
-- Oportunidades.
--
-- A lista não estava só no TypeScript — `decision` tem check constraint no
-- banco aceitando apenas evitar/assumir/eliminar_fonte/compartilhar, então
-- adicionar a opção só na UI faria a gravação falhar com erro 23514 na
-- primeira tentativa de uso.
--
-- A constraint foi declarada inline em 20260823130400, sem nome explícito,
-- então o Postgres a nomeou por convenção. O bloco abaixo derruba pelo nome
-- convencional e também por varredura, para o script não quebrar caso o
-- nome tenha divergido em algum ambiente.

do $$
declare
  v_nome text;
begin
  select con.conname into v_nome
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'risks_opportunities'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%decision%'
  limit 1;

  if v_nome is not null then
    execute format('alter table risks_opportunities drop constraint %I', v_nome);
  end if;
end $$;

alter table risks_opportunities
  add constraint risks_opportunities_decision_check
  check (decision in ('assumir', 'compartilhar', 'eliminar_fonte', 'evitar', 'mitigar'));
