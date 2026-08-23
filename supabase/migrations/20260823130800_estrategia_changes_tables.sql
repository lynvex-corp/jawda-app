-- Módulo Estratégia (Aba 16, sub-aba 5/5) — Mudanças e Melhoria (ISO 9001
-- 6.3). Um só tipo de registro para os dois conceitos (`tipo` distingue),
-- conforme o desenho do prompt desta aba.
--
-- Fluxo: rascunho (autor descreve a mudança/melhoria) → aguardando_avaliacao
-- (submetida) → aguardando_aprovacao (avaliador respondeu o checklist de 4
-- perguntas 6.3.a-d — "Marcar como Avaliada" só habilita com as 4
-- respondidas) → aprovada/rejeitada (decisão final).
--
-- Cada campo *_detalhe só é obrigatório quando o *_bool correspondente é
-- true (CHECK abaixo) — regra explícita do prompt desta aba.

create table changes_improvements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  tipo text not null check (tipo in ('mudanca', 'melhoria')),
  descricao text not null,
  proposito text not null,
  consequencias_bool boolean,
  consequencias_detalhe text,
  integridade_bool boolean,
  integridade_detalhe text,
  recurso_bool boolean,
  recurso_detalhe text,
  responsabilidades_bool boolean,
  responsabilidades_detalhe text,
  data_inicio date,
  status text not null default 'rascunho' check (status in (
    'rascunho', 'aguardando_avaliacao', 'aguardando_aprovacao', 'aprovada', 'rejeitada'
  )),
  avaliado_por uuid references profiles(id),
  aprovado_por uuid references profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  check (consequencias_bool is distinct from true or consequencias_detalhe is not null),
  check (integridade_bool is distinct from true or integridade_detalhe is not null),
  check (recurso_bool is distinct from true or recurso_detalhe is not null),
  check (responsabilidades_bool is distinct from true or responsabilidades_detalhe is not null),
  check (status <> 'aprovada' or aprovado_por is not null),
  check (status <> 'rejeitada' or aprovado_por is not null)
);

create index changes_improvements_org_id_idx on changes_improvements(org_id);
create index changes_improvements_org_status_idx on changes_improvements(org_id, status);
