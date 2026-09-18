-- Bloco 6, item 5 — indicador "Cultura da Qualidade" (novo submódulo de
-- Estratégia): autodiagnóstico anual, múltiplos respondentes, resultado
-- agregado por dimensão e geral.
--
-- DESVIO DO QUE FOI APROVADO NO PLANO — registrado aqui pra ficar claro no
-- histórico de migrations (não implementado silenciosamente):
-- o plano original dizia "reaproveitar org_climate_surveys/
-- org_climate_survey_responses com coluna kind". A JANELA (org_climate_
-- surveys) É genérica o suficiente pra reaproveitar como está — só ganha a
-- coluna kind abaixo. Mas org_climate_survey_responses tem 5 colunas
-- NOMEADAS e fixas (nota_infraestrutura, nota_ambiente, ...), específicas
-- da pesquisa de clima — não comportam as ~24 afirmações de Cultura da
-- Qualidade sem virar uma tabela com 24 colunas majoritariamente nulas
-- dependendo do kind. Por isso as RESPOSTAS de Cultura da Qualidade vão
-- para uma tabela nova (quality_culture_survey_answers), com uma coluna
-- jsonb (mesmo padrão de "agregar no cliente" já usado em
-- src/lib/queries/reconhecimento.ts) em vez de 24 colunas fixas — as 24
-- afirmações e suas dimensões (ISO 9001) ficam versionadas em código
-- (src/lib/queries/quality-culture.ts), não no banco, pra não exigir
-- migração toda vez que o texto de uma afirmação for ajustado.
--
-- Governança: mesma regra já usada para a pesquisa de clima (is_hr_
-- authorized = admin ou quality_manager programam a janela e veem o
-- resultado agregado; qualquer membro ativo responde por si mesmo).

alter table org_climate_surveys
  add column if not exists kind text not null default 'clima'
    check (kind in ('clima', 'cultura_qualidade'));

create table quality_culture_survey_answers (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references org_climate_surveys(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  user_id uuid not null references profiles(id) default auth.uid(),
  -- { "<codigo_da_afirmacao>": <nota 1-5>, ... } — chaves e dimensões
  -- versionadas em src/lib/queries/quality-culture.ts.
  respostas jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (survey_id, user_id)
);

create index quality_culture_survey_answers_survey_idx
  on quality_culture_survey_answers(survey_id);

alter table quality_culture_survey_answers enable row level security;

-- Mesma régua de org_climate_survey_responses: a própria resposta é
-- visível a quem respondeu e a quem tem governança (agregado).
create policy quality_culture_survey_answers_select_own_or_hr
  on quality_culture_survey_answers for select
  using (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and (user_id = auth.uid() or public.is_hr_authorized(org_id))
  );

-- Gate de janela real (não só UI): só dá pra responder dentro do período
-- programado daquela survey, e só a própria pessoa responde por si mesma.
create policy quality_culture_survey_answers_insert_self
  on quality_culture_survey_answers for insert
  with check (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    and user_id = auth.uid()
    and exists (
      select 1 from org_climate_surveys s
      where s.id = survey_id
        and s.org_id = quality_culture_survey_answers.org_id
        and s.kind = 'cultura_qualidade'
        and current_date between s.janela_inicio and s.janela_fim
    )
  );

create policy quality_culture_survey_answers_no_update
  on quality_culture_survey_answers for update
  using (false);

create policy quality_culture_survey_answers_no_delete
  on quality_culture_survey_answers for delete
  using (false);

-- GRANT explícito (seção 21.1 do Guia). DELETE nunca é concedido — nada
-- apaga (seção 2 do Guia; diferente de user_notes, que é rascunho pessoal,
-- isto é resultado de autodiagnóstico institucional).
grant select, insert on quality_culture_survey_answers to authenticated;
grant all on quality_culture_survey_answers to service_role;
