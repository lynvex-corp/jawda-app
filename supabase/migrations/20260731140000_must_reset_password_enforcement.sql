-- ABA 11, item 1: fecha o gap deixado explicitamente em aberto pela migração
-- que criou must_reset_password (20260731120000) — "app checando esse flag
-- no primeiro carregamento do painel cliente (fora do escopo desta
-- migração)".
--
-- Gap de segurança adicional descoberto ao implementar isto: a policy
-- profiles_update_self (20260729120100_foundation_rls.sql) libera update de
-- QUALQUER coluna na própria linha, sem distinção — ou seja, hoje o próprio
-- usuário poderia dar `update profiles set must_reset_password = false`
-- direto pelo client (PostgREST) e escapar da obrigação sem nunca trocar a
-- senha de verdade. RLS é por linha, não por coluna, então quem fecha essa
-- porta é uma trigger: só aceita a mudança de must_reset_password quando ela
-- vem de dentro de uma função SECURITY DEFINER que sinalizou a intenção via
-- set_config local à própria transação (nunca sobrevive entre chamadas do
-- PostgREST — mesma ressalva já registrada em foundation_rls.sql, mas aqui
-- o set+update acontece na MESMA transação/função, o que é seguro).

create or replace function public.protect_must_reset_password_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.must_reset_password is distinct from old.must_reset_password
     and coalesce(current_setting('jawda.allow_must_reset_password_change', true), '') <> 'true' then
    new.must_reset_password := old.must_reset_password;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_must_reset_password
  before update on profiles
  for each row execute function public.protect_must_reset_password_column();

-- force_password_reset (staff liga o flag) precisa da permissão explícita
-- para a própria trigger acima não reverter o update que ela mesma faz.
create or replace function public.force_password_reset(p_user_id uuid, p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if not public.is_internal_staff() then
    raise exception 'Apenas a equipe interna Lynvex pode forçar redefinição de senha';
  end if;
  if p_staff_id is distinct from auth.uid() then
    raise exception 'staff_id não corresponde ao usuário autenticado';
  end if;

  perform set_config('jawda.allow_must_reset_password_change', 'true', true);
  update profiles set must_reset_password = true where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  select active_org_id into v_org_id from profiles where id = p_user_id;

  if v_org_id is not null then
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (v_org_id, p_staff_id, 'internal_staff', 'forcou_redefinicao_senha', 'profiles', p_user_id, '{}'::jsonb);

    perform public.log_admin_org_access(p_staff_id, v_org_id,
      format('Forçou redefinição de senha do usuário %s', p_user_id));
  end if;
end;
$$;

-- =========================================================================
-- clear_must_reset_password — chamada pelo painel cliente logo depois de
-- supabase.auth.updateUser({ password }) ter sucesso (rota /redefinir-senha).
-- Só desliga o flag da PRÓPRIA sessão (auth.uid()), nunca de terceiros — não
-- precisa checar is_internal_staff porque não é uma ação administrativa.
-- =========================================================================
create or replace function public.clear_must_reset_password()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('jawda.allow_must_reset_password_change', 'true', true);
  update profiles set must_reset_password = false where id = auth.uid();
end;
$$;

grant execute on function public.clear_must_reset_password() to authenticated;
