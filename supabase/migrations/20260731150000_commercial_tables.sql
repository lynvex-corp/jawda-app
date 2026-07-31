-- Módulo Comercial do Admin (funil de vendas + propostas + catálogo de
-- preços sugeridos). Reusa o enum de módulo de contract_modules (ABA 8) e
-- de norma de contract_norms — mesma lista, copiada aqui porque Postgres
-- não tem "domain reuse" prático via CHECK entre tabelas diferentes.
--
-- Diferença chave de arquitetura vs. todo o resto do banco: estas tabelas
-- NÃO têm org_id. Oportunidade e proposta nascem antes de existir empresa
-- (a empresa só nasce no fechamento, seção 9 do Guia — "Comercial e funil"
-- é trabalho pós-v1 sobre a fundação do Painel Admin). São, portanto,
-- exclusivas do internal_staff por natureza, não por política adicional.

-- =========================================================================
-- Catálogo de preços sugeridos (referência para novas propostas — nunca
-- reescreve contrato já assinado, ver aviso na tela "Planos e Preços")
-- =========================================================================

create table module_pricing_catalog (
  module text primary key check (module in (
    'non_conformity', 'action_plan', 'audit', 'indicators', 'documents',
    'risks', 'strategy', 'processes', 'people', 'acquisition', 'production',
    'communications'
  )),
  default_extra_monthly_value numeric(10, 2) not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references internal_staff(id)
);

create table norm_pricing_catalog (
  norm text primary key check (norm in ('iso_9001', 'iso_14001', 'iso_45001', 'lgpd')),
  default_extra_monthly_value numeric(10, 2) not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references internal_staff(id)
);

-- Semeia o catálogo com valor 0 pra cada módulo/norma existente — a tela de
-- preços edita valores reais depois; sem a semente, o construtor de
-- proposta abriria com grid vazio no primeiro uso.
insert into module_pricing_catalog (module) values
  ('non_conformity'), ('action_plan'), ('audit'), ('indicators'), ('documents'),
  ('risks'), ('strategy'), ('processes'), ('people'), ('acquisition'),
  ('production'), ('communications');

insert into norm_pricing_catalog (norm) values
  ('iso_9001'), ('iso_14001'), ('iso_45001'), ('lgpd');

-- =========================================================================
-- Funil de vendas
-- =========================================================================

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  company_name_draft text not null,
  cnpj_draft text,
  segment text,
  estimated_mrr numeric(10, 2),
  stage text not null default 'lead' check (stage in (
    'lead', 'contato', 'demonstracao', 'proposta', 'negociacao',
    'fechado_ganho', 'fechado_perdido'
  )),
  origin text not null check (origin in (
    'indicacao', 'site', 'linkedin', 'evento', 'consultoria', 'outro'
  )),
  responsible_staff_id uuid references internal_staff(id),
  lost_reason text,
  generated_org_id uuid references organizations(id),
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references internal_staff(id),
  check (stage <> 'fechado_perdido' or lost_reason is not null)
);

create index opportunities_stage_idx on opportunities(stage);
create index opportunities_responsible_idx on opportunities(responsible_staff_id);

-- =========================================================================
-- Propostas
-- =========================================================================

-- Sequencial global e simples (não por org — proposta nasce antes da
-- organização existir, e "número da proposta" aqui é um número de série da
-- Lynvex, não um código por cliente como PA_/NC_). Sequence do Postgres
-- basta; não precisa da tabela de contador com UPSERT atômico que ncs/
-- action_plans usam, porque aqui não há particionamento por org_id.
create sequence proposal_number_seq;

create table proposals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  number integer not null unique default nextval('proposal_number_seq'),
  plan_id uuid not null references plans(id),
  -- Snapshot do valor no momento do envio — não referencia o catálogo ao
  -- vivo. Preço do catálogo pode mudar depois; a proposta já enviada não
  -- pode mudar sozinha (mesmo princípio de "não sobrescrever o que já está
  -- fechado" do aviso de meta do indicador, seção 21.5 do Guia).
  modules_included jsonb not null default '[]',
  norms_included jsonb not null default '[]',
  total_monthly_value numeric(10, 2) not null,
  discount_percentage numeric(5, 2) not null default 0,
  payment_terms text,
  validity_date date,
  status text not null default 'rascunho' check (status in (
    'rascunho', 'enviada', 'em_analise', 'aceita', 'recusada'
  )),
  view_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references internal_staff(id)
);

create index proposals_opportunity_idx on proposals(opportunity_id);

grant select, insert, update on module_pricing_catalog to authenticated;
grant all on module_pricing_catalog to service_role;

grant select, insert, update on norm_pricing_catalog to authenticated;
grant all on norm_pricing_catalog to service_role;

grant select, insert, update on opportunities to authenticated;
grant all on opportunities to service_role;

grant select, insert, update on proposals to authenticated;
grant all on proposals to service_role;

grant usage on sequence proposal_number_seq to authenticated;
grant all on sequence proposal_number_seq to service_role;
-- delete NUNCA é concedido a authenticated (nada apaga)
