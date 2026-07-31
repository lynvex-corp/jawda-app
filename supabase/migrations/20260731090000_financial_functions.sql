-- Operação do módulo Financeiro (Aba Financeiro). As tabelas plans/invoices/
-- payment_events/delinquency_state já existem (ABA 8) — esta migração não
-- recria schema, só adiciona as colunas operacionais que faltavam e as
-- funções que fazem a régua rodar de verdade.

-- =========================================================================
-- 1. Colunas operacionais que faltavam em delinquency_state
-- =========================================================================
-- ABA 8 criou aviso_after_days/somente_leitura_after_days com defaults
-- provisórios (5/15). O prompt desta aba fixa os 4 gatilhos da seção 7 do
-- Guia com valores explícitos (5/10/20/30) — ajustados aqui via novo default
-- de coluna (não retroage sobre organizações já provisionadas).
--
-- email_notice_after_days/email_notice_sent_at: o Guia lista o aviso por
-- e-mail (1º gatilho) como uma ação distinta do banner (2º gatilho, nível
-- 'aviso'), mas o enum de level só tem 4 valores incluindo 'regular' — não
-- há um 5º nível só para "e-mail enviado". Em vez de inflar o enum, o envio
-- de e-mail vira um evento registrado (sent_at), independente do nível.
--
-- exception_*: gancho pedido nesta aba — staff segura a régua manualmente
-- pra uma org em renegociação, com motivo obrigatório.
alter table delinquency_state
  alter column aviso_after_days set default 10,
  alter column somente_leitura_after_days set default 20,
  add column email_notice_after_days integer not null default 5,
  add column email_notice_sent_at timestamptz,
  add column exception_active boolean not null default false,
  add column exception_reason text,
  add column exception_set_by uuid references internal_staff(id),
  add column exception_set_at timestamptz;

-- =========================================================================
-- 2. Colunas operacionais que faltavam em invoices
-- =========================================================================
-- is_avulsa distingue cobrança avulsa (fora do ciclo) da fatura regular do
-- contrato — sem isso, a trilha não consegue rotular a origem corretamente
-- nem a regra de "uma fatura regular por competência" pode existir (uma
-- empresa pode ter várias cobranças avulsas na mesma competência).
alter table invoices
  add column is_avulsa boolean not null default false,
  add column description text;

-- Trava uma única fatura REGULAR (não avulsa, não cancelada) por org e
-- competência — gerar duas vezes a mesma competência por engano é o erro
-- mais provável de operação manual.
create unique index invoices_org_competence_regular_idx
  on invoices(org_id, competence)
  where is_avulsa = false and status <> 'cancelled';

-- =========================================================================
-- 3. Gap de fundação: activity_log.actor_id era NOT NULL
-- =========================================================================
-- O enum actor_type já previa 'system' desde a Aba 4 (rotina automática),
-- mas nenhuma aba anterior de fato gravou uma linha com esse actor_type —
-- run_delinquency_check() é o primeiro caso real de evento sem nenhum ator
-- humano (roda via pg_cron, sem JWT, auth.uid() é null). Sem essa alteração,
-- a trilha automática da régua nunca conseguiria gravar.
alter table activity_log alter column actor_id drop not null;
alter table activity_log add constraint activity_log_actor_id_required_unless_system
  check (actor_type = 'system' or actor_id is not null);

-- =========================================================================
-- 4. generate_invoice — fatura regular a partir do contrato ativo
-- =========================================================================
-- security invoker: quem chama já precisa ser internal_staff (checado no
-- topo, e a RLS de invoices/payment_events reforça isso de novo — mesmo
-- padrão de defesa em profundidade do admin_provision_organization).
create or replace function public.generate_invoice(p_org_id uuid, p_competencia date)
returns invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_contract contracts%rowtype;
  v_extra numeric(10,2) := 0;
  v_amount numeric(10,2);
  v_due_date date;
  v_invoice invoices%rowtype;
begin
  if not public.is_internal_staff() then
    raise exception 'Apenas a equipe interna Lynvex pode gerar faturas';
  end if;

  select * into v_contract from contracts where org_id = p_org_id and status = 'active';
  if not found then
    raise exception 'Organização não tem contrato ativo';
  end if;

  if exists (
    select 1 from invoices
    where org_id = p_org_id and competence = p_competencia
      and is_avulsa = false and status <> 'cancelled'
  ) then
    raise exception 'Já existe fatura da competência % para esta organização',
      to_char(p_competencia, 'MM/YYYY');
  end if;

  select coalesce(sum(extra_monthly_value), 0) into v_extra
  from contract_modules where contract_id = v_contract.id and enabled;

  select v_extra + coalesce(sum(cn.extra_monthly_value), 0) into v_extra
  from contract_norms cn where cn.contract_id = v_contract.id and cn.enabled;

  v_amount := v_contract.monthly_value + v_extra;
  -- Vencimento padrão: dia 10 do mês de competência (convenção simples, sem
  -- campo de "dia de vencimento" configurável no contrato ainda).
  v_due_date := date_trunc('month', p_competencia)::date + 9;

  insert into invoices (org_id, contract_id, competence, issued_at, due_date, amount, status, created_by)
  values (p_org_id, v_contract.id, p_competencia, current_date, v_due_date, v_amount, 'pending', auth.uid())
  returning * into v_invoice;

  insert into payment_events (org_id, invoice_id, event_type, detail, created_by)
  values (p_org_id, v_invoice.id, 'invoice_created',
    jsonb_build_object('amount', v_amount, 'competence', p_competencia, 'avulsa', false),
    auth.uid());

  perform public.log_admin_org_access(
    auth.uid(), p_org_id,
    format('Gerou fatura da competência %s', to_char(p_competencia, 'MM/YYYY'))
  );

  return v_invoice;
end;
$$;

grant execute on function public.generate_invoice(uuid, date) to authenticated;

-- =========================================================================
-- 5. generate_invoice_avulsa — cobrança fora do ciclo
-- =========================================================================
create or replace function public.generate_invoice_avulsa(
  p_org_id uuid,
  p_amount numeric,
  p_description text,
  p_due_date date default (current_date + 10)
)
returns invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_contract_id uuid;
  v_invoice invoices%rowtype;
begin
  if not public.is_internal_staff() then
    raise exception 'Apenas a equipe interna Lynvex pode gerar cobranças avulsas';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor da cobrança avulsa deve ser maior que zero';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'Descrição da cobrança avulsa é obrigatória';
  end if;

  select id into v_contract_id from contracts where org_id = p_org_id and status = 'active';
  if not found then
    raise exception 'Organização não tem contrato ativo';
  end if;

  insert into invoices (
    org_id, contract_id, competence, issued_at, due_date, amount, status,
    is_avulsa, description, created_by
  )
  values (
    p_org_id, v_contract_id, date_trunc('month', current_date)::date, current_date, p_due_date,
    p_amount, 'pending', true, p_description, auth.uid()
  )
  returning * into v_invoice;

  insert into payment_events (org_id, invoice_id, event_type, detail, created_by)
  values (p_org_id, v_invoice.id, 'invoice_created',
    jsonb_build_object('amount', p_amount, 'avulsa', true, 'descricao', p_description),
    auth.uid());

  perform public.log_admin_org_access(auth.uid(), p_org_id, format('Gerou cobrança avulsa: %s', p_description));

  return v_invoice;
end;
$$;

grant execute on function public.generate_invoice_avulsa(uuid, numeric, text, date) to authenticated;

-- =========================================================================
-- 6. mark_invoice_paid — marca pagamento manual e reseta a régua
-- =========================================================================
create or replace function public.mark_invoice_paid(
  p_invoice_id uuid,
  p_payment_method text,
  p_paid_at timestamptz default now()
)
returns invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice invoices%rowtype;
  v_other_overdue boolean;
begin
  if not public.is_internal_staff() then
    raise exception 'Apenas a equipe interna Lynvex pode marcar faturas como pagas';
  end if;
  if p_payment_method is null then
    raise exception 'Forma de pagamento é obrigatória';
  end if;

  select * into v_invoice from invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Fatura não encontrada';
  end if;
  if v_invoice.status = 'paid' then
    raise exception 'Fatura já está marcada como paga';
  end if;

  update invoices
    set status = 'paid', payment_method = p_payment_method, paid_at = coalesce(p_paid_at, now())
    where id = p_invoice_id
    returning * into v_invoice;

  insert into payment_events (org_id, invoice_id, event_type, detail, created_by)
  values (v_invoice.org_id, v_invoice.id, 'payment_received',
    jsonb_build_object('payment_method', p_payment_method, 'paid_at', v_invoice.paid_at), auth.uid());

  -- Só reseta a régua pra 'regular' se não sobrar NENHUMA outra fatura
  -- vencida em aberto: pagar uma fatura isolada não pode "limpar" o estado
  -- se a empresa ainda deve outra fatura vencida — o próximo
  -- run_delinquency_check reavaliaria e voltaria a subir de qualquer forma,
  -- então resetar aqui seria só um flash de estado incorreto pro cliente.
  select exists (
    select 1 from invoices
    where org_id = v_invoice.org_id and status in ('pending', 'overdue') and due_date < current_date
  ) into v_other_overdue;

  if not v_other_overdue then
    update delinquency_state
      set level = 'regular', entered_at = now(), email_notice_sent_at = null,
          exception_active = false, exception_reason = null,
          updated_at = now(), updated_by = auth.uid()
      where org_id = v_invoice.org_id and level <> 'regular';

    update organizations set status = 'active' where id = v_invoice.org_id and status <> 'active';
  end if;

  perform public.log_admin_org_access(
    auth.uid(), v_invoice.org_id,
    format('Marcou fatura %s como paga (%s)', v_invoice.id, p_payment_method)
  );

  return v_invoice;
end;
$$;

grant execute on function public.mark_invoice_paid(uuid, text, timestamptz) to authenticated;

-- =========================================================================
-- 7. set_delinquency_exception — staff segura a régua manualmente
-- =========================================================================
-- p_active default true "liga" a exceção; chamar de novo com p_active=false
-- e um motivo (ex.: "negociação concluída") "desliga" — sem isso não
-- existiria forma de a régua voltar a avançar depois de uma renegociação.
create or replace function public.set_delinquency_exception(
  p_org_id uuid,
  p_reason text,
  p_staff_id uuid,
  p_active boolean default true
)
returns delinquency_state
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_state delinquency_state%rowtype;
begin
  if not public.is_internal_staff() then
    raise exception 'Apenas a equipe interna Lynvex pode registrar exceção na régua de inadimplência';
  end if;
  if p_staff_id is distinct from auth.uid() then
    raise exception 'staff_id não corresponde ao usuário autenticado';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Motivo é obrigatório para registrar ou encerrar uma exceção';
  end if;

  update delinquency_state
    set exception_active = p_active,
        exception_reason = p_reason,
        exception_set_by = p_staff_id,
        exception_set_at = now(),
        updated_at = now()
    where org_id = p_org_id
    returning * into v_state;

  if not found then
    raise exception 'Organização sem estado de inadimplência (não provisionada)';
  end if;

  return v_state;
end;
$$;

grant execute on function public.set_delinquency_exception(uuid, text, uuid, boolean) to authenticated;

-- =========================================================================
-- 8. run_delinquency_check — varredura diária (chamada pelo pg_cron)
-- =========================================================================
-- security definer, sem checagem de is_internal_staff(): quem dispara isso
-- é o pg_cron (sem JWT, auth.uid() null) — uma checagem de staff bloquearia
-- o próprio cron. Controle de acesso é feito por GRANT (só service_role),
-- não por lógica interna.
create or replace function public.run_delinquency_check()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_days_overdue integer;
  v_new_level text;
  v_org_status text;
begin
  update invoices set status = 'overdue'
    where status = 'pending' and due_date < current_date;

  for r in
    select
      ds.org_id,
      ds.level as current_level,
      ds.exception_active,
      ds.email_notice_after_days,
      ds.aviso_after_days,
      ds.somente_leitura_after_days,
      ds.bloqueado_after_days,
      ds.email_notice_sent_at,
      min(i.due_date) as oldest_due_date
    from delinquency_state ds
    left join invoices i on i.org_id = ds.org_id and i.status = 'overdue'
    group by ds.org_id, ds.level, ds.exception_active, ds.email_notice_after_days,
      ds.aviso_after_days, ds.somente_leitura_after_days, ds.bloqueado_after_days,
      ds.email_notice_sent_at
  loop
    -- Staff segurou a régua pra esta org — não avança nem regulariza sozinho.
    if r.exception_active then
      continue;
    end if;

    -- Sem nenhuma fatura vencida em aberto: garante que o estado é 'regular'
    -- (rede de segurança — mark_invoice_paid já cobre o caso comum).
    if r.oldest_due_date is null then
      if r.current_level <> 'regular' then
        update delinquency_state
          set level = 'regular', entered_at = now(), email_notice_sent_at = null,
              updated_at = now(), updated_by = null
          where org_id = r.org_id;
        update organizations set status = 'active' where id = r.org_id;
      end if;
      continue;
    end if;

    v_days_overdue := current_date - r.oldest_due_date;

    -- 1º gatilho: aviso por e-mail — ação isolada, não é um "nível" da régua.
    -- A integração real com Resend fica para a sprint de notificações; aqui
    -- só marca que o aviso venceu e ficou registrado na trilha.
    if v_days_overdue >= r.email_notice_after_days and r.email_notice_sent_at is null then
      update delinquency_state set email_notice_sent_at = now(), updated_at = now()
        where org_id = r.org_id;
      insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
      values (r.org_id, null, 'system', 'enviou_aviso_inadimplencia_email', 'delinquency_state', r.org_id,
        jsonb_build_object('dias_atraso', v_days_overdue));
    end if;

    -- 2º/3º/4º gatilhos: banner, somente leitura, bloqueio.
    v_new_level :=
      case
        when v_days_overdue >= r.bloqueado_after_days then 'bloqueado'
        when v_days_overdue >= r.somente_leitura_after_days then 'somente_leitura'
        when v_days_overdue >= r.aviso_after_days then 'aviso'
        else 'regular'
      end;

    if v_new_level <> r.current_level then
      update delinquency_state
        set level = v_new_level, entered_at = now(), updated_at = now(), updated_by = null
        where org_id = r.org_id;

      v_org_status := case v_new_level
        when 'bloqueado' then 'blocked'
        when 'somente_leitura' then 'read_only'
        when 'aviso' then 'aware'
        else 'active'
      end;
      update organizations set status = v_org_status where id = r.org_id;
    end if;
  end loop;
end;
$$;

grant execute on function public.run_delinquency_check() to service_role;

-- =========================================================================
-- 9. Trilha automática de invoices e delinquency_state
-- =========================================================================
-- generate_invoice/generate_invoice_avulsa/mark_invoice_paid/
-- set_delinquency_exception são security invoker (rodam como o staff
-- autenticado) — um insert direto em activity_log de dentro deles falharia
-- (authenticated nunca tem GRANT de insert nessa tabela, de propósito, ver
-- 20260729140000_activity_log.sql e a correção de 20260730180500). Mesmo
-- padrão de log_contract_change/log_contract_module_change: a trilha nasce
-- de uma trigger SECURITY DEFINER presa à tabela de negócio.
create or replace function public.log_invoice_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := case when new.is_avulsa then 'gerou_cobranca_avulsa' else 'gerou_fatura' end;
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'internal_staff', v_action, 'invoice', new.id,
      jsonb_build_object('competencia', new.competence, 'valor', new.amount,
        'vencimento', new.due_date, 'descricao', new.description));
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status
      and new.status in ('paid', 'cancelled') then
    v_action := case when new.status = 'paid' then 'marcou_fatura_paga' else 'cancelou_fatura' end;
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (new.org_id, v_actor, 'internal_staff', v_action, 'invoice', new.id,
      jsonb_build_object('status_anterior', old.status, 'status_novo', new.status,
        'forma_pagamento', new.payment_method));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger invoices_activity_log
  after insert or update on invoices
  for each row execute function public.log_invoice_change();

-- Nível mudou (automático via run_delinquency_check OU reset manual via
-- mark_invoice_paid) + exceção manual ligada/desligada — tudo centralizado
-- aqui pra não duplicar lógica de log em 3 funções diferentes.
create or replace function public.log_delinquency_state_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.level is distinct from new.level then
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (
      new.org_id,
      coalesce(new.updated_by, old.updated_by),
      case when new.updated_by is not null then 'internal_staff' else 'system' end,
      'mudou_nivel_escada_inadimplencia', 'delinquency_state', new.org_id,
      jsonb_build_object('nivel_anterior', old.level, 'nivel_novo', new.level)
    );
    if new.updated_by is not null then
      perform public.log_admin_org_access(
        new.updated_by, new.org_id,
        format('Nível de inadimplência alterado manualmente: %s → %s', old.level, new.level)
      );
    end if;
  end if;

  if old.exception_active is distinct from new.exception_active then
    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    values (
      new.org_id, new.exception_set_by, 'internal_staff',
      case when new.exception_active then 'registrou_excecao_inadimplencia' else 'removeu_excecao_inadimplencia' end,
      'delinquency_state', new.org_id, jsonb_build_object('motivo', new.exception_reason)
    );
    perform public.log_admin_org_access(
      new.exception_set_by, new.org_id,
      format('%s exceção manual na régua de inadimplência: %s',
        case when new.exception_active then 'Registrou' else 'Encerrou' end, new.exception_reason)
    );
  end if;

  return new;
end;
$$;

create trigger delinquency_state_activity_log
  after update on delinquency_state
  for each row execute function public.log_delinquency_state_change();

-- =========================================================================
-- 10. export_organization_data — exportação sempre disponível
-- =========================================================================
-- Seção 7 do Guia: "Cliente sempre pode exportar os dados dele, em qualquer
-- degrau da escada." security definer + get_current_org() (nunca um org_id
-- vindo de parâmetro do cliente) garante que SEMPRE funciona, inclusive em
-- 'bloqueado' — não checa nível de inadimplência em nenhum momento, de
-- propósito. Cobre os 4 módulos reais da v1 (seção 9 do Guia).
create or replace function public.export_organization_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := public.get_current_org();
  v_result jsonb;
begin
  if v_org_id is null then
    raise exception 'Nenhuma organização ativa selecionada';
  end if;

  select jsonb_build_object(
    'organizacao', (select to_jsonb(o) from organizations o where o.id = v_org_id),
    'exportado_em', now(),
    'nao_conformidades', coalesce((select jsonb_agg(to_jsonb(n)) from ncs n where n.org_id = v_org_id), '[]'::jsonb),
    'planos_de_acao', coalesce((select jsonb_agg(to_jsonb(p)) from action_plans p where p.org_id = v_org_id), '[]'::jsonb),
    'auditorias', coalesce((select jsonb_agg(to_jsonb(a)) from audits a where a.org_id = v_org_id), '[]'::jsonb),
    'indicadores', coalesce((select jsonb_agg(to_jsonb(i)) from indicators i where i.org_id = v_org_id), '[]'::jsonb)
  ) into v_result;

  insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
  values (v_org_id, auth.uid(), 'user', 'exportou_dados_organizacao', 'organization', v_org_id,
    jsonb_build_object('nivel_inadimplencia', (select level from delinquency_state where org_id = v_org_id)));

  return v_result;
end;
$$;

grant execute on function public.export_organization_data() to authenticated;
