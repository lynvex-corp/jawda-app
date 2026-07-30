import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { type FonteDados, type Polaridade } from "@/lib/kpi-data";

/* ============================================================
 * Tipos do banco (enums exatamente como gravados)
 * ============================================================ */

export type IndicatorSourceDb = "manual" | "derived" | "imported";
export type IndicatorPolarityDb = "higher_is_better" | "lower_is_better" | "target_range";
export type IndicatorStatusDb = "active" | "archived";

/** As 7 frequências do banco já batem 1:1 com os rótulos em português do
 * seletor (frequenciasKpi em kpi-data.ts), na mesma ordem. */
export const FREQUENCY_DB_TO_UI = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
} as const;
export type IndicatorFrequencyDb = keyof typeof FREQUENCY_DB_TO_UI;
const FREQUENCY_UI_TO_DB = Object.fromEntries(
  Object.entries(FREQUENCY_DB_TO_UI).map(([db, ui]) => [ui, db]),
) as Record<string, IndicatorFrequencyDb>;

const SOURCE_DB_TO_UI: Record<IndicatorSourceDb, FonteDados> = {
  manual: "manual",
  derived: "derivado",
  imported: "importado",
};
const SOURCE_UI_TO_DB: Record<FonteDados, IndicatorSourceDb> = {
  manual: "manual",
  derivado: "derived",
  importado: "imported",
};

const POLARITY_DB_TO_UI: Record<IndicatorPolarityDb, Polaridade> = {
  higher_is_better: "maior_melhor",
  lower_is_better: "menor_melhor",
  target_range: "faixa_ideal",
};
export const POLARITY_UI_TO_DB: Record<Polaridade, IndicatorPolarityDb> = {
  maior_melhor: "higher_is_better",
  menor_melhor: "lower_is_better",
  faixa_ideal: "target_range",
};

/* ============================================================
 * Objetivos da qualidade
 * ============================================================ */

interface QualityObjectiveDbRow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  coherence_with_policy: string;
  deadline: string | null;
  responsible_id: string | null;
  status: IndicatorStatusDb;
  created_at: string;
  responsible: { full_name: string } | null;
}

export interface QualityObjective {
  id: string;
  nome: string;
  descricao: string;
  justificativa: string;
  prazo: string | null;
  responsavelId: string | null;
  responsavelNome: string;
  status: IndicatorStatusDb;
  arquivado: boolean;
  createdAt: string;
}

const OBJECTIVE_SELECT = "*, responsible:profiles!responsible_id(full_name)";

function mapObjectiveRow(row: QualityObjectiveDbRow): QualityObjective {
  return {
    id: row.id,
    nome: row.name,
    descricao: row.description ?? "",
    justificativa: row.coherence_with_policy,
    prazo: row.deadline,
    responsavelId: row.responsible_id,
    responsavelNome: row.responsible?.full_name ?? "Sem responsável",
    status: row.status,
    arquivado: row.status === "archived",
    createdAt: row.created_at,
  };
}

export const objectiveKeys = {
  all: ["quality-objectives"] as const,
  lists: () => [...objectiveKeys.all, "list"] as const,
};

export function useQualityObjectives() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: objectiveKeys.lists(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quality_objectives")
        .select(OBJECTIVE_SELECT)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as QualityObjectiveDbRow[]).map(mapObjectiveRow);
    },
  });
}

export interface CreateObjectiveInput {
  nome: string;
  descricao?: string;
  justificativa: string;
  prazo?: string | null;
  responsavelId?: string | null;
}

export function useCreateObjective() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateObjectiveInput) => {
      const { data, error } = await supabase
        .from("quality_objectives")
        .insert({
          name: input.nome,
          description: input.descricao ?? null,
          coherence_with_policy: input.justificativa,
          deadline: input.prazo ?? null,
          responsible_id: input.responsavelId ?? null,
        })
        .select(OBJECTIVE_SELECT)
        .single();
      if (error) throw error;
      return mapObjectiveRow(data as unknown as QualityObjectiveDbRow);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: objectiveKeys.lists() }),
  });
}

export interface UpdateObjectiveInput {
  id: string;
  nome?: string;
  descricao?: string;
  justificativa?: string;
  prazo?: string | null;
  responsavelId?: string | null;
}

export function useUpdateObjective() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      nome,
      descricao,
      justificativa,
      prazo,
      responsavelId,
    }: UpdateObjectiveInput) => {
      const patch: Record<string, unknown> = {};
      if (nome !== undefined) patch.name = nome;
      if (descricao !== undefined) patch.description = descricao;
      if (justificativa !== undefined) patch.coherence_with_policy = justificativa;
      if (prazo !== undefined) patch.deadline = prazo;
      if (responsavelId !== undefined) patch.responsible_id = responsavelId;
      const { data, error } = await supabase
        .from("quality_objectives")
        .update(patch)
        .eq("id", id)
        .select(OBJECTIVE_SELECT)
        .single();
      if (error) throw error;
      return mapObjectiveRow(data as unknown as QualityObjectiveDbRow);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: objectiveKeys.lists() }),
  });
}

export function useArchiveObjective() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quality_objectives")
        .update({ status: "archived" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: objectiveKeys.lists() }),
  });
}

/* ============================================================
 * Indicadores
 * ============================================================ */

interface IndicatorDbRow {
  id: string;
  org_id: string;
  code: string;
  name: string;
  description: string | null;
  quality_objective_id: string;
  process: string | null;
  source: IndicatorSourceDb;
  derived_source: string | null;
  formula: string;
  unit: string;
  frequency: IndicatorFrequencyDb;
  target_value: number;
  polarity: IndicatorPolarityDb;
  target_range_min: number | null;
  target_range_max: number | null;
  tolerance_percentage: number;
  auto_nc_after_cycles: number;
  responsible_measurement_id: string;
  responsible_analysis_id: string;
  status: IndicatorStatusDb;
  created_at: string;
  quality_objective: { name: string } | null;
  responsible_measurement: { full_name: string } | null;
  responsible_analysis: { full_name: string } | null;
}

export interface Indicator {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  objetivoId: string;
  objetivoNome: string;
  processo: string | null;
  fonte: FonteDados;
  derivadoDe: string | null;
  formula: string;
  unidade: string;
  frequencia: string;
  meta: number;
  faixaMin: number | null;
  faixaMax: number | null;
  polaridade: Polaridade;
  toleranciaPct: number;
  ciclosParaDisparo: number;
  responsavelMedicaoId: string;
  responsavelMedicaoNome: string;
  responsavelAnaliseId: string;
  responsavelAnaliseNome: string;
  status: IndicatorStatusDb;
  arquivado: boolean;
  createdAt: string;
}

const INDICATOR_SELECT =
  "*, quality_objective:quality_objectives!quality_objective_id(name), " +
  "responsible_measurement:profiles!responsible_measurement_id(full_name), " +
  "responsible_analysis:profiles!responsible_analysis_id(full_name)";

function mapIndicatorRow(row: IndicatorDbRow): Indicator {
  return {
    id: row.id,
    codigo: row.code,
    nome: row.name,
    descricao: row.description ?? "",
    objetivoId: row.quality_objective_id,
    objetivoNome: row.quality_objective?.name ?? "Sem objetivo",
    processo: row.process,
    fonte: SOURCE_DB_TO_UI[row.source],
    derivadoDe: row.derived_source,
    formula: row.formula,
    unidade: row.unit,
    frequencia: FREQUENCY_DB_TO_UI[row.frequency],
    meta: row.target_value,
    faixaMin: row.target_range_min,
    faixaMax: row.target_range_max,
    polaridade: POLARITY_DB_TO_UI[row.polarity],
    toleranciaPct: row.tolerance_percentage,
    ciclosParaDisparo: row.auto_nc_after_cycles,
    responsavelMedicaoId: row.responsible_measurement_id,
    responsavelMedicaoNome: row.responsible_measurement?.full_name ?? "—",
    responsavelAnaliseId: row.responsible_analysis_id,
    responsavelAnaliseNome: row.responsible_analysis?.full_name ?? "—",
    status: row.status,
    arquivado: row.status === "archived",
    createdAt: row.created_at,
  };
}

export const indicatorKeys = {
  all: ["indicators"] as const,
  lists: () => [...indicatorKeys.all, "list"] as const,
  list: (filters: IndicatorListFilters) => [...indicatorKeys.lists(), filters] as const,
  detail: (id: string) => [...indicatorKeys.all, "detail", id] as const,
};

export interface IndicatorListFilters {
  status?: IndicatorStatusDb;
}

export function useIndicators(filters: IndicatorListFilters = {}) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: indicatorKeys.list(filters),
    queryFn: async () => {
      let query = supabase
        .from("indicators")
        .select(INDICATOR_SELECT)
        .order("created_at", { ascending: false });
      if (filters.status) query = query.eq("status", filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as IndicatorDbRow[]).map(mapIndicatorRow);
    },
  });
}

export function useIndicator(id: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: indicatorKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicators")
        .select(INDICATOR_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return mapIndicatorRow(data as unknown as IndicatorDbRow);
    },
  });
}

export interface CreateIndicatorInput {
  nome: string;
  descricao?: string;
  objetivoId: string;
  processo?: string;
  fonte: FonteDados;
  derivadoDe?: string;
  formula: string;
  unidade: string;
  frequencia: string;
  meta: number;
  faixaMin?: number;
  faixaMax?: number;
  polaridade: Polaridade;
  toleranciaPct: number;
  ciclosParaDisparo: number;
  responsavelMedicaoId: string;
  responsavelAnaliseId: string;
}

export function useCreateIndicator() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateIndicatorInput) => {
      const { data, error } = await supabase
        .from("indicators")
        .insert({
          name: input.nome,
          description: input.descricao ?? null,
          quality_objective_id: input.objetivoId,
          process: input.processo ?? null,
          source: SOURCE_UI_TO_DB[input.fonte],
          derived_source: input.fonte === "derivado" ? (input.derivadoDe ?? null) : null,
          formula: input.formula,
          unit: input.unidade,
          frequency: FREQUENCY_UI_TO_DB[input.frequencia] ?? "monthly",
          target_value: input.meta,
          polarity: POLARITY_UI_TO_DB[input.polaridade],
          target_range_min: input.polaridade === "faixa_ideal" ? (input.faixaMin ?? null) : null,
          target_range_max: input.polaridade === "faixa_ideal" ? (input.faixaMax ?? null) : null,
          tolerance_percentage: input.toleranciaPct,
          auto_nc_after_cycles: input.ciclosParaDisparo,
          responsible_measurement_id: input.responsavelMedicaoId,
          responsible_analysis_id: input.responsavelAnaliseId,
        })
        .select(INDICATOR_SELECT)
        .single();
      if (error) throw error;
      return mapIndicatorRow(data as unknown as IndicatorDbRow);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: indicatorKeys.lists() }),
  });
}

export interface UpdateIndicatorInput {
  id: string;
  nome?: string;
  descricao?: string;
  processo?: string;
  formula?: string;
  unidade?: string;
  frequencia?: string;
  toleranciaPct?: number;
  ciclosParaDisparo?: number;
  responsavelMedicaoId?: string;
  responsavelAnaliseId?: string;
}

/** Edição de campos de configuração. Meta/polaridade NÃO passam por aqui —
 * mudam via useUpdateIndicatorTarget, que preserva histórico. */
export function useUpdateIndicator() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: UpdateIndicatorInput) => {
      const patch: Record<string, unknown> = {};
      if (rest.nome !== undefined) patch.name = rest.nome;
      if (rest.descricao !== undefined) patch.description = rest.descricao;
      if (rest.processo !== undefined) patch.process = rest.processo;
      if (rest.formula !== undefined) patch.formula = rest.formula;
      if (rest.unidade !== undefined) patch.unit = rest.unidade;
      if (rest.frequencia !== undefined) patch.frequency = FREQUENCY_UI_TO_DB[rest.frequencia];
      if (rest.toleranciaPct !== undefined) patch.tolerance_percentage = rest.toleranciaPct;
      if (rest.ciclosParaDisparo !== undefined) patch.auto_nc_after_cycles = rest.ciclosParaDisparo;
      if (rest.responsavelMedicaoId !== undefined)
        patch.responsible_measurement_id = rest.responsavelMedicaoId;
      if (rest.responsavelAnaliseId !== undefined)
        patch.responsible_analysis_id = rest.responsavelAnaliseId;

      const { data, error } = await supabase
        .from("indicators")
        .update(patch)
        .eq("id", id)
        .select(INDICATOR_SELECT)
        .single();
      if (error) throw error;
      return mapIndicatorRow(data as unknown as IndicatorDbRow);
    },
    onSuccess: (indicator) => {
      queryClient.invalidateQueries({ queryKey: indicatorKeys.lists() });
      queryClient.setQueryData(indicatorKeys.detail(indicator.id), indicator);
    },
  });
}

export function useArchiveIndicator() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("indicators")
        .update({ status: "archived" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: indicatorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: indicatorKeys.detail(id) });
    },
  });
}

export interface UpdateIndicatorTargetInput {
  indicatorId: string;
  meta: number;
  polaridade: Polaridade;
  faixaMin?: number;
  faixaMax?: number;
}

/** Troca de meta preservando histórico — via RPC (update_indicator_target),
 * que fecha a linha vigente de indicator_target_history e abre uma nova
 * numa transação só, atomicamente (ver 20260730120200_indicators_triggers.sql). */
export function useUpdateIndicatorTarget() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateIndicatorTargetInput) => {
      const { data, error } = await supabase.rpc("update_indicator_target", {
        p_indicator_id: input.indicatorId,
        p_target_value: input.meta,
        p_polarity: POLARITY_UI_TO_DB[input.polaridade],
        p_target_range_min: input.polaridade === "faixa_ideal" ? (input.faixaMin ?? null) : null,
        p_target_range_max: input.polaridade === "faixa_ideal" ? (input.faixaMax ?? null) : null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: indicatorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: indicatorKeys.detail(vars.indicatorId) });
      queryClient.invalidateQueries({ queryKey: ["indicator-target-history", vars.indicatorId] });
    },
  });
}
