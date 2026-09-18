-- Bloco 6, itens 10/11/12 — logo do cliente (bug: nunca funcionou, era
-- decorativo) + cores customizáveis do painel lateral e da tela central,
-- além das 3 já existentes na tela (primária/destaque/texto) que também
-- nunca foram lidas nem persistidas em lugar nenhum.
--
-- `organizations.logo_url` e `organizations.brand_color` já existem desde a
-- fundação (20260729120000) mas nunca foram lidos pelo frontend — o
-- formulário de Identidade era 100% mock (defaultValue fixo). Aqui:
-- (a) cria o bucket de Storage que a seção 21.2 do Guia já apontava como
--     faltante ("logos-empresas" nunca foi criado por nenhuma aba anterior);
-- (b) adiciona as 4 colunas de cor que faltam (brand_color vira "cor
--     primária" e passa a ser realmente usado).
--
-- Governança: edição de identidade visual é ação de "Dono/Admin da empresa
-- cliente" (seção 4 do Guia — quem enxerga/administra a própria empresa),
-- não uma questão de governança da qualidade (por isso NÃO reaproveita
-- is_hr_authorized, que é admin+quality_manager) — só admin.
--
-- Nota: a policy organizations_update_own (20260729120100) já permite
-- update por QUALQUER membro ativo da org, sem checar role — isso é anterior
-- a esta migration e não é alterado aqui (fora de escopo, mudar uma RLS já
-- em uso por outros fluxos sem auditar tudo que depende dela é arriscado
-- demais para esta entrega). A trava de "só admin edita identidade" é feita
-- na UI (mesmo padrão de "cadeado é só UX" já usado no ModuleGate/sidebar
-- para módulo não contratado) — registrado aqui como possível
-- endurecimento futuro, não implementado agora.

alter table organizations
  add column if not exists accent_color text,
  add column if not exists text_color text,
  add column if not exists sidebar_color text,
  add column if not exists content_bg_color text;

insert into storage.buckets (id, name, public)
values ('logos-empresas', 'logos-empresas', true)
on conflict (id) do nothing;

-- Leitura pública: o logo precisa renderizar em qualquer tela sem exigir
-- URL assinada (aparece na sidebar de toda sessão autenticada, e
-- potencialmente em documento exportável branded, seção 21.8 do Guia).
create policy "logos-empresas leitura publica"
  on storage.objects for select
  using (bucket_id = 'logos-empresas');

-- Upload/troca só por admin da PRÓPRIA organização — path
-- {org_id}/logo.<ext>, primeiro segmento é o org_id (padrão
-- {org_id}/{modulo}/... da seção 21.2, aqui sem sub-módulo porque é
-- 1 arquivo por organização, não por entidade).
create policy "logos-empresas upload admin da propria org"
  on storage.objects for insert
  with check (
    bucket_id = 'logos-empresas'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
    and exists (
      select 1 from user_organizations uo
      where uo.user_id = auth.uid()
        and uo.org_id = (auth.jwt() ->> 'org_id')::uuid
        and uo.is_active
        and uo.role = 'admin'
    )
  );

create policy "logos-empresas update admin da propria org"
  on storage.objects for update
  using (
    bucket_id = 'logos-empresas'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'org_id')
    and exists (
      select 1 from user_organizations uo
      where uo.user_id = auth.uid()
        and uo.org_id = (auth.jwt() ->> 'org_id')::uuid
        and uo.is_active
        and uo.role = 'admin'
    )
  );
