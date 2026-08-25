-- Módulo Processos e Operação (Parte 3) — Fornecedores, dentro de
-- Suprimentos (requisito 8.4). A lista fechada de critérios de
-- qualificação (10 itens, ordem alfabética) foi confirmada pelo usuário
-- porque o "pacote consolidado de prompts" citado na especificação não
-- está neste repositório — não inventada.

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  nome_fantasia text not null,
  ramo text,
  nome_representante text,
  contato text,
  email text,
  cnpj text,
  descricao_fornecimento text,
  categoria text not null check (categoria in ('material', 'servico')),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index suppliers_org_id_idx on suppliers(org_id);

-- Critério selecionado precisa de anexo OU observação — regra explícita
-- do prompt, aplicada como CHECK (não só validação de UI).
create table supplier_qualification_criteria (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  criterion text not null check (criterion in (
    'atendimento_normas_sso',
    'atendimento_prazo_acordado',
    'capacidade_produtiva',
    'certificacoes_produto_servico',
    'licencas_sanitarias_ambientais',
    'permissao_acesso_instalacoes',
    'regularidade_fiscal_trabalhista_previdenciaria',
    'responsabilidade_qualificacao_tecnica',
    'sistema_gestao',
    'situacao_cadastral_ativa'
  )),
  attachment_url text,
  observation text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid(),
  unique (supplier_id, criterion),
  check (attachment_url is not null or observation is not null)
);

create index supplier_qualification_criteria_org_id_idx on supplier_qualification_criteria(org_id);
create index supplier_qualification_criteria_supplier_idx
  on supplier_qualification_criteria(supplier_id);

-- supplier_id nulo = parâmetro padrão da org; preenchido = específico
-- daquele fornecedor (sobrepõe o padrão). Um único parâmetro padrão por
-- org e um único específico por fornecedor.
create table supplier_evaluation_parameters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  supplier_id uuid references suppliers(id) on delete cascade,
  minimum_approval_score numeric not null check (minimum_approval_score between 0 and 5),
  periodicity text not null check (periodicity in ('anual', 'semestral', 'trimestral')),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid()
);

create unique index supplier_evaluation_parameters_org_default_idx
  on supplier_evaluation_parameters(org_id) where supplier_id is null;
create unique index supplier_evaluation_parameters_supplier_idx
  on supplier_evaluation_parameters(supplier_id) where supplier_id is not null;

-- evaluation_number gerado pelo trigger (20260825120200) — sequencial por
-- fornecedor, nunca aceito do client.
create table supplier_evaluations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  evaluation_number int not null,
  quality_score numeric not null check (quality_score between 0 and 5),
  deadline_score numeric not null check (deadline_score between 0 and 5),
  service_score numeric not null check (service_score between 0 and 5),
  legal_requirements_score numeric not null check (legal_requirements_score between 0 and 5),
  overall_score numeric generated always as (
    (quality_score + deadline_score + service_score + legal_requirements_score) / 4
  ) stored,
  feedback_message text,
  feedback_sent_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (supplier_id, evaluation_number)
);

create index supplier_evaluations_org_id_idx on supplier_evaluations(org_id);
create index supplier_evaluations_supplier_idx
  on supplier_evaluations(supplier_id, evaluation_number);
