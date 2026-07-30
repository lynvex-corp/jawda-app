import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  type NC,
  type NCStatus,
  type Origem,
  type Severity,
  type SetorOcorrencia,
} from "@/lib/mock-data";

/* ============================================================
 * Tipos do banco (enums exatamente como gravados em `ncs`)
 * ============================================================ */

export type NCOriginDb =
  | "auditoria_interna"
  | "auditoria_externa"
  | "rotina_processo"
  | "documental"
  | "reclamacao_cliente"
  | "analise_critica_direcao"
  | "incidente_acidente"
  | "fornecedor"
  | "indicador";

export type NCSeverityDb = "baixa" | "media" | "alta" | "critica";

export type NCStatusDb =
  | "aberto"
  | "em_analise"
  | "em_tratativa"
  | "aguardando_verificacao"
  | "encerrado"
  | "cancelado";

export type NCCategoryDb =
  | "qualidade"
  | "seguranca"
  | "meio_ambiente"
  | "regulatorio"
  | "financeiro";

export type NCSectorDb =
  | "operacao"
  | "planejamento"
  | "projeto"
  | "comercial"
  | "pos_venda"
  | "administrativo"
  | "financeiro"
  | "rh"
  | "qualidade";

/** Categorias tal como oferecidas no wizard (etapa 2 — Classificação). */
export const categoriasNC = [
  "Qualidade",
  "Segurança",
  "Meio Ambiente",
  "Regulatório",
  "Financeiro",
] as const;
export type CategoriaNC = (typeof categoriasNC)[number];

/* ============================================================
 * Mapas de tradução DB (snake_case) <-> UI (rótulos em português,
 * usados por src/lib/mock-data.ts e pelos componentes existentes)
 * ============================================================ */

const ORIGIN_DB_TO_UI: Record<NCOriginDb, Origem> = {
  auditoria_interna: "Auditoria Interna",
  auditoria_externa: "Auditoria Externa",
  rotina_processo: "Rotina do Processo",
  documental: "Documental",
  reclamacao_cliente: "Reclamação de Cliente",
  analise_critica_direcao: "Análise Crítica pela Direção",
  incidente_acidente: "Incidente / Acidente",
  fornecedor: "Fornecedor",
  indicador: "Indicador",
};

const ORIGIN_UI_TO_DB: Record<Origem, NCOriginDb> = Object.fromEntries(
  Object.entries(ORIGIN_DB_TO_UI).map(([db, ui]) => [ui, db]),
) as Record<Origem, NCOriginDb>;

const SEVERITY_DB_TO_UI: Record<NCSeverityDb, Severity> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const SEVERITY_UI_TO_DB: Record<Severity, NCSeverityDb> = Object.fromEntries(
  Object.entries(SEVERITY_DB_TO_UI).map(([db, ui]) => [ui, db]),
) as Record<Severity, NCSeverityDb>;

/**
 * Status do banco tem um estado a mais que o do protótipo original
 * (em_analise) para preservar as colunas do Kanban já construído — ver
 * comentário em supabase/migrations/20260729140100_ncs_table.sql.
 * "Rascunho" não existe no banco: a NC só é gravada a partir da etapa de
 * Classificação do wizard.
 */
const STATUS_DB_TO_UI: Record<NCStatusDb, NCStatus> = {
  aberto: "Em Classificação",
  em_analise: "Em Análise",
  em_tratativa: "Plano em Execução",
  aguardando_verificacao: "Em Avaliação",
  encerrado: "Encerrada",
  cancelado: "Cancelada",
};

const STATUS_UI_TO_DB: Partial<Record<NCStatus, NCStatusDb>> = Object.fromEntries(
  Object.entries(STATUS_DB_TO_UI).map(([db, ui]) => [ui, db]),
);

const CATEGORY_DB_TO_UI: Record<NCCategoryDb, CategoriaNC> = {
  qualidade: "Qualidade",
  seguranca: "Segurança",
  meio_ambiente: "Meio Ambiente",
  regulatorio: "Regulatório",
  financeiro: "Financeiro",
};

const CATEGORY_UI_TO_DB: Record<CategoriaNC, NCCategoryDb> = Object.fromEntries(
  Object.entries(CATEGORY_DB_TO_UI).map(([db, ui]) => [ui, db]),
) as Record<CategoriaNC, NCCategoryDb>;

const SECTOR_DB_TO_UI: Record<NCSectorDb, SetorOcorrencia> = {
  operacao: "Operação",
  planejamento: "Planejamento",
  projeto: "Projeto",
  comercial: "Comercial",
  pos_venda: "Pós-Venda",
  administrativo: "Administrativo",
  financeiro: "Financeiro",
  rh: "RH",
  qualidade: "Qualidade",
};

const SECTOR_UI_TO_DB: Record<SetorOcorrencia, NCSectorDb> = Object.fromEntries(
  Object.entries(SECTOR_DB_TO_UI).map(([db, ui]) => [ui, db]),
) as Record<SetorOcorrencia, NCSectorDb>;

/* ============================================================
 * Linha do banco + tradução para o shape `NC` já usado pela UI
 * ============================================================ */

export interface NcDbRow {
  id: string;
  org_id: string;
  unit_id: string | null;
  code: string;
  origin: NCOriginDb;
  description: string;
  severity: NCSeverityDb;
  category: NCCategoryDb | null;
  sector: NCSectorDb | null;
  local: string | null;
  occurred_at: string | null;
  responsible_id: string | null;
  status: NCStatusDb;
  sla_deadline: string;
  is_recurrent: boolean;
  previous_nc_id: string | null;
  swot_forwarded: boolean;
  ai_authored: boolean;
  ai_approved_by: string | null;
  ai_approved_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  created_by: string;
  indicator_id: string | null;
  responsible: { full_name: string } | null;
  indicator: { code: string } | null;
}

const NC_SELECT =
  "*, responsible:profiles!responsible_id(full_name), indicator:indicators!indicator_id(code)";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function computeSlaStatus(slaDeadlineIso: string): NC["slaStatus"] {
  const deadline = new Date(slaDeadlineIso).getTime();
  const now = Date.now();
  if (now > deadline) return "vencido";
  if (deadline - now <= 2 * 86_400_000) return "proximo";
  return "ok";
}

/** NC com os campos extras do banco que a UI mockada não tinha (cancelamento, IA, etc). */
export interface NCRecord extends NC {
  orgId: string;
  unitId: string | null;
  status: NCStatus;
  statusDb: NCStatusDb;
  category?: CategoriaNC;
  isAiAuthored: boolean;
  aiApprovedBy: string | null;
  aiApprovedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  previousNcId: string | null;
  createdBy: string;
  indicatorId: string | null;
  indicatorCode: string | null;
}

function mapRowToNC(row: NcDbRow): NCRecord {
  const nome = row.responsible?.full_name ?? "Não atribuído";
  return {
    id: row.id,
    codigo: row.code,
    descricao: row.description,
    origem: ORIGIN_DB_TO_UI[row.origin],
    gravidade: SEVERITY_DB_TO_UI[row.severity],
    responsavel: { nome, iniciais: initials(nome) },
    status: STATUS_DB_TO_UI[row.status],
    prazoSLA: row.sla_deadline,
    slaStatus: computeSlaStatus(row.sla_deadline),
    reincidente: row.is_recurrent,
    criadoEm: row.created_at,
    local: row.local ?? "",
    setorOcorrencia: row.sector ? SECTOR_DB_TO_UI[row.sector] : undefined,
    orgId: row.org_id,
    unitId: row.unit_id,
    statusDb: row.status,
    category: row.category ? CATEGORY_DB_TO_UI[row.category] : undefined,
    isAiAuthored: row.ai_authored,
    aiApprovedBy: row.ai_approved_by,
    aiApprovedAt: row.ai_approved_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    previousNcId: row.previous_nc_id,
    createdBy: row.created_by,
    indicatorId: row.indicator_id,
    indicatorCode: row.indicator?.code ?? null,
  };
}

/* ============================================================
 * Query keys
 * ============================================================ */

export const ncKeys = {
  all: ["ncs"] as const,
  lists: () => [...ncKeys.all, "list"] as const,
  list: (filters: NCListFilters) => [...ncKeys.lists(), filters] as const,
  detail: (id: string) => [...ncKeys.all, "detail", id] as const,
};

export interface NCListFilters {
  status?: NCStatus[];
}

/* ============================================================
 * Hooks
 * ============================================================ */

export function useNCs(filters: NCListFilters = {}) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ncKeys.list(filters),
    queryFn: async () => {
      let query = supabase.from("ncs").select(NC_SELECT).order("created_at", { ascending: false });
      if (filters.status?.length) {
        const dbStatuses = filters.status
          .map((s) => STATUS_UI_TO_DB[s])
          .filter((s): s is NCStatusDb => Boolean(s));
        if (dbStatuses.length) query = query.in("status", dbStatuses);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as NcDbRow[]).map(mapRowToNC);
    },
  });
}

export function useNC(id: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ncKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("ncs").select(NC_SELECT).eq("id", id).single();
      if (error) throw error;
      return mapRowToNC(data as unknown as NcDbRow);
    },
  });
}

export interface CreateNCInput {
  origem: Origem;
  descricao: string;
  gravidade: Severity;
  category?: CategoriaNC;
  setorOcorrencia?: SetorOcorrencia;
  local?: string;
  dataOcorrencia?: Date;
  reincidente?: boolean;
  previousNcId?: string;
  unitId?: string;
  /** Preenchido só pelo gatilho de indicador fora da meta por N ciclos
   * (seção 10 do Guia de Arquitetura) — liga a NC de volta ao indicador de
   * origem para o chip bidirecional "Origem: IND_..." / "NC gerada: ...". */
  indicatorId?: string;
}

export function useCreateNC() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNCInput) => {
      const { data, error } = await supabase
        .from("ncs")
        .insert({
          origin: ORIGIN_UI_TO_DB[input.origem],
          description: input.descricao,
          severity: SEVERITY_UI_TO_DB[input.gravidade],
          category: input.category ? CATEGORY_UI_TO_DB[input.category] : null,
          sector: input.setorOcorrencia ? SECTOR_UI_TO_DB[input.setorOcorrencia] : null,
          local: input.local ?? null,
          occurred_at: input.dataOcorrencia?.toISOString() ?? null,
          is_recurrent: input.reincidente ?? false,
          previous_nc_id: input.previousNcId ?? null,
          unit_id: input.unitId ?? null,
          indicator_id: input.indicatorId ?? null,
        })
        .select(NC_SELECT)
        .single();
      if (error) throw error;
      return mapRowToNC(data as unknown as NcDbRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ncKeys.lists() });
    },
  });
}

export interface UpdateNCInput {
  id: string;
  status?: NCStatus;
  swotForwarded?: boolean;
  responsibleId?: string;
}

export function useUpdateNC() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, swotForwarded, responsibleId }: UpdateNCInput) => {
      const patch: Record<string, unknown> = {};
      if (status) {
        const dbStatus = STATUS_UI_TO_DB[status];
        if (!dbStatus) throw new Error(`Status "${status}" não pode ser salvo diretamente.`);
        patch.status = dbStatus;
      }
      if (swotForwarded !== undefined) patch.swot_forwarded = swotForwarded;
      if (responsibleId !== undefined) patch.responsible_id = responsibleId;

      const { data, error } = await supabase
        .from("ncs")
        .update(patch)
        .eq("id", id)
        .select(NC_SELECT)
        .single();
      if (error) throw error;
      return mapRowToNC(data as unknown as NcDbRow);
    },
    onSuccess: (nc) => {
      queryClient.invalidateQueries({ queryKey: ncKeys.lists() });
      queryClient.setQueryData(ncKeys.detail(nc.id), nc);
    },
  });
}

export interface CancelNCInput {
  id: string;
  reason: string;
}

/** Cancelamento é soft delete — nada apaga (seção 2 do Guia de Arquitetura). */
export function useCancelNC() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: CancelNCInput) => {
      if (!reason.trim()) throw new Error("Motivo do cancelamento é obrigatório.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("ncs")
        .update({
          status: "cancelado" satisfies NCStatusDb,
          cancel_reason: reason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id ?? null,
        })
        .eq("id", id)
        .select(NC_SELECT)
        .single();
      if (error) throw error;
      return mapRowToNC(data as unknown as NcDbRow);
    },
    onSuccess: (nc) => {
      queryClient.invalidateQueries({ queryKey: ncKeys.lists() });
      queryClient.setQueryData(ncKeys.detail(nc.id), nc);
    },
  });
}
