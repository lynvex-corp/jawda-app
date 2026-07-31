-- ABA 11, item 2: "usuário some/desativa após 30 dias sem uso" (seção 8 do
-- Guia). "Uso" definido como o mais recente entre: (a) último login
-- concluído (2FA verificado, org resolvida) e (b) última ação própria do
-- usuário registrada em activity_log (actor_type = 'user'). Guardado em
-- profiles.last_activity_at, coluna que já existia na fundação mas nunca
-- era escrita por ninguém.
--
-- Limite conhecido: durante uma sessão de impersonação (aba anterior), a
-- linha de activity_log nasce com actor_id = usuário-alvo / actor_type =
-- 'user' (é uma sessão REAL do usuário, só carimbada à parte em
-- impersonated_by_staff_id) — então uma ação feita pelo STAFF em nome do
-- cliente também atualiza o last_activity_at do cliente. Aceito por ora:
-- não é o caminho comum de uso e corrigir exigiria excluir esse caso aqui,
-- o que abriria uma bifurcação sutil entre "uso real" e "uso por procuração"
-- não pedida nesta aba.
--
-- Mecanismo de bloqueio: reaproveita o que o login já respeita hoje
-- (list_my_organizations filtra por user_organizations.is_active). A
-- rotina desativa TODOS os vínculos ativos do usuário (ele pode pertencer a
-- mais de uma empresa — seção 8) e marca profiles.status = 'inactive', que
-- até aqui existia mas nunca era lido por ninguém.

-- =========================================================================
-- 1. touch_last_activity — chamada pelo painel cliente logo após o login
--    concluir (2FA verificado, organização resolvida).
-- =========================================================================
create or replace function public.touch_last_activity()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set last_activity_at = now() where id = auth.uid();
$$;

grant execute on function public.touch_last_activity() to authenticated;

-- =========================================================================
-- 2. Trigger em activity_log — qualquer ação própria do usuário (não
--    system/ai/internal_staff) conta como uso.
-- =========================================================================
create or replace function public.touch_last_activity_from_activity_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.actor_type = 'user' and new.actor_id is not null then
    update profiles set last_activity_at = now() where id = new.actor_id;
  end if;
  return new;
end;
$$;

create trigger activity_log_touch_last_activity
  after insert on activity_log
  for each row execute function public.touch_last_activity_from_activity_log();

-- =========================================================================
-- 3. deactivate_inactive_users — varredura diária via pg_cron. Idempotente:
--    só afeta profiles.status = 'active' (rodar de novo sobre quem já foi
--    desativado não faz nada).
-- =========================================================================
create or replace function public.deactivate_inactive_users()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_org record;
begin
  for r in
    select id, coalesce(last_activity_at, created_at) as last_used_at
    from profiles
    where status = 'active'
      and coalesce(last_activity_at, created_at) < now() - interval '30 days'
  loop
    for v_org in
      select org_id from user_organizations
      where user_id = r.id and is_active
    loop
      insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
      values (v_org.org_id, null, 'system', 'desativou_usuario_por_inatividade', 'profiles', r.id,
        jsonb_build_object('ultima_atividade', r.last_used_at));
    end loop;

    update user_organizations set is_active = false
      where user_id = r.id and is_active;

    update profiles set status = 'inactive' where id = r.id;
  end loop;
end;
$$;

grant execute on function public.deactivate_inactive_users() to service_role;

select cron.schedule(
  'deactivate_inactive_users_daily',
  '10 3 * * *',
  $$select public.deactivate_inactive_users();$$
);
