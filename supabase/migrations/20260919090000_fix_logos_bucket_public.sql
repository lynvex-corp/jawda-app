-- Correção do Bug 1 (Entrega 6C) — upload de logo gravava certinho, mas a
-- imagem nunca abria (ícone de "imagem quebrada").
--
-- CAUSA RAIZ confirmada testando direto contra a API de Storage: o bucket
-- `logos-empresas` JÁ EXISTIA desde 2026-07-29 (criado fora de qualquer
-- migration — provavelmente um passo manual/script de bootstrap anterior a
-- este bloco de trabalho), com `public = false`. A migration
-- 20260918090200_organization_theme.sql fazia
--   insert into storage.buckets (id, name, public) values (..., true)
--   on conflict (id) do nothing
-- e como a linha já existia, o "on conflict do nothing" simplesmente
-- IGNOROU o `public = true` pretendido — o bucket continuou privado.
--
-- `GET /storage/v1/object/public/<bucket>/<path>` retorna 400 (não 403)
-- quando o bucket não é público — é um gate de bucket, não de RLS —, e foi
-- exatamente esse 400 que a tag <img> recebia, virando ícone quebrado.
-- Confirmado batendo direto na API com o arquivo real que já tinha sido
-- enviado (upload funcionou; só a leitura pública é que falhava).

update storage.buckets set public = true where id = 'logos-empresas';
