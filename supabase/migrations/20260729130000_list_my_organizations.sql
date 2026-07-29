-- Helper para o seletor de empresa no topbar (seção 8 do Guia de Arquitetura:
-- "Um usuário pode pertencer a mais de uma empresa, com seletor no topo").
--
-- Gap descoberto ao implementar o login: as políticas de RLS de
-- user_organizations filtram por org_id = auth.jwt() ->> 'org_id' (a
-- organização ATUAL do usuário). Isso impede o próprio usuário de listar
-- as OUTRAS empresas às quais pertence para oferecê-las no seletor — ele só
-- enxergaria a linha da empresa já ativa. security definer + filtro por
-- auth.uid() resolve sem abrir a tabela: cada usuário só lista os próprios
-- vínculos, nunca os de terceiros.

create or replace function public.list_my_organizations()
returns table (
  org_id uuid,
  legal_name text,
  trade_name text,
  role text,
  is_current boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.legal_name,
    o.trade_name,
    uo.role,
    (o.id = public.get_current_org()) as is_current
  from user_organizations uo
  join organizations o on o.id = uo.org_id
  where uo.user_id = auth.uid()
    and uo.is_active
  order by o.legal_name;
$$;

grant execute on function public.list_my_organizations() to authenticated;
