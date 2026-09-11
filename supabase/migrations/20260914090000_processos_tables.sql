-- Mapa de Processos, Bloco A: cartões, sem editor visual ainda (Bloco B).
--
-- Substitui o hub fixo de /processos (6 processos hardcoded no código,
-- comentário no próprio arquivo dizia que o construtor de fluxo estava
-- indefinido). Cada organização parte de ZERO — nada de processo padrão
-- semeado, é a empresa quem estrutura os próprios.
--
-- Dono e colaboradores apontam para `employees` (Cargos e Perfis), não
-- para usuários de login — decisão confirmada com o Matheus: nem todo
-- dono de processo tem conta no sistema.

create table process_maps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade
    default (auth.jwt() ->> 'org_id')::uuid,
  code text not null,
  name text not null,
  description text,
  entradas text,
  saidas text,
  -- Lista curada, não texto livre — evita string arbitrária virando nome
  -- de ícone inválido na hora de resolver no iconMap do frontend.
  icon text not null default 'Cog' check (icon in (
    'Boxes', 'Building2', 'ClipboardCheck', 'Cog', 'Factory', 'HardHat',
    'Handshake', 'Landmark', 'Megaphone', 'Package', 'Scale', 'Server',
    'ShieldCheck', 'ShoppingCart', 'Truck', 'Users', 'Wrench'
  )),
  owner_employee_id uuid references employees(id),
  -- Mesmo padrão de Cargos e Perfis (20260912090000): is_active, sem
  -- motivo obrigatório — "arquivar" aqui é reversível e não é uma
  -- decisão de auditoria como cancelar NC/Auditoria.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid()
);

create index process_maps_org_id_idx on process_maps(org_id);
create unique index process_maps_code_unique on process_maps(org_id, code);

create table process_map_collaborators (
  id uuid primary key default gen_random_uuid(),
  process_map_id uuid not null references process_maps(id) on delete cascade,
  employee_id uuid not null references employees(id),
  unique (process_map_id, employee_id)
);

create index process_map_collaborators_process_idx on process_map_collaborators(process_map_id);

-- ============================================================
-- employees_public_name — achado ao desenhar o Bloco A: a RLS de
-- `employees` (20260825090100) restringe SELECT a is_hr_authorized ou ao
-- próprio funcionário (linked_user_id = auth.uid()) — protege ASO,
-- matrícula, e-mail, situação de competência. Mas o cartão de processo
-- mostra "Dono: <nome>" pra QUALQUER papel com "Ver" em Processos
-- (Auditor, Colaborador, Somente Leitura inclusive), que nunca são
-- is_hr_authorized nem, na maioria dos casos, o próprio dono.
--
-- Esta view expõe SÓ id/org_id/nome — nada sensível — com
-- security_invoker=false (roda com o dono da view, não do chamador),
-- então ignora a RLS de `employees` só pra esses 3 campos. O resto do
-- dossiê continua tão protegido quanto hoje; nome nunca foi tratado como
-- sigiloso no resto do sistema (é o mesmo padrão de `profiles`, aberto
-- entre colegas de organização).
create view employees_public_name
  with (security_invoker = false)
  as
  select id, org_id, nome from employees;

grant select on employees_public_name to authenticated;
