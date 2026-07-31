-- Correção da migration 20260731140000_must_reset_password_enforcement.sql.
--
-- Diagnóstico (rodado depois da aplicação "sem erro" da migration original):
--   1) a trigger profiles_protect_must_reset_password não existe em pg_trigger;
--   2) a tentativa de recriá-la sozinha falhou com
--      "function public.protect_must_reset_password_column() does not exist"
--      — ou seja, a própria função nunca foi criada no banco.
--
-- Isso descarta a hipótese de "o lote inteiro rodou, só a trigger não
-- pegou": se a função (primeira instrução do arquivo) nunca existiu, o
-- início do script original simplesmente não foi executado de verdade,
-- apesar de nenhum erro ter sido reportado na hora. Não há como confirmar
-- a partir daqui SE outras partes daquele arquivo (force_password_reset,
-- clear_must_reset_password) também ficaram incompletas — um diagnóstico
-- anterior mostrou force_password_reset com o corpo novo, mas não custa
-- reaplicar tudo de forma idempotente em vez de confiar nessa leitura.
--
-- Esta migration reaplica o conteúdo INTEIRO de 20260731140000, statement
-- por statement, todos seguros de rodar de novo (create or replace function,
-- drop trigger if exists + create trigger, grants reemitidos são no-op se
-- já existirem).

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

drop trigger if exists profiles_protect_must_reset_password on profiles;

create trigger profiles_protect_must_reset_password
  before update on profiles
  for each row execute function public.protect_must_reset_password_column();

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
