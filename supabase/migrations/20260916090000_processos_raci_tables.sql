-- Mapa de Processos, Bloco C: RACI (Responsável/Aprovador/Consultado/
-- Informado) por elemento do fluxo.
--
-- Relacional, nunca dentro do JSON do diagrama — decisão do plano
-- original: RACI aponta pra employees/job_positions por FK de verdade
-- (não texto livre), então a mesma disciplina de "nunca vazar entre
-- organizações" que já existe pra responsável de tarefa/raia (Bloco B)
-- se aplica aqui via FK simples, sem precisar da função de JSON.

create table process_map_raci (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  version_id uuid not null references process_map_versions(id) on delete cascade,
  -- id do nó dentro de diagram->'nodes' (React Flow), não FK — o nó vive
  -- só dentro do JSONB da versão. Validado na RLS (20260916090100) contra
  -- apontar pra um node_key que não existe naquela versão.
  node_key text not null,
  employee_id uuid references employees(id),
  job_position_id uuid references job_positions(id),
  papel text not null check (papel in ('responsavel', 'aprovador', 'consultado', 'informado')),
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  -- Exatamente um dos dois — pessoa OU cargo, nunca os dois nem nenhum
  -- (mesma regra do responsável de tarefa/raia no Bloco B).
  check ((employee_id is not null) <> (job_position_id is not null))
);

create index process_map_raci_org_id_idx on process_map_raci(org_id);
create index process_map_raci_version_idx on process_map_raci(version_id, node_key);

-- Dois índices parciais, não uma UNIQUE só: com employee_id/job_position_id
-- sempre tendo um dos dois NULL, uma UNIQUE normal nas duas colunas juntas
-- NÃO barraria duplicata (Postgres nunca trata NULL = NULL como igual pra
-- fins de unicidade — duas linhas "iguais" com job_position_id nulo em
-- ambas passariam batido). Cada índice parcial só existe pra linhas do seu
-- tipo, onde a coluna relevante é garantidamente not null.
create unique index process_map_raci_unique_employee
  on process_map_raci(version_id, node_key, papel, employee_id)
  where employee_id is not null;

create unique index process_map_raci_unique_position
  on process_map_raci(version_id, node_key, papel, job_position_id)
  where job_position_id is not null;
