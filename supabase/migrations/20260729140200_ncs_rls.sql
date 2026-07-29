-- RLS de `ncs`. Mesmo mecanismo das tabelas de fundação: JWT custom claim
-- (auth.jwt() ->> 'org_id'), nunca current_setting (ver nota em
-- 20260729120100_foundation_rls.sql). Sem bypass para o time interno Lynvex:
-- `ncs` é tabela de negócio do painel do cliente, e a seção 4 do Guia de
-- Arquitetura reserva esse tipo de exceção só para as tabelas do painel
-- administrativo.

-- Escopo por unidade: se o vínculo do usuário com a organização ativa for
-- units_scope='specific', ele só enxerga NCs cujo unit_id esteja em
-- user_units_access. Se for 'all' (padrão — "todas, inclusive futuras",
-- seção 6 do Guia), enxerga todas as unidades. NC sem unit_id (unit_id is
-- null) é sempre visível — não fica sujeita a escopo de unidade.
create or replace function public.user_has_unit_access(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_unit_id is null
    or not exists (
      select 1 from user_organizations uo
      where uo.user_id = auth.uid()
        and uo.org_id = (auth.jwt() ->> 'org_id')::uuid
        and uo.units_scope = 'specific'
    )
    or exists (
      select 1 from user_units_access ua
      where ua.user_id = auth.uid()
        and ua.org_id = (auth.jwt() ->> 'org_id')::uuid
        and ua.unit_id = p_unit_id
    );
$$;

alter table ncs enable row level security;

create policy ncs_select_org
  on ncs for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

create policy ncs_insert_org
  on ncs for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

create policy ncs_update_org
  on ncs for update
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and public.user_has_unit_access(unit_id)
  );

-- DELETE bloqueado — nada apaga (seção 2 do Guia de Arquitetura). Cancelar é
-- um UPDATE de status para 'cancelado' com cancel_reason obrigatório
-- (constraint na tabela).
create policy ncs_no_delete
  on ncs for delete
  using (false);
