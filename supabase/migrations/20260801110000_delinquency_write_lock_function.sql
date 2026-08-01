-- Cadeado de escrita em RLS para a escada de inadimplência (seção 7 do
-- Guia de Arquitetura). Hoje a UI do cliente esconde os botões de
-- criar/editar quando delinquency_state.level é 'somente_leitura' ou
-- 'bloqueado', mas uma chamada direta à API contorna a UI e a escrita
-- ainda passa, porque a RLS de NC/Plano de Ação/Auditoria/Indicador só
-- verifica org_id, nunca o nível de inadimplência da org.
--
-- org_can_write(): único ponto de verdade sobre "esta org pode escrever
-- agora?", reusado em todas as políticas de INSERT/UPDATE das tabelas de
-- negócio do cliente (migração seguinte). SECURITY DEFINER porque o
-- usuário cliente não tem SELECT em delinquency_state (RLS restrita a
-- internal_staff — 20260730180200_admin_rls.sql) e a função precisa ler
-- essa tabela mesmo assim.
--
-- Exceção ativa (delinquency_state.exception_active, mecanismo criado em
-- set_delinquency_exception — 20260731090000_financial_functions.sql)
-- sempre libera a escrita, mesmo com nível ruim: é o gancho para o staff
-- segurar a régua manualmente durante uma renegociação.
--
-- SELECT nunca passa por aqui — só INSERT/UPDATE. Ler os próprios dados,
-- em qualquer nível, inclusive bloqueado, é garantia contratual (seção 7:
-- "cliente sempre pode exportar os dados dele, em qualquer degrau da
-- escada").
create or replace function public.org_can_write(check_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select ds.exception_active or ds.level in ('regular', 'aviso')
      from delinquency_state ds
      where ds.org_id = check_org_id
    ),
    true
  );
$$;

grant execute on function public.org_can_write(uuid) to authenticated;
