-- "Acessar como cliente" (item 6 da aba Usuários e Acessos). Mecanismo
-- escolhido (revisado com o usuário antes de implementar): sessão REAL do
-- Supabase Auth para o usuário-alvo, gerada via magic-link administrativo
-- (auth.admin.generateLink, chamado pela Edge Function com service_role —
-- fora desta migração). Esta tabela é o que faz o painel cliente saber que
-- está numa sessão de impersonação (pra desenhar a faixa fixa) e o que
-- garante o TTL curto e o encerramento — sem ela a sessão gerada seria
-- indistinguível de um login normal do próprio cliente.
--
-- internal_access_log continua sendo o registro permanente/imutável (staff,
-- org, motivo, entrada, saída). impersonation_sessions é o estado
-- OPERACIONAL da sessão ativa (referencia o log, mas existe separado porque
-- precisa ser lido pelo usuário impersonado via RLS própria, o que não faz
-- sentido abrir para internal_access_log inteiro).

create table impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references internal_staff(id),
  -- Denormalizado de propósito: o usuário impersonado (cliente) precisa ler
  -- esta linha pra desenhar a faixa fixa "Você está visualizando como
  -- [Nome do Staff]", mas a RLS de internal_staff restringe select ao
  -- próprio staff/super_admin (seção 4 do Guia) — um cliente nunca pode
  -- enxergar a tabela internal_staff. Copiar o nome aqui na abertura da
  -- sessão evita abrir uma exceção de RLS só pra isso.
  staff_full_name text not null,
  target_user_id uuid not null references profiles(id),
  org_id uuid not null references organizations(id),
  access_log_id uuid not null references internal_access_log(id),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz
);

create index impersonation_sessions_target_user_idx on impersonation_sessions(target_user_id);
create index impersonation_sessions_staff_idx on impersonation_sessions(staff_id);

alter table impersonation_sessions enable row level security;

-- Staff vê as próprias sessões (histórico/depuração no admin).
create policy impersonation_sessions_select_staff
  on impersonation_sessions for select
  using (public.is_internal_staff());

-- O usuário impersonado precisa ler a PRÓPRIA sessão ativa para o painel
-- cliente desenhar a faixa fixa e saber quando ela expira/encerra.
create policy impersonation_sessions_select_target
  on impersonation_sessions for select
  using (target_user_id = auth.uid());

-- Só as funções abaixo (security definer) escrevem aqui.
create policy impersonation_sessions_no_direct_insert
  on impersonation_sessions for insert
  with check (false);

create policy impersonation_sessions_no_direct_update
  on impersonation_sessions for update
  using (false);

create policy impersonation_sessions_no_delete
  on impersonation_sessions for delete
  using (false);

grant select on impersonation_sessions to authenticated;
grant all on impersonation_sessions to service_role;

-- =========================================================================
-- start_impersonation_session — chamada pela Edge Function usando o JWT do
-- PRÓPRIO staff (não service_role), então auth.uid() = staff autenticado.
-- Registra o motivo obrigatório em internal_access_log e abre a sessão
-- operacional com TTL. A Edge Function usa o retorno (target_user_id) para,
-- em seguida, gerar o magic-link com o client service_role — o vínculo
-- entre "motivo aprovado" e "link gerado" fica todo neste passo, então não
-- tem como gerar sessão sem passar por aqui.
-- =========================================================================
create or replace function public.start_impersonation_session(
  p_target_user_id uuid,
  p_org_id uuid,
  p_reason text,
  p_ttl_minutes integer default 30
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
  if p_ttl_minutes is null or p_ttl_minutes <= 0 or p_ttl_minutes > 120 then
    raise exception 'Duração da sessão de impersonação inválida (máx. 120 minutos)';
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
-- end_impersonation_session — chamada pelo próprio usuário impersonado (ao
-- clicar "Sair do modo cliente" no painel cliente) OU pelo staff que abriu
-- a sessão. Fecha impersonation_sessions.ended_at E
-- internal_access_log.session_ended_at juntos (mesma transação), que é o
-- registro permanente exigido pelo item 6 do prompt.
-- =========================================================================
create or replace function public.end_impersonation_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session impersonation_sessions%rowtype;
begin
  select * into v_session from impersonation_sessions where id = p_session_id;
  if not found then
    raise exception 'Sessão de impersonação não encontrada';
  end if;
  if v_session.ended_at is not null then
    return;
  end if;
  if auth.uid() is distinct from v_session.target_user_id
     and auth.uid() is distinct from v_session.staff_id then
    raise exception 'Sem permissão para encerrar esta sessão';
  end if;

  update impersonation_sessions set ended_at = now() where id = p_session_id;
  update internal_access_log set session_ended_at = now() where id = v_session.access_log_id;
end;
$$;

grant execute on function public.end_impersonation_session(uuid) to authenticated;
