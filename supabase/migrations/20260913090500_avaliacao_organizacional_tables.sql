-- Aditivo ao Bloco 4 (Pessoas) — Avaliação de Desempenho Organizacional
-- (pesquisa de clima, não avaliação individual). Fica ao lado da avaliação
-- de pessoas já existente (performance_evaluations), mas é modelo
-- deliberadamente diferente:
--   - "avaliado" é a organização, não um employee — por isso responde por
--     user_id (auth.uid(), via user_organizations), não por employee_id.
--     Nem todo usuário do sistema tem registro em `employees` (RH), mas
--     todo usuário tem vínculo em user_organizations — pesquisa de clima
--     deve alcançar todo mundo que loga no sistema, não só quem está
--     cadastrado em Cargos e Perfis.
--   - Resposta é IDENTIFICADA (decisão confirmada com o Matheus — não
--     existe padrão de pesquisa anônima em nenhum outro módulo do
--     sistema; anônima exigiria uma segunda tabela só de controle de quem
--     respondeu, sem conteúdo, para não travar duplicidade nem lembrete).
--   - Sem coluna de status: "aberta" é sempre calculado a partir de
--     janela_inicio/janela_fim contra a data corrente — evita um campo que
--     precisaria de rotina agendada pra ficar sincronizado (não existe
--     job agendado no sistema hoje).

create table org_climate_surveys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  janela_inicio date not null,
  janela_fim date not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  check (janela_fim >= janela_inicio)
);

create index org_climate_surveys_org_id_idx on org_climate_surveys(org_id);

-- As 5 perguntas fixas do formulário (infraestrutura / ambiente /
-- psicológico / carreira / liderança), escala 1-5, mais comentário livre.
create table org_climate_survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references org_climate_surveys(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  user_id uuid not null references profiles(id) default auth.uid(),
  nota_infraestrutura int not null check (nota_infraestrutura between 1 and 5),
  nota_ambiente int not null check (nota_ambiente between 1 and 5),
  nota_psicologico int not null check (nota_psicologico between 1 and 5),
  nota_carreira int not null check (nota_carreira between 1 and 5),
  nota_lideranca int not null check (nota_lideranca between 1 and 5),
  comentarios text,
  submitted_at timestamptz not null default now(),
  -- Identificada, mas uma resposta só por pessoa por rodada.
  unique (survey_id, user_id)
);

create index org_climate_survey_responses_survey_idx on org_climate_survey_responses(survey_id);
