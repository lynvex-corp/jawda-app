-- Fecha o gap descoberto ao auditar o convite de dono de empresa (ABA 8,
-- jawda-admin): o usuário é criado via auth.admin.inviteUserByEmail sem
-- senha e sem 2FA, então nunca chega a aal2 pelo caminho normal do /login —
-- fica preso lá sem ter senha nenhuma pra digitar. profiles.status já tinha
-- o valor 'invited' previsto no CHECK constraint da fundação, mas nada
-- nunca escrevia esse valor nem lia ele pra decidir alguma coisa; era um
-- valor de schema morto. Esta migração ativa esse valor de verdade:
-- jawda-admin passa a gravar 'invited' ao convidar, e o app cliente passa a
-- checar isso no beforeLoad (src/lib/supabase-server.ts) pra mandar a
-- sessão pra /primeiro-acesso em vez de /login.

-- Mesmo gap de profiles_update_self já documentado em
-- 20260731140000_must_reset_password_enforcement.sql: a policy libera
-- update de QUALQUER coluna na própria linha, então sem esta trigger o
-- próprio usuário poderia `update profiles set status = 'active'` direto
-- pelo client e pular o /primeiro-acesso (ou reverter uma desativação).
-- service_role é a exceção — é a chave usada pelo convite em jawda-admin,
-- que já tem acesso total ao banco; restringi-la aqui seria só teatro.
create or replace function public.protect_profiles_status_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and auth.role() <> 'service_role'
     and coalesce(current_setting('jawda.allow_status_change', true), '') <> 'true' then
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_status
  before update on profiles
  for each row execute function public.protect_profiles_status_column();

-- complete_first_access — chamada pelo painel cliente ao final do fluxo
-- /primeiro-acesso (senha definida + 2FA já verificado, sessão em aal2).
-- Só libera a PRÓPRIA sessão (auth.uid()), igual clear_must_reset_password.
create or replace function public.complete_first_access()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('jawda.allow_status_change', 'true', true);
  update profiles set status = 'active' where id = auth.uid();
end;
$$;

grant execute on function public.complete_first_access() to authenticated;
