-- Helpers de sessão/auth para o mecanismo de RLS via JWT custom claim.
--
-- Substituem o par set_current_org()/get_current_org() do desenho original
-- (variável de sessão) por:
--   - get_current_org(): lê o claim org_id já presente no JWT da requisição.
--   - custom_access_token_hook(): roda no Supabase Auth (não no PostgREST) a
--     cada emissão/refresh de token, e é quem escreve org_id no JWT.
--   - set_active_org(): substitui set_current_org(). Não seta variável de
--     sessão (não sobrevive entre requests no pool). Em vez disso, valida
--     que o usuário pertence à organização e grava em profiles.active_org_id.
--     O app precisa chamar supabase.auth.refreshSession() depois, para o
--     hook reemitir o JWT já com o novo org_id. Necessário para o "seletor
--     de empresa no topo" (seção 8 do Guia de Arquitetura).

create or replace function public.get_current_org()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'org_id', '')::uuid;
$$;

create or replace function public.set_active_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_organizations
    where user_id = auth.uid()
      and org_id = p_org_id
      and is_active
  ) then
    raise exception 'Usuário não pertence a esta organização ou o vínculo está inativo';
  end if;

  update profiles set active_org_id = p_org_id where id = auth.uid();
end;
$$;

grant execute on function public.set_active_org(uuid) to authenticated;

-- Auth Hook: injeta org_id no JWT a cada login/refresh.
-- Precisa ser registrado em supabase/config.toml (auth.hook.custom_access_token)
-- e aplicado com `supabase config push` — RLS não fica ativo até esse passo.
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
begin
  v_user_id := (event ->> 'user_id')::uuid;
  claims := event -> 'claims';

  select active_org_id into v_org_id
  from profiles
  where id = v_user_id;

  -- Sem organização ativa definida: se o usuário pertence a exatamente uma
  -- empresa, adota-a como padrão (caso comum de usuário recém-criado).
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

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;
grant select on public.user_organizations to supabase_auth_admin;

-- Popula profiles automaticamente quando alguém se cadastra em auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
