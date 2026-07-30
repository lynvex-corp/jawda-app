-- Tabelas do módulo de Auditorias (ABA 6). Duas cascas com peso muito
-- diferente sobre o mesmo cabeçalho `audits` (seção 10 do Guia de
-- Arquitetura + docs/GUIA_DE_ARQUITETURA.md seção 10 e skill
-- jawda-quality-rules):
--
--   Externa = casca leve. A execução vive no sistema da certificadora; aqui
--   só guardamos datas, auditores, escopo, upload do relatório e o campo
--   "Evento" (Certificação/Monitoração/Recertificação).
--
--   Interna = peso completo. Plano por dia/processo (audit_plan_items),
--   checklist por requisito com classificação C/OPM/NCS/NCM/NCC
--   (audit_checklist_items), apontamentos que podem gerar NC/PA reais
--   (audit_findings) e relatório final estruturado (audit_reports). O campo
--   "Evento" não existe para interna — enforced por CHECK abaixo, não só
--   escondido na UI.
--
-- Desvios documentados em relação ao protótipo (src/lib/mock-data.ts):
--
-- norm (singular, não normas[]): a v1 libera só ISO 9001 (CHECK trava o
-- valor). O protótipo tinha `normas: string[]` livre — os chips de outras
-- normas na tela de criação ficam desabilitados com aviso "Disponível
-- apenas na opção Personalizado" (esse fluxo Personalizado não existe
-- ainda, é trabalho de aba futura). Não modelamos array porque não há hoje
-- nenhum caso de múltiplas normas simultâneas na v1.
--
-- org_id só existe em `audits`. As 5 tabelas filhas (audit_auditors,
-- audit_plan_items, audit_checklist_items, audit_findings, audit_reports)
-- NÃO denormalizam org_id/unit_id — diferente de
-- action_plan_corrective_actions/verifications (ABA 5), que denormalizavam
-- org_id para checar RLS direto. Aqui todo filho pendura só em `audit_id`,
-- e a política de RLS (próxima migração) filtra org/unidade via join
-- implícito contra `audits` (exists (...) where a.id = audit_id and
-- a.org_id = jwt_org and user_has_unit_access(a.unit_id)). É seguro porque
-- todo filho tem exatamente um pai (audit_id not null, on delete cascade) e
-- nenhuma tabela aqui é referenciada por mais de uma organização — não há
-- como um filho "pertencer" a uma org diferente do pai.

create table audits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  unit_id uuid references units(id),
  code text not null,
  type text not null check (type in ('interna', 'externa')),
  -- Só ISO 9001 na v1 (seção 9/10 do Guia). Trava de banco, não só de UI.
  norm text not null default 'iso_9001' check (norm = 'iso_9001'),
  scope text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'programada'
    check (status in ('programada', 'em_andamento', 'concluida', 'cancelada')),
  -- Auditor líder interno (referência a profiles). Para auditoria externa,
  -- quem de fato audita fica listado em audit_auditors (is_internal=false);
  -- lead_auditor_id aqui é opcional mesmo para externa (pode não haver um
  -- responsável interno designado além do que a certificadora define).
  lead_auditor_id uuid references profiles(id),
  external_certifier text,
  -- Só existe se type='externa'. CHECK abaixo garante que nasce preenchido
  -- junto com external_certifier quando externa, e nulo quando interna —
  -- é a regra "campo Evento só aparece se tipo=Externa" (seção 10 do Guia)
  -- espelhada no banco.
  event text check (event in ('certificacao', 'monitoracao_12m', 'monitoracao_24m', 'recertificacao')),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id),
  cancel_reason text,
  unique (org_id, code),
  check (end_date >= start_date),
  check (status <> 'cancelada' or cancel_reason is not null),
  check (
    (type = 'externa' and event is not null and external_certifier is not null)
    or (type = 'interna' and event is null)
  )
);

create index audits_org_id_idx on audits(org_id);
create index audits_org_status_idx on audits(org_id, status);
create index audits_org_unit_idx on audits(org_id, unit_id);
create index audits_org_type_idx on audits(org_id, type);

-- Contador de código por organização e ano — mesmo mecanismo atômico de
-- nc_code_counters/action_plan_code_counters (UPSERT, sem race condition).
create table audit_code_counters (
  org_id uuid not null references organizations(id) on delete cascade,
  year int not null,
  next_seq int not null default 1,
  primary key (org_id, year)
);

-- Auditores da auditoria (interna ou externa). auditor_name é sempre
-- preenchido (mesmo para interno, para exibição rápida sem join); user_id
-- só existe quando o auditor tem conta no Jáwda (interno). Chave primária
-- composta por (audit_id, auditor_name) — não precisamos de FK apontando
-- para uma linha específica daqui: a agenda do plano (audit_plan_items)
-- referencia profiles diretamente, porque só um auditor com conta pode ser
-- alocado a um bloco do plano.
create table audit_auditors (
  audit_id uuid not null references audits(id) on delete cascade,
  auditor_name text not null,
  is_internal boolean not null default false,
  user_id uuid references profiles(id),
  primary key (audit_id, auditor_name)
);

create index audit_auditors_audit_id_idx on audit_auditors(audit_id);

-- Agenda da auditoria interna (dia x processo x auditor). Só populada
-- quando audits.type='interna' — enforced por trigger na migração de
-- triggers (não dá para expressar "só se o pai for X" em CHECK simples sem
-- subquery, e CHECK não pode referenciar outra tabela).
create table audit_plan_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  day_number int not null check (day_number > 0),
  start_time time not null,
  end_time time not null,
  process text not null,
  requirements text[] not null default '{}',
  auditor_id uuid references profiles(id),
  notes text,
  check (end_time > start_time)
);

create index audit_plan_items_audit_id_idx on audit_plan_items(audit_id);

-- Checklist por requisito da auditoria interna. classification usa a mesma
-- escala C/OPM/NCS/NCM/NCC do protótipo (Conforme / Observação de
-- Melhoria Potencial / NC Simples / NC Moderada / NC Crítica).
-- evidence_files guarda só referências ao Storage (path/nome), nunca
-- binário — upload real segue o bucket de evidências (migração própria).
create table audit_checklist_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  requirement_code text not null,
  requirement_title text not null,
  guidance text,
  classification text check (classification in ('C', 'OPM', 'NCS', 'NCM', 'NCC')),
  evidence_notes text,
  evidence_files jsonb not null default '[]',
  evaluated_at timestamptz,
  evaluated_by uuid references profiles(id),
  unique (audit_id, requirement_code)
);

create index audit_checklist_items_audit_id_idx on audit_checklist_items(audit_id);

-- Apontamentos (findings) da auditoria interna. code é sequencial POR
-- AUDITORIA (não por org/ano, diferente de ncs/action_plans) — contador
-- dedicado abaixo. generated_nc_id/generated_action_plan_id são o gancho
-- bidirecional com NC real e Plano de Ação real (item 8 do prompt da
-- ABA 6): preenchidos depois da criação do finding, quando o usuário clica
-- em "Gerar NC"/"Gerar Plano de Ação".
create table audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  checklist_item_id uuid references audit_checklist_items(id),
  code text not null,
  type text not null check (type in ('OPM', 'NCS', 'NCM', 'NCC')),
  norm_requirement text,
  description text not null,
  severity_suggested text check (severity_suggested in ('baixa', 'media', 'alta', 'critica')),
  generated_nc_id uuid references ncs(id),
  generated_action_plan_id uuid references action_plans(id),
  status text not null default 'aberto'
    check (status in (
      'aberto', 'em_tratativa', 'aguardando_verificacao',
      'encerrado_eficaz', 'encerrado_nao_eficaz'
    )),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (audit_id, code)
);

create index audit_findings_audit_id_idx on audit_findings(audit_id);
create index audit_findings_checklist_item_idx on audit_findings(checklist_item_id);

-- Contador de código de finding — sequencial por auditoria (audit_id),
-- não por org/ano. Mesmo mecanismo UPSERT atômico dos outros contadores.
create table audit_finding_code_counters (
  audit_id uuid primary key references audits(id) on delete cascade,
  next_seq int not null default 1
);

-- Relatório final da auditoria interna. audit_id é a própria PK (1:1 com a
-- auditoria) — não existe "vários relatórios por auditoria" na v1.
-- recommendation usa só as duas opções que fazem sentido para auditoria
-- INTERNA (a recomendação de certificação/recertificação é decisão da
-- certificadora, não nossa, em auditoria externa).
create table audit_reports (
  audit_id uuid primary key references audits(id) on delete cascade,
  summary text,
  positive_points text,
  conclusion text,
  recommendation text check (recommendation in ('manutencao_certificacao', 'reauditoria')),
  exported_pdf_url text,
  generated_at timestamptz,
  generated_by uuid references profiles(id)
);
