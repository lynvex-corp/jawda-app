-- Mapa de Processos, Bloco B: editor visual (React Flow) + versionamento.
--
-- Mesmo padrão de rascunho/formalizada já usado em Estratégia (SWOT,
-- Diretrizes, Valores): 1 rascunho aberto por processo, formalizar
-- carimba version_label/formalized_at/formalized_by e a linha vira
-- imutável (RLS de UPDATE exige status='rascunho' na linha ANTIGA — ver
-- 20260915090100). Formalizar é ação separada de editar o conteúdo:
-- editar fica com quem tem "Editar" (admin/quality_manager/area_manager);
-- formalizar exige "Aprovar" (admin/quality_manager, sem area_manager) —
-- trigger cuida disso, RLS sozinha não compara OLD.status com NEW.status
-- numa única expressão (mesmo motivo do Bloco 5).

create table process_map_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  process_map_id uuid not null references process_maps(id) on delete cascade,
  version_number int not null,
  version_label text,
  status text not null default 'rascunho' check (status in ('rascunho', 'formalizada')),
  -- {nodes: [...], edges: [...]} — formato do React Flow. Raia/tarefa
  -- carregam responsibleEmployeeId OU responsibleJobPositionId em
  -- data{} — validado a cada escrita (20260915090100) pra nunca apontar
  -- pra pessoa/cargo de outra organização.
  diagram jsonb not null default '{"nodes": [], "edges": []}',
  formalized_at timestamptz,
  formalized_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (process_map_id, version_number),
  check (
    status <> 'formalizada'
    or (version_label is not null and formalized_at is not null and formalized_by is not null)
  )
);

create unique index process_map_versions_one_draft
  on process_map_versions(process_map_id) where status = 'rascunho';
create index process_map_versions_org_id_idx on process_map_versions(org_id);
create index process_map_versions_process_idx
  on process_map_versions(process_map_id, version_number desc);
