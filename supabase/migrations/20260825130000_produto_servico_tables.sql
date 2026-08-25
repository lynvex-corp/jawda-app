-- Módulo Processos e Operação (Parte 4) — Produto ou Serviço.
--
-- status de service_demands é sempre recomputado a partir das etapas pelo
-- trigger de 20260825130200 — nunca setado livremente pelo client, exceto
-- a transição explícita para 'entregue' via
-- register_service_demand_delivery (mesmo arquivo), que também é a única
-- forma de gravar comparison_delivered_vs_requested.

create table service_demands (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  -- Gerado pelo trigger service_demands_generate_code (20260825130200) —
  -- formato PS-{ano}-{sequencial}, nunca aceito do client.
  code text not null,
  client_or_origin text not null,
  requirements text not null,
  expected_date date,
  status text not null default 'requisitos_em_analise' check (status in (
    'requisitos_em_analise', 'em_producao', 'em_verificacao', 'entregue'
  )),
  comparison_delivered_vs_requested text,
  -- Gancho para NC (seção 21.4) — só a referência, nenhum campo de
  -- tratativa duplicado aqui.
  generated_nc_id uuid references ncs(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (org_id, code)
);

create index service_demands_org_id_idx on service_demands(org_id);

create table service_demand_stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  demand_id uuid not null references service_demands(id) on delete cascade,
  stage_name text not null,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida')),
  responsible_id uuid references profiles(id),
  stage_order int not null,
  created_at timestamptz not null default now(),
  unique (demand_id, stage_order)
);

create index service_demand_stages_org_id_idx on service_demand_stages(org_id);
create index service_demand_stages_demand_idx on service_demand_stages(demand_id, stage_order);
