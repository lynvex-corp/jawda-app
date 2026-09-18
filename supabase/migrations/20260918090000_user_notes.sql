-- Bloco 6, item 3 — anotações pessoais livres (post-it) na Gestão à Vista.
-- Rascunho pessoal descartável, NÃO um registro de gestão: decisão
-- confirmada com o Matheus é delete físico permitido, sem motivo
-- obrigatório nem histórico (foge da regra "nada é apagado" da seção 2 do
-- Guia de propósito, porque essa regra existe para registro de gestão —
-- NC, plano, auditoria, indicador — não para uma nota solta de uso
-- individual).

create table user_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  user_id uuid not null references profiles(id) default auth.uid(),
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Uma nota só por pessoa/organização — permite upsert por (org_id,
  -- user_id) em vez do client ter que rastrear "já existe linha?" antes de
  -- decidir entre insert/update (evita duplicata em corrida de duas abas).
  unique (org_id, user_id)
);

alter table user_notes enable row level security;

-- Só o próprio dono lê/escreve/apaga a própria nota — nem Administrador
-- nem Gestor da Qualidade enxergam nota de outro usuário (é rascunho
-- pessoal, não dado de gestão da organização).
create policy user_notes_own
  on user_notes for all
  using (user_id = auth.uid() and org_id = (auth.jwt() ->> 'org_id')::uuid)
  with check (user_id = auth.uid() and org_id = (auth.jwt() ->> 'org_id')::uuid);

-- GRANT explícito (seção 21.1 do Guia — table auto-exposure desligado no
-- PostgREST, RLS sozinha não basta). DELETE é concedido aqui, por exceção:
-- diferente de toda tabela de negócio do sistema, nota pessoal é
-- descartável de propósito (ver comentário no topo do arquivo).
grant select, insert, update, delete on user_notes to authenticated;
grant all on user_notes to service_role;
