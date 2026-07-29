-- Tabelas de `action_plans` (ABA 5). Modelo normalizado, diferente do mock
-- do protótipo (src/lib/mock-data.ts: PlanoAcao), que tratava "plano" e
-- "ação corretiva" como a mesma linha 1:1 — a simplificação que esta aba
-- corrige (docs/GUIA_DE_ARQUITETURA.md seção 10/11).
--
-- Três tabelas:
--   action_plans — o "cabeçalho" (contingência + vínculo com a NC de
--     origem). Código PA_[SEQ]_[ANO] (seção 10 do Guia).
--   action_plan_corrective_actions — cada ação corretiva individual, com
--     5W2H completo (seção 10). Uma ação nasce com o plano; outras nascem
--     como consequência de uma reprovação de eficácia (seção 11) — por isso
--     parent_action_id/restart_reason/escalation_level existem aqui, não em
--     action_plans.
--   action_plan_verifications — cada tentativa de verificação de eficácia
--     de uma ação corretiva específica. limitada a 2 por ação (enforced via
--     trigger em 20260729150200_action_plans_triggers.sql, não dá pra
--     expressar "count <= 2" num CHECK simples).
--
-- org_id/unit_id em corrective_actions e verifications são denormalizados
-- (copiados da action_plans pai) para poder usar user_has_unit_access()
-- direto na RLS de cada tabela, igual ncs — mas o valor é sempre
-- sobrescrito por trigger a partir do pai, nunca confiado do client (ver
-- migração de triggers).

create table action_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  unit_id uuid references units(id),
  code text not null,
  nc_id uuid references ncs(id),
  origin_type text not null default 'nao_conformidade' check (origin_type in (
    'nao_conformidade','auditoria_interna','auditoria_externa','risco_oportunidade',
    'analise_critica','reclamacao_cliente','melhoria_continua','estrategia'
  )),
  problem_description text not null,
  -- Contingência (seção 10 do Guia): opcional, prazo governado em dias
  -- úteis. O cálculo do prazo (addDiasUteis) já existe no wizard em JS
  -- (src/lib/mock-data.ts) e continua lá — não é campo de segurança como o
  -- SLA de NC, então não precisa virar trigger de banco.
  contingency_description text,
  contingency_responsible_id uuid references profiles(id),
  contingency_deadline timestamptz,
  contingency_executed_at timestamptz,
  status text not null default 'planejado' check (status in (
    'planejado','em_execucao','em_avaliacao','concluido','atrasado','cancelado'
  )),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id),
  cancel_reason text,
  unique (org_id, code),
  check (status <> 'cancelado' or cancel_reason is not null),
  check (contingency_description is null or contingency_responsible_id is not null)
);

create index action_plans_org_id_idx on action_plans(org_id);
create index action_plans_org_status_idx on action_plans(org_id, status);
create index action_plans_nc_id_idx on action_plans(nc_id);

-- Contador de código por organização e ano — mesmo mecanismo de
-- nc_code_counters (UPSERT atômico, sem race condition sob concorrência).
create table action_plan_code_counters (
  org_id uuid not null references organizations(id) on delete cascade,
  year int not null,
  next_seq int not null default 1,
  primary key (org_id, year)
);

create table action_plan_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid references units(id),
  action_plan_id uuid not null references action_plans(id) on delete cascade,
  seq int not null,
  -- Linhagem: quando uma verificação reprova (seção 11), o caminho "ação
  -- fraca" e "causa errada" nascem como uma ação NOVA (parent_action_id
  -- aponta pra ação superada); "não executada" reabre a MESMA linha
  -- (parent_action_id fica null, é a mesma ação, só muda prazo/status).
  -- Nada é apagado — a ação superada continua na tabela com
  -- status='encerrada' e closure_reason preenchido.
  parent_action_id uuid references action_plan_corrective_actions(id),
  restart_reason text check (restart_reason in ('acao_fraca','causa_errada','nao_executada')),
  -- 0 = ação original (autoria humana direta, sem aprovação extra — seção
  -- 12 do Guia). >=1 = nasceu de uma reprovação; escalation_level determina
  -- quem precisa aprovar a próxima tentativa antes dela poder avançar
  -- (1 = Gestor da Qualidade, 2+ = Administrador do Cliente — "superior
  -- hierárquico do Gestor da Qualidade" mapeado pro papel mais alto
  -- disponível no modelo fixo de perfis da seção 6, já que não existe
  -- coluna de hierarquia/gestor direto em user_organizations).
  escalation_level int not null default 0,
  required_approval_role text check (required_approval_role in ('quality_manager','admin')),
  -- 5W2H em português (seção 10 do Guia — nunca em inglês na tela).
  what_description text not null,
  why_justification text not null,
  where_location text not null,
  who_responsible_id uuid not null references profiles(id),
  how_method text not null,
  how_much_cost numeric(10,2) not null default 0,
  when_start timestamptz not null default now(),
  when_end timestamptz not null,
  status text not null default 'planejada' check (status in (
    'aguardando_aprovacao','planejada','em_execucao','aguardando_verificacao',
    'aprovada','encerrada'
  )),
  -- eficaz = aprovada na verificação (fim feliz). acao_fraca/causa_errada =
  -- encerrada porque a reprovação abriu uma ação nova nesse caminho (seção
  -- 11 do Guia). reprovada_definitiva = "não executada" reprovou pela 2ª
  -- vez na mesma linha e estourou o limite de 2 tentativas — encerra em
  -- definitivo e abre-se uma ação nova.
  closure_reason text check (closure_reason in (
    'eficaz','acao_fraca','causa_errada','reprovada_definitiva'
  )),
  percent_complete int not null default 0 check (percent_complete between 0 and 100),
  executed_at timestamptz,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (action_plan_id, seq),
  check (status <> 'encerrada' or closure_reason is not null),
  check (escalation_level = 0 or required_approval_role is not null)
);

create index action_plan_corrective_actions_org_id_idx on action_plan_corrective_actions(org_id);
create index action_plan_corrective_actions_plan_id_idx on action_plan_corrective_actions(action_plan_id);
create index action_plan_corrective_actions_org_status_idx on action_plan_corrective_actions(org_id, status);
create index action_plan_corrective_actions_parent_idx on action_plan_corrective_actions(parent_action_id);

create table action_plan_verifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  corrective_action_id uuid not null references action_plan_corrective_actions(id) on delete cascade,
  -- Limite de 2 tentativas por ação corretiva individual (seção 11 do
  -- Guia). Calculado e travado em trigger (before insert), não dá pra
  -- expressar "no máximo 2 linhas para o mesmo corrective_action_id" só com
  -- CHECK — precisa contar as linhas existentes.
  attempt_number int not null,
  verified_by uuid not null references profiles(id) default auth.uid(),
  verified_at timestamptz not null default now(),
  result text not null check (result in ('eficaz','nao_eficaz')),
  -- Os "3 caminhos" da seção 11: obrigatório quando reprova.
  reason text check (reason in ('acao_fraca','causa_errada','nao_executada')),
  notes text,
  -- Caminho b) causa errada: reabre a análise de causa (5 Porquês vive só
  -- como estado local do wizard de NC hoje — não há tabela normalizada de
  -- 5 Porquês no banco ainda — então a "reabertura" aqui é registrar a nova
  -- causa raiz como texto, que vira why_justification da ação nova).
  new_root_cause text,
  -- Novo prazo obrigatório em qualquer reprovação (toda ação
  -- reaberta/nova precisa de uma data real de entrega).
  new_deadline timestamptz,
  escalation_level_required int,
  required_approval_role text check (required_approval_role in ('quality_manager','admin')),
  -- Preenchido por trigger quando a ação resultante (nova ou reaberta) é
  -- aprovada — ver enforce_action_plan_next_attempt_approval em
  -- 20260729150200_action_plans_triggers.sql. Guardado aqui também (além de
  -- action_plan_corrective_actions.approved_by) porque o item 2 do prompt
  -- da ABA 5 pede que a tabela de verificações registre "quem aprovou a
  -- próxima tentativa" — fonte da verdade continua sendo a ação, isto é
  -- só o espelho para consulta direta da trilha de uma verificação.
  next_attempt_approved_by uuid references profiles(id),
  next_attempt_approved_at timestamptz,
  resulting_action_id uuid references action_plan_corrective_actions(id),
  created_at timestamptz not null default now(),
  unique (corrective_action_id, attempt_number),
  check (result = 'eficaz' or reason is not null),
  check (reason <> 'causa_errada' or new_root_cause is not null),
  check (result = 'eficaz' or new_deadline is not null)
);

create index action_plan_verifications_org_id_idx on action_plan_verifications(org_id);
create index action_plan_verifications_corrective_action_idx
  on action_plan_verifications(corrective_action_id);
