-- Mapa de Processos, Bloco D: vínculo com Indicadores.
--
-- Sem tabela de KPI nova — reaproveita `indicators`/`indicator_measurements`
-- que já existem no módulo Indicadores, como decidido no plano original.
-- Um indicador por processo (não uma tabela de junção com is_primary): os
-- prints de referência mostram um KPI só por cartão; se a organização
-- quiser mais de um indicador por processo no futuro, uma tabela de
-- junção é extensão simples — não vale a complexidade agora pra um caso
-- que não foi pedido.

alter table process_maps
  add column if not exists indicator_id uuid references indicators(id);
