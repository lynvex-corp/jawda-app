-- Tabela `ncs` — primeiro módulo de negócio migrado de mock para dado real
-- (ABA 4). Segue docs/MODELO_DE_DADOS.md com os desvios abaixo, necessários
-- para não alterar visualmente as telas já construídas no protótipo
-- (src/components/nao-conformidades/{page,detalhe,nova-wizard}.tsx):
--
-- status: o desenho original previa 5 estados. A UI já construída distingue
-- "Em Classificação" de "Em Análise" como duas colunas separadas do Kanban
-- (antes e depois da ferramenta de causa raiz — 5 Porquês/Ishikawa).
-- Adicionado 'em_analise' para preservar essa distinção sem inventar coluna
-- nova. "Rascunho" da UI não vira estado de banco — é só o wizard antes do
-- primeiro save (a NC só existe no banco a partir da Classificação).
--
-- category: o desenho original listava 4 valores no estilo "natureza do
-- desvio" (falha_qualidade, descumprimento_procedimento, ...). Nenhuma tela
-- do protótipo usa esses valores — o wizard em produção oferece 5 categorias
-- por área (Qualidade, Segurança, Meio Ambiente, Regulatório, Financeiro).
-- Substituído pelo enum realmente usado na tela; campo ficou opcional como
-- já era nos dados mockados.
--
-- local: campo texto livre não previsto no desenho original. A UI distingue
-- "Local de ocorrência" (Produção/Administrativo/Serviço/...) de "Setor de
-- Ocorrência" (coluna `sector`, já compatível com o doc). Mantido como texto
-- livre (sem CHECK) porque a lista de locais tende a crescer por cliente.
--
-- occurred_at: data da ocorrência coletada no wizard (etapa 1), usada como
-- base do cálculo do prazo SLA. Não estava no desenho original.
--
-- created_by / responsible_id: default auth.uid() — o wizard atual não pede
-- "responsável pela NC" como campo próprio (isso fica pro módulo de Plano de
-- Ação), então quem cria assume como responsável até ser reatribuído.

create table ncs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid references units(id),
  code text not null,
  origin text not null check (origin in (
    'auditoria_interna','auditoria_externa','rotina_processo','documental',
    'reclamacao_cliente','analise_critica_direcao','incidente_acidente',
    'fornecedor','indicador'
  )),
  description text not null,
  severity text not null check (severity in ('baixa','media','alta','critica')),
  category text check (category in (
    'qualidade','seguranca','meio_ambiente','regulatorio','financeiro'
  )),
  sector text check (sector in (
    'operacao','planejamento','projeto','comercial','pos_venda',
    'administrativo','financeiro','rh','qualidade'
  )),
  local text,
  occurred_at timestamptz,
  responsible_id uuid references profiles(id) default auth.uid(),
  status text not null default 'aberto' check (status in (
    'aberto','em_analise','em_tratativa','aguardando_verificacao','encerrado','cancelado'
  )),
  sla_deadline timestamptz not null,
  is_recurrent boolean not null default false,
  previous_nc_id uuid references ncs(id),
  swot_forwarded boolean not null default false,
  ai_authored boolean not null default false,
  ai_approved_by uuid references profiles(id),
  ai_approved_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id),
  cancel_reason text,
  created_at timestamptz not null default now(),
  created_by uuid not null references profiles(id) default auth.uid(),
  unique (org_id, code),
  check (status <> 'cancelado' or cancel_reason is not null)
);

create index ncs_org_id_idx on ncs(org_id);
create index ncs_org_status_idx on ncs(org_id, status);
create index ncs_org_unit_idx on ncs(org_id, unit_id);
