-- Painel de Reconhecimento (Dashboard Executivo) — selos de sequência por
-- setor/unidade. Os rankings (NC/melhoria) não têm tabela própria — são
-- query direta em `ncs`/`changes_improvements` (calculado na UI, seção
-- "CÁLCULO NA UI" do prompt desta aba).
--
-- unit_id nullable = selo no nível da organização inteira (ex.:
-- treinamentos, que não tem unit_id na origem). Quando presente, é
-- copiado da origem do evento (ncs.unit_id ou
-- action_plan_corrective_actions.unit_id).

create table recognition_badge_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  unit_id uuid references units(id),
  badge_type text not null check (badge_type in (
    'sem_nc_critica', 'zero_planos_vencidos', 'treinamentos_no_prazo'
  )),
  event text not null check (event in ('iniciado', 'quebrado')),
  event_date timestamptz not null default now(),
  streak_days_at_break int,
  created_at timestamptz not null default now(),
  check (event <> 'quebrado' or streak_days_at_break is not null)
);

create index recognition_badge_events_org_id_idx on recognition_badge_events(org_id);
create index recognition_badge_events_lookup_idx
  on recognition_badge_events(org_id, badge_type, unit_id, event, event_date desc);
