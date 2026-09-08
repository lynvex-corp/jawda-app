-- contract_modules.updated_at / contract_norms.updated_at nunca saíam do
-- valor de criação: as duas colunas têm `default now()`, mas o default só
-- vale no INSERT. O Admin liga/desliga módulo com um upsert
-- (INSERT ... ON CONFLICT DO UPDATE, ver useToggleContractModule em
-- jawda-admin/src/lib/queries/organizations.ts), e no caminho de UPDATE
-- ninguém reescrevia a coluna — então a data de "última alteração do
-- módulo" ficava congelada na data de provisionamento do contrato, mesmo
-- depois de vários toggles.
--
-- Não altera nenhuma regra de acesso: `enabled` sempre foi gravado
-- corretamente (o activity_log já registrava ativou_modulo/desativou_modulo
-- com autor e data). Isto só conserta o carimbo de tempo da própria linha.
--
-- Trigger BEFORE UPDATE, e não `set updated_at = now()` no cliente: o
-- carimbo tem que valer para QUALQUER escrita (upsert do Admin, RPC futura,
-- correção manual via service_role), não só para o caminho que hoje existe
-- na UI.

create or replace function public.touch_contract_scope_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists contract_modules_touch_updated_at on contract_modules;
create trigger contract_modules_touch_updated_at
  before update on contract_modules
  for each row execute function public.touch_contract_scope_updated_at();

drop trigger if exists contract_norms_touch_updated_at on contract_norms;
create trigger contract_norms_touch_updated_at
  before update on contract_norms
  for each row execute function public.touch_contract_scope_updated_at();
