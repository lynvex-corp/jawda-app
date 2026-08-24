-- Módulo Estratégia (Aba 17, sub-aba 6/7) — Análise Crítica pela Direção
-- (ISO 9001 9.3). Não é documento versionado como as outras 5 sub-abas —
-- é uma série de reuniões formais, cada uma virando ata. Ata concluída
-- nunca é editada de novo (seção 2 do Guia: "nada apaga" — aqui também
-- "nada edita depois de fechado"); só nova reunião ou anulação com motivo.
--
-- Quatro tabelas:
--   critical_analysis_meetings — a reunião/ata em si.
--   critical_analysis_agenda_items — pautas da reunião (lista fixa
--     sugerida na UI, mas linha por linha aqui — sem enum, texto livre
--     permitido conforme o prompt desta aba).
--   critical_analysis_participants — quem participa e quem já aprovou a
--     ata. Todos aprovando fecha a reunião automaticamente (trigger).
--   critical_analysis_action_items — ações de saída da reunião (mesmo
--     padrão de gancho de swot_cards/risks_opportunities:
--     generated_action_plan_id nullable, sem duplicar campo de tratativa).
--
-- agenda_items/participants/action_items não têm org_id próprio — RLS
-- resolve via join com a reunião pai, mesmo padrão de
-- indicator_target_history / risk_reassessments.

create table critical_analysis_meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  status text not null default 'programada' check (status in (
    'programada', 'em_andamento', 'aguardando_aprovacao', 'concluida', 'anulada'
  )),
  scheduled_date date not null,
  periodicity text not null check (periodicity in ('semestral', 'anual', 'personalizado')),
  start_datetime timestamptz,
  end_datetime timestamptz,
  previous_meeting_reference text,
  deliberations text,
  -- Anulação: nunca deleta (seção 2 do Guia), só muda status com motivo.
  -- annulled_by/annulled_at seguem o mesmo trio de cancelled_by/
  -- cancelled_at/cancel_reason já usado em ncs/action_plans.
  annulment_reason text,
  annulled_by uuid references profiles(id),
  annulled_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  check (status <> 'anulada' or (annulment_reason is not null and annulled_by is not null))
);

create index critical_analysis_meetings_org_id_idx on critical_analysis_meetings(org_id);
create index critical_analysis_meetings_org_status_idx on critical_analysis_meetings(org_id, status);

create table critical_analysis_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references critical_analysis_meetings(id) on delete cascade,
  topic text not null,
  analyzed_content text,
  comments text,
  item_order int not null default 0
);

create index critical_analysis_agenda_items_meeting_idx
  on critical_analysis_agenda_items(meeting_id, item_order);

create table critical_analysis_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references critical_analysis_meetings(id) on delete cascade,
  user_id uuid not null references profiles(id),
  attended boolean not null default false,
  approved boolean not null default false,
  approved_at timestamptz,
  unique (meeting_id, user_id)
);

create index critical_analysis_participants_meeting_idx on critical_analysis_participants(meeting_id);

create table critical_analysis_action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references critical_analysis_meetings(id) on delete cascade,
  type text not null check (type in (
    'oportunidade_melhoria', 'necessidade_mudanca', 'necessidade_recurso'
  )),
  description text not null,
  generated_action_plan_id uuid references action_plans(id),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) default auth.uid()
);

create index critical_analysis_action_items_meeting_idx on critical_analysis_action_items(meeting_id);
