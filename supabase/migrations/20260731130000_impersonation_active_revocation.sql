-- Fecha duas lacunas de segurança apontadas em revisão antes de dar a aba de
-- Usuários e Acessos por encerrada:
--
-- 1) impersonation_sessions.expires_at era só um registro — nada derrubava
--    de fato a sessão real do Supabase Auth quando o TTL passava. Se o
--    staff fechasse a aba sem clicar em "sair", a sessão continuava válida
--    indefinidamente (sessão não expira sozinha por padrão, seção 8 do
--    Guia), sem faixa e sem linha ativa em impersonation_sessions — a
--    trilha parava de refletir a realidade.
--
-- 2) Não havia como provar depois, de forma confiável, que uma linha de
--    activity_log foi escrita pelo staff em nome do cliente (em vez do
--    cliente de verdade) — só um cruzamento por horário, frágil se a
--    sessão sobrevivesse além do TTL (exatamente o problema do item 1) ou
--    se o cliente estivesse logado ao mesmo tempo em outro lugar.
--
-- Mecanismo: TTL derrubado a 15-20min (staff que precisar de mais tempo
-- abre outra sessão — esse atrito é intencional, preferível a uma janela
-- longa de exposição residual). Duas camadas independentes de enforcement:
--
--   a) custom_access_token_hook passa a: (i) injetar o claim
--      impersonating_staff_id no JWT enquanto a sessão de impersonação
--      segue válida — é isso que activity_log passa a gravar (fix 2); e
--      (ii) RECUSAR a emissão/refresh do token (raise exception) se
--      encontrar uma sessão de impersonação aberta cujo TTL já passou —
--      isso impede refresh silencioso indefinido. O hook nunca fecha a
--      linha ele mesmo (uma exception dentro da própria função desfaria
--      o UPDATE na mesma transação) — quem fecha é a varredura abaixo.
--
--   b) close_expired_impersonation_sessions(), agendada via pg_cron a cada
--      1 minuto, é quem de fato revoga a sessão real no nível do GoTrue:
--      marca auth.refresh_tokens.revoked = true e zera auth.sessions.not_after
--      (impede qualquer refresh futuro) e remove a linha de auth.sessions
--      para a sessão específica capturada em impersonation_sessions.supabase_session_id
--      — nunca a sessão inteira do usuário-alvo, só a que nasceu do
--      magic-link de impersonação. Fecha impersonation_sessions.ended_at e
--      internal_access_log.session_ended_at junto.
--
-- Limite conhecido, inerente a JWT stateless: o ACCESS TOKEN já emitido
-- (não o refresh token) continua criptograficamente válido até o próprio
-- exp, independente de qualquer revogação feita aqui — revogar o refresh
-- token impede pegar um token NOVO, mas não invalida instantaneamente um
-- token já em mãos. É exatamente por isso que o TTL foi encurtado para
-- 15-20min: a janela residual fica pequena e previsível.

-- =========================================================================
-- 1. supabase_session_id — vincula a linha de impersonation_sessions à
--    sessão REAL do GoTrue (auth.sessions.id), para poder revogar
--    exatamente essa sessão, nunca todas as sessões do usuário-alvo.
-- =========================================================================
alter table impersonation_sessions add column supabase_session_id uuid;

-- Chamada pelo painel cliente (rota /impersonar) logo depois do verifyOtp,
-- com o session_id decodificado do próprio JWT recebido. RLS de
-- impersonation_sessions já restringe select ao target_user_id — aqui a
-- checagem é explícita (defesa em profundidade, mesmo padrão do resto da
-- aba) em vez de depender só da política.
create or replace function public.attach_impersonation_session_token(
  p_impersonation_session_id uuid,
  p_supabase_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update impersonation_sessions
    set supabase_session_id = p_supabase_session_id
    where id = p_impersonation_session_id
      and target_user_id = auth.uid()
      and ended_at is null;

  if not found then
    raise exception 'Sessão de impersonação não encontrada ou não pertence a este usuário';
  end if;
end;
$$;

grant execute on function public.attach_impersonation_session_token(uuid, uuid) to authenticated;

-- =========================================================================
-- 2. close_expired_impersonation_sessions — a varredura que de fato mata a
--    sessão real. Agendada via pg_cron logo abaixo. Idempotente: rodar de
--    novo sobre uma linha já fechada não faz nada (o where já exclui).
-- =========================================================================
create or replace function public.close_expired_impersonation_sessions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id, access_log_id, supabase_session_id
    from impersonation_sessions
    where ended_at is null and expires_at < now()
  loop
    if r.supabase_session_id is not null then
      update auth.refresh_tokens set revoked = true
        where session_id = r.supabase_session_id;

      update auth.sessions set not_after = now()
        where id = r.supabase_session_id;

      delete from auth.sessions where id = r.supabase_session_id;
    end if;

    update impersonation_sessions set ended_at = now() where id = r.id;

    update internal_access_log
      set session_ended_at = now()
      where id = r.access_log_id and session_ended_at is null;

    insert into activity_log (org_id, actor_id, actor_type, action, entity_type, entity_id, detail)
    select org_id, null, 'system', 'encerrou_sessao_impersonation_por_ttl', 'impersonation_sessions', r.id, '{}'::jsonb
    from impersonation_sessions where id = r.id;
  end loop;
end;
$$;

grant execute on function public.close_expired_impersonation_sessions() to service_role;

select cron.schedule(
  'close_expired_impersonation_sessions_sweep',
  '* * * * *',
  $$select public.close_expired_impersonation_sessions();$$
);

-- =========================================================================
-- 3. custom_access_token_hook — injeta impersonating_staff_id enquanto a
--    sessão segue válida, e recusa emitir/renovar token se o TTL já
--    passou (a linha é fechada pela varredura acima, não aqui dentro —
--    um raise exception desfaria qualquer UPDATE feito na mesma
--    transação, então este hook só LÊ impersonation_sessions).
-- =========================================================================
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  v_user_id uuid;
  v_org_id uuid;
  v_org_count int;
  v_imp_staff_id uuid;
  v_imp_expires_at timestamptz;
begin
  v_user_id := (event ->> 'user_id')::uuid;
  claims := event -> 'claims';

  select active_org_id into v_org_id
  from profiles
  where id = v_user_id;

  if v_org_id is null then
    select count(*) into v_org_count
    from user_organizations
    where user_id = v_user_id and is_active;

    if v_org_count = 1 then
      select org_id into v_org_id
      from user_organizations
      where user_id = v_user_id and is_active;
    end if;
  end if;

  if v_org_id is not null then
    claims := jsonb_set(claims, '{org_id}', to_jsonb(v_org_id::text));
  end if;

  select staff_id, expires_at into v_imp_staff_id, v_imp_expires_at
  from impersonation_sessions
  where target_user_id = v_user_id and ended_at is null
  order by started_at desc
  limit 1;

  if v_imp_staff_id is not null then
    if now() > v_imp_expires_at then
      raise exception 'Sessão de acesso como cliente expirada — peça para o staff abrir uma nova sessão.';
    end if;
    claims := jsonb_set(claims, '{impersonating_staff_id}', to_jsonb(v_imp_staff_id::text));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- =========================================================================
-- 4. TTL padrão encurtado para 15min, teto de 20min (era 30min padrão,
--    120min de teto). Atrito de reabrir sessão é intencional.
-- =========================================================================
create or replace function public.start_impersonation_session(
  p_target_user_id uuid,
  p_org_id uuid,
  p_reason text,
  p_ttl_minutes integer default 15
)
returns impersonation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_staff_name text;
  v_log_id uuid;
  v_session impersonation_sessions%rowtype;
begin
  if not public.is_internal_staff() then
    raise exception 'Apenas a equipe interna Lynvex pode acessar como cliente';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Motivo é obrigatório para acessar como cliente';
  end if;
  if not exists (
    select 1 from user_organizations
    where user_id = p_target_user_id and org_id = p_org_id and is_active
  ) then
    raise exception 'Usuário-alvo não é um membro ativo desta organização';
  end if;
  if p_ttl_minutes is null or p_ttl_minutes <= 0 or p_ttl_minutes > 20 then
    raise exception 'Duração da sessão de impersonação inválida (máx. 20 minutos)';
  end if;

  select full_name into v_staff_name from internal_staff where id = v_staff_id;

  insert into internal_access_log (staff_id, org_id, reason)
  values (v_staff_id, p_org_id, p_reason)
  returning id into v_log_id;

  insert into impersonation_sessions (staff_id, staff_full_name, target_user_id, org_id, access_log_id, expires_at)
  values (v_staff_id, v_staff_name, p_target_user_id, p_org_id, v_log_id, now() + make_interval(mins => p_ttl_minutes))
  returning * into v_session;

  return v_session;
end;
$$;

grant execute on function public.start_impersonation_session(uuid, uuid, text, integer) to authenticated;

-- =========================================================================
-- 5. activity_log.impersonated_by_staff_id — atribuição exata, não por
--    cruzamento de horário. Em vez de alterar cada trigger que já escreve
--    em activity_log (ncs, action_plans, audits, indicators, contratos,
--    financeiro...), um único trigger BEFORE INSERT na própria tabela lê o
--    claim impersonating_staff_id do JWT (presente só quando o item 3 acima
--    injetou — ou seja, só durante uma sessão de impersonação ainda válida)
--    e carimba a linha. Cobre automaticamente qualquer trigger existente ou
--    futuro que insira em activity_log, sem tocar em nenhum deles.
-- =========================================================================
alter table activity_log add column impersonated_by_staff_id uuid references internal_staff(id);

create or replace function public.stamp_impersonation_on_activity_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.impersonated_by_staff_id is null then
    new.impersonated_by_staff_id := nullif(auth.jwt() ->> 'impersonating_staff_id', '')::uuid;
  end if;
  return new;
end;
$$;

create trigger activity_log_stamp_impersonation
  before insert on activity_log
  for each row execute function public.stamp_impersonation_on_activity_log();
