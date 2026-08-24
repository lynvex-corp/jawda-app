-- Trilha de auditoria (escrita, via trigger — seção 21.6) + RPC de log de
-- leitura de dossiê (não dá pra logar SELECT com trigger, ver decisão em
-- 20260825090100) + abertura automática de Ação de Competência.

create or replace function public.log_job_position_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'criou', 'job_position', new.id, jsonb_build_object('nome', new.nome));
  elsif tg_op = 'UPDATE' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'atualizou', 'job_position', new.id, jsonb_build_object('nome', new.nome));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger job_positions_activity_log
  after insert or update on job_positions
  for each row execute function public.log_job_position_activity();

-- Trilha de employees: mais detalhada que o padrão (quem criou/editou o
-- registro de quem — seção 18 do prompt desta aba pede rigor extra aqui).
create or replace function public.log_employee_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'criou', 'employee', new.id, jsonb_build_object('nome', new.nome));
  elsif tg_op = 'UPDATE' then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (
      new.org_id, v_actor, 'atualizou', 'employee', new.id,
      jsonb_build_object(
        'nome', new.nome,
        'situacao_anterior', old.situacao_competencia,
        'situacao_nova', new.situacao_competencia
      )
    );
  end if;
  return coalesce(new, old);
end;
$$;

create trigger employees_activity_log
  after insert or update on employees
  for each row execute function public.log_employee_activity();

-- Regra do prompt: situação virando 'atende_parcialmente' ou 'nao_atende'
-- abre Ação de Competência sozinha (nunca por botão manual). Não duplica
-- se já existe uma ação 'aberta' para o funcionário — evita empilhar
-- ações repetidas a cada pequena edição do registro.
create or replace function public.open_competency_action_on_situation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.situacao_competencia in ('atende_parcialmente', 'nao_atende')
     and (tg_op = 'INSERT' or new.situacao_competencia is distinct from old.situacao_competencia)
     and not exists (
       select 1 from competency_actions
       where employee_id = new.id and status = 'aberta'
     )
  then
    insert into competency_actions (employee_id, methodology, expected_date, created_by)
    values (
      new.id, 'A definir', current_date + interval '30 days', new.created_by
    );
  end if;
  return new;
end;
$$;

create trigger employees_open_competency_action
  after insert or update on employees
  for each row execute function public.open_competency_action_on_situation_change();

create or replace function public.log_employee_attachment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
begin
  if v_actor is null then
    return new;
  end if;
  select org_id into v_org_id from employees where id = new.employee_id;
  insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
  values (
    v_org_id, v_actor, 'anexou_documento', 'employee', new.employee_id,
    jsonb_build_object('category', new.category, 'source', new.source, 'attachment_id', new.id)
  );
  return new;
end;
$$;

create trigger employee_attachments_activity_log
  after insert on employee_attachments
  for each row execute function public.log_employee_attachment_activity();

create or replace function public.log_competency_action_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
begin
  select org_id into v_org_id from employees where id = coalesce(new.employee_id, old.employee_id);
  if tg_op = 'INSERT' then
    -- v_actor pode ser nulo aqui (aberta automaticamente pelo trigger de
    -- employees, sem ator humano na sessão de quem editou o registro
    -- indiretamente) — nesse caso o próprio log de employees já cobre a
    -- mudança de situação; só registra ação humana explícita.
    if v_actor is not null then
      insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
      values (v_org_id, v_actor, 'abriu_acao_competencia', 'employee', new.employee_id,
        jsonb_build_object('competency_action_id', new.id, 'methodology', new.methodology));
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status = 'concluida' and old.status <> 'concluida' and v_actor is not null then
    insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
    values (v_org_id, v_actor, 'concluiu_acao_competencia', 'employee', new.employee_id,
      jsonb_build_object('competency_action_id', new.id));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger competency_actions_activity_log
  after insert or update on competency_actions
  for each row execute function public.log_competency_action_activity();

-- RPC de log de LEITURA de dossiê individual — chamada pelo frontend ao
-- abrir a tela de detalhe de um funcionário (não decide acesso, só
-- registra; a RLS de employees continua sendo a única barreira real —
-- ver decisão completa em 20260825090100).
create or replace function public.log_employee_dossie_access(p_employee_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return;
  end if;
  -- security invoker: só enxerga a linha (e portanto só loga) se a RLS de
  -- employees já permitir a leitura pra esse usuário.
  select org_id into v_org_id from employees where id = p_employee_id;
  if v_org_id is null then
    return;
  end if;
  perform public.write_employee_access_log(v_org_id, v_actor, p_employee_id);
end;
$$;

create or replace function public.write_employee_access_log(p_org_id uuid, p_actor uuid, p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activity_log (org_id, actor_id, action, entity_type, entity_id, detail)
  values (p_org_id, p_actor, 'visualizou_dossie', 'employee', p_employee_id, '{}'::jsonb);
end;
$$;
