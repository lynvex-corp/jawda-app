-- Seed de desenvolvimento local — dados fictícios para exercitar o fluxo de
-- autenticação completo (cadastro → 2FA → login → dashboard).
--
-- Roda automaticamente em `supabase db reset` (ver [db.seed] em config.toml)
-- ou manualmente com `supabase db seed`. NUNCA aponta para produção: só
-- existe no banco local do Supabase CLI. E-mail, senha e CNPJ abaixo são
-- fictícios — não são dados reais de cliente.
--
-- Login de teste: admin@novaaurora.com.br / Teste@12345
-- (usuário nasce sem 2FA configurado — o primeiro login força o setup do TOTP)

do $$
declare
  v_org_id uuid;
  v_user_id uuid := gen_random_uuid();
begin
  insert into organizations (id, legal_name, trade_name, cnpj, status)
  values (gen_random_uuid(), 'Indústria Nova Aurora Ltda', 'Nova Aurora', '12.345.678/0001-90', 'active')
  returning id into v_org_id;

  insert into units (org_id, name, status)
  values (v_org_id, 'Matriz', 'active');

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'admin@novaaurora.com.br',
    crypt('Teste@12345', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Nova Aurora"}'::jsonb,
    '', '', '', '', '', '', '', '',
    now(), now()
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'admin@novaaurora.com.br'),
    'email',
    now(),
    now(),
    now()
  );

  -- public.profiles já foi populado pelo trigger on_auth_user_created (dispara
  -- no insert acima); aqui só fixamos a org ativa para o primeiro login.
  update profiles set active_org_id = v_org_id where id = v_user_id;

  insert into user_organizations (user_id, org_id, role, units_scope, is_active, activated_at)
  values (v_user_id, v_org_id, 'admin', 'all', true, now());
end $$;
