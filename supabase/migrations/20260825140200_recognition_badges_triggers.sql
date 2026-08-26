-- Gatilhos do Painel de Reconhecimento.
--
-- "sem_nc_critica" é evento-driven de verdade: quebra na hora em que uma
-- NC crítica é criada.
--
-- "zero_planos_vencidos" e "treinamentos_no_prazo" não têm um evento único
-- de "isso venceu" — vencimento é a passagem do tempo, não um INSERT/
-- UPDATE. Seguem o mesmo padrão já usado neste projeto para varredura
-- diária (run_delinquency_check_daily, deactivate_inactive_users_daily):
-- uma função agendada via pg_cron que varre o que venceu nas últimas 24h
-- (janela evita quebrar o mesmo selo todo dia por um atraso já
-- contabilizado ontem).
--
-- IMPORTANTE: isto NÃO é a "rotina de SLA da seção 13" mencionada como
-- pendente no comentário de sync_action_plan_status() (20260729150200)
-- — aquela marcaria action_plans.status='atrasado' de verdade, é escopo
-- maior e não faz parte desta aba. A checagem abaixo só lê
-- when_end/data_planejada para decidir se o selo quebra, sem tocar em
-- status de nenhuma tabela de negócio.

create or replace function public.break_recognition_badge_on_critical_nc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_iniciado timestamptz;
  v_streak_days int;
begin
  if new.severity <> 'critica' then
    return new;
  end if;

  select event_date into v_last_iniciado
    from recognition_badge_events
    where org_id = new.org_id
      and badge_type = 'sem_nc_critica'
      and unit_id is not distinct from new.unit_id
      and event = 'iniciado'
    order by event_date desc
    limit 1;

  if v_last_iniciado is not null then
    v_streak_days := floor(extract(epoch from (now() - v_last_iniciado)) / 86400);
    insert into recognition_badge_events (org_id, unit_id, badge_type, event, streak_days_at_break)
      values (new.org_id, new.unit_id, 'sem_nc_critica', 'quebrado', v_streak_days);
  end if;

  insert into recognition_badge_events (org_id, unit_id, badge_type, event)
    values (new.org_id, new.unit_id, 'sem_nc_critica', 'iniciado');

  return new;
end;
$$;

create trigger ncs_break_recognition_badge
  after insert on ncs
  for each row execute function public.break_recognition_badge_on_critical_nc();

create or replace function public.check_recognition_badge_deadlines()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_last_iniciado timestamptz;
  v_streak_days int;
begin
  -- Ações corretivas vencidas (when_end passado, status <> 'encerrada')
  -- nas últimas 24h.
  for r in
    select distinct org_id, unit_id
    from action_plan_corrective_actions
    where status <> 'encerrada'
      and when_end < now()
      and when_end >= now() - interval '1 day'
  loop
    select event_date into v_last_iniciado
      from recognition_badge_events
      where org_id = r.org_id
        and badge_type = 'zero_planos_vencidos'
        and unit_id is not distinct from r.unit_id
        and event = 'iniciado'
      order by event_date desc
      limit 1;

    if v_last_iniciado is not null then
      v_streak_days := floor(extract(epoch from (now() - v_last_iniciado)) / 86400);
      insert into recognition_badge_events (org_id, unit_id, badge_type, event, streak_days_at_break)
        values (r.org_id, r.unit_id, 'zero_planos_vencidos', 'quebrado', v_streak_days);
    end if;

    insert into recognition_badge_events (org_id, unit_id, badge_type, event)
      values (r.org_id, r.unit_id, 'zero_planos_vencidos', 'iniciado');
  end loop;

  -- Sessões de treinamento com data planejada vencida sem realização, nas
  -- últimas 24h. training_sessions não tem unit_id na origem — selo fica
  -- no nível da organização (unit_id null).
  for r in
    select distinct org_id
    from training_sessions
    where status = 'planejada'
      and data_planejada < current_date
      and data_planejada >= current_date - 1
  loop
    select event_date into v_last_iniciado
      from recognition_badge_events
      where org_id = r.org_id
        and badge_type = 'treinamentos_no_prazo'
        and unit_id is null
        and event = 'iniciado'
      order by event_date desc
      limit 1;

    if v_last_iniciado is not null then
      v_streak_days := floor(extract(epoch from (now() - v_last_iniciado)) / 86400);
      insert into recognition_badge_events (org_id, unit_id, badge_type, event, streak_days_at_break)
        values (r.org_id, null, 'treinamentos_no_prazo', 'quebrado', v_streak_days);
    end if;

    insert into recognition_badge_events (org_id, unit_id, badge_type, event)
      values (r.org_id, null, 'treinamentos_no_prazo', 'iniciado');
  end loop;
end;
$$;

select cron.schedule(
  'check_recognition_badges_daily',
  '0 4 * * *',
  $$select public.check_recognition_badge_deadlines();$$
);
