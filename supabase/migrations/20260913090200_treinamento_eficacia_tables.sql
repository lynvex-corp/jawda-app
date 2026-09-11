-- Aditivo ao Bloco 4 (Pessoas) — Avaliação de Eficácia do Treinamento.
--
-- ACHADO ao investigar: training_participants.eficacia (eficaz/não eficaz)
-- já existia, mas era um dropdown solto na tela de participantes — sem
-- prazo, sem exigir carga horária mínima, sem método, sem ligação com o
-- dossiê. Era claramente um placeholder. Esta migração não remove a coluna
-- antiga (pode ter dado histórico — "nada apaga", seção 20 do Guia), mas a
-- funcionalidade real passa a viver nestas duas tabelas novas, cada uma
-- respondendo a um dos dois formulários pedidos:
--   a) training_session_feedback — o PARTICIPANTE avalia a própria
--      satisfação (1 a 5 + comentário).
--   b) training_effectiveness_evaluations — o GESTOR DA QUALIDADE avalia
--      se o treinamento realmente formou (método + resultado), só para
--      turmas de carga horária > 4h, só depois do prazo configurável.
--
-- ACHADO 2: não existe, em lugar nenhum da UI hoje, um jeito de marcar uma
-- turma como "realizada" (só "Programar turma" existe — status fica
-- 'planejada' pra sempre). Sem isso, os gates de data que este pedido
-- descreve (prazo contado a partir da data de realização) nunca
-- disparariam. Não é escopo novo, é pré-requisito para o que foi pedido —
-- a mutation de UI entra junto com o resto deste aditivo, sem migração
-- própria (a RLS de UPDATE em training_sessions já cobre).
--
-- ACHADO 3: o prazo configurável (15/30/60 dias) NÃO fica em `organizations`
-- de propósito. `organizations_update_own` (20260729120100) libera UPDATE
-- pra qualquer membro ativo da organização, sem checagem de papel nenhuma —
-- é uma falha de segurança pré-existente (mesma classe da que o Bloco 5
-- corrigiu em NC/Plano/Auditoria/Indicadores/Riscos/Estratégia), fora do
-- escopo deste aditivo porque afetaria colunas não relacionadas
-- (legal_name, brand_color, cnpj…). Uma tabela de configuração própria,
-- pequena e com RLS restrita de verdade, evita herdar esse buraco.

create table hr_learning_settings (
  org_id uuid primary key references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  avaliacao_eficacia_prazo_dias int not null default 30
    check (avaliacao_eficacia_prazo_dias in (15, 30, 60))
);

create table training_session_feedback (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references training_sessions(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  nivel_satisfacao int not null check (nivel_satisfacao between 1 and 5),
  comentarios text,
  respondido_em timestamptz not null default now(),
  unique (training_session_id, employee_id)
);

create index training_session_feedback_session_idx on training_session_feedback(training_session_id);
create index training_session_feedback_employee_idx on training_session_feedback(employee_id);

-- Uma avaliação de eficácia por turma (não por participante — "o gestor
-- escolhe qual treinamento [realizado, ou seja, qual turma] quer avaliar").
-- O resultado aparece no dossiê de cada participante daquela turma via
-- join em training_participants, sem duplicar linha por empregado.
create table training_effectiveness_evaluations (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references training_sessions(id) on delete cascade unique,
  metodo text not null
    check (metodo in ('aplicacao_teste', 'observacao_atividade', 'entrevista_colaborador')),
  resultado text not null,
  avaliado_em timestamptz not null default now(),
  avaliado_por uuid not null references profiles(id) default auth.uid()
);

create index training_effectiveness_evaluations_session_idx
  on training_effectiveness_evaluations(training_session_id);
