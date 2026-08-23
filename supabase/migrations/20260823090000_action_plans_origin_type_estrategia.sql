-- Migração da Estratégia (Aba 16) — Parte 0, item 2. `action_plans.origin_type`
-- já cobria quase tudo que o prototipo de Estratégia usa
-- ('risco_oportunidade','analise_critica','melhoria_continua','estrategia'
-- já existiam desde 20260729150000_action_plans_table.sql). Só faltava
-- 'avaliacao_desempenho'. Constraint recriada via nome descoberto em
-- pg_constraint em vez de assumir o nome padrão do Postgres
-- (action_plans_origin_type_check), por segurança.
--
-- `ncs.swot_forwarded` (item 1 da Parte 0) já existia desde
-- 20260729140100_ncs_table.sql — nenhuma ação necessária.

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'action_plans'::regclass
    and pg_get_constraintdef(oid) ilike '%origin_type%';
  if con_name is not null then
    execute format('alter table action_plans drop constraint %I', con_name);
  end if;
end $$;

alter table action_plans add constraint action_plans_origin_type_check
  check (origin_type in (
    'nao_conformidade','auditoria_interna','auditoria_externa','risco_oportunidade',
    'analise_critica','reclamacao_cliente','melhoria_continua','estrategia',
    'avaliacao_desempenho'
  ));
