-- Correção da migration 20260731140100_inactivity_deactivation.sql.
--
-- Mesmo padrão encontrado em 20260731140200 (fix da migration anterior): o
-- diagnóstico depois da aplicação "sem erro" mostrou que a trigger
-- activity_log_touch_last_activity não existe (confirmado por pg_trigger e
-- pelo teste 4 falhando — last_activity_at do usuário A não é atualizado
-- por ação em activity_log). Sem uma explicação confiável de QUAIS partes
-- do arquivo original aplicaram e quais não — duas hipóteses de mecanismo
-- já foram tentadas e contrariadas pelos fatos — a resposta é não confiar
-- em nenhuma leitura parcial e reaplicar o arquivo inteiro de forma
-- idempotente.
--
-- Todas as instruções abaixo são seguras de rodar de novo independente do
-- estado atual: create or replace function, drop trigger if exists +
-- create trigger, grant (no-op se já concedido), cron.schedule (idempotente
-- por nome de job, conforme já documentado em 20260731090100_delinquency_cron.sql).

create or replace function public.touch_last_activity()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set last_activity_at = now() where id = auth.uid();
$$;

grant execute on function public.touch_last_activity() to authenticated;

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

drop trigger if exists activity_log_touch_last_activity on activity_log;

create trigger activity_log_touch_last_activity
  after insert on activity_log
  for each row execute function public.touch_last_activity_from_activity_log();

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
