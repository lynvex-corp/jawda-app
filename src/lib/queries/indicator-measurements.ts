import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { indicatorKeys, type IndicatorPolarityDb } from "@/lib/queries/indicators";

/* ============================================================
 * Medições
 * ============================================================ */

interface MeasurementDbRow {
  id: string;
  org_id: string;
  indicator_id: string;
  period_reference: string;
  value: number;
  observation: string | null;
  critical_analysis: string | null;
  evidence_files: string[];
  source: "manual" | "imported" | "derived";
  out_of_target: boolean;
  ai_suggested_analysis: boolean;
  created_at: string;
  author: { full_name: string } | null;
}

export interface Measurement {
  id: string;
  indicatorId: string;
  periodo: string;
  valor: number;
  observacao: string | null;
  analise: string | null;
  evidencias: string[];
  foraDaMeta: boolean;
  aiSuggested: boolean;
  criadoEm: string;
  autorNome: string;
}

const MEASUREMENT_SELECT = "*, author:profiles!created_by(full_name)";

function mapMeasurementRow(row: MeasurementDbRow): Measurement {
  return {
    id: row.id,
    indicatorId: row.indicator_id,
    periodo: row.period_reference,
    valor: row.value,
    observacao: row.observation,
    analise: row.critical_analysis,
    evidencias: row.evidence_files ?? [],
    foraDaMeta: row.out_of_target,
    aiSuggested: row.ai_suggested_analysis,
    criadoEm: row.created_at,
    autorNome: row.author?.full_name ?? "—",
  };
}

const measurementsKey = (indicatorId?: string) =>
  [...indicatorKeys.all, "measurements", indicatorId ?? "all"] as const;

/** Sem indicatorId, traz todas as medições da organização (RLS já limita o
 * escopo) — usado no painel pra montar sparkline/semáforo/contagem de
 * ciclos de todos os indicadores numa consulta só, evitando N+1. Com
 * indicatorId, filtra pra tela de detalhe. */
export function useIndicatorMeasurements(indicatorId?: string) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: measurementsKey(indicatorId),
    queryFn: async () => {
      let query = supabase
        .from("indicator_measurements")
        .select(MEASUREMENT_SELECT)
        .order("period_reference", { ascending: true });
      if (indicatorId) query = query.eq("indicator_id", indicatorId);
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as MeasurementDbRow[]).map(mapMeasurementRow);
    },
  });
}

export interface CreateMeasurementInput {
  indicatorId: string;
  periodo: string;
  valor: number;
  observacao?: string;
  analise?: string;
  aiSuggested?: boolean;
}

function invalidateMeasurements(
  queryClient: ReturnType<typeof useQueryClient>,
  indicatorId: string,
) {
  queryClient.invalidateQueries({ queryKey: [...indicatorKeys.all, "measurements"] });
  queryClient.invalidateQueries({ queryKey: indicatorKeys.detail(indicatorId) });
}

export function useCreateMeasurement() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMeasurementInput) => {
      const { data, error } = await supabase
        .from("indicator_measurements")
        .insert({
          indicator_id: input.indicatorId,
          period_reference: input.periodo,
          value: input.valor,
          observation: input.observacao ?? null,
          critical_analysis: input.analise ?? null,
          ai_suggested_analysis: input.aiSuggested ?? false,
        })
        .select(MEASUREMENT_SELECT)
        .single();
      if (error) throw error;
      return mapMeasurementRow(data as unknown as MeasurementDbRow);
    },
    onSuccess: (measurement) => invalidateMeasurements(queryClient, measurement.indicatorId),
  });
}

/** Lançamento em lote — um único insert com várias linhas (mais barato que
 * N chamadas separadas). Cada entrada segue as mesmas regras de banco
 * (out_of_target calculado por trigger, análise obrigatória se fora). */
export function useBulkMeasurements() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inputs: CreateMeasurementInput[]) => {
      const { data, error } = await supabase
        .from("indicator_measurements")
        .insert(
          inputs.map((input) => ({
            indicator_id: input.indicatorId,
            period_reference: input.periodo,
            value: input.valor,
            observation: input.observacao ?? null,
            critical_analysis: input.analise ?? null,
            ai_suggested_analysis: input.aiSuggested ?? false,
          })),
        )
        .select(MEASUREMENT_SELECT);
      if (error) throw error;
      return (data as unknown as MeasurementDbRow[]).map(mapMeasurementRow);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...indicatorKeys.all, "measurements"] }),
  });
}

/* ============================================================
 * Histórico de meta (gráfico com linha antiga/nova)
 * ============================================================ */

interface TargetHistoryDbRow {
  id: string;
  indicator_id: string;
  target_value: number;
  target_range_min: number | null;
  target_range_max: number | null;
  polarity: IndicatorPolarityDb;
  valid_from: string;
  valid_until: string | null;
}

export interface TargetHistoryEntry {
  id: string;
  meta: number;
  faixaMin: number | null;
  faixaMax: number | null;
  validoDe: string;
  validoAte: string | null;
}

export function useIndicatorTargetHistory(indicatorId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["indicator-target-history", indicatorId ?? ""],
    enabled: Boolean(indicatorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicator_target_history")
        .select("*")
        .eq("indicator_id", indicatorId)
        .order("valid_from", { ascending: true });
      if (error) throw error;
      return (data as unknown as TargetHistoryDbRow[]).map(
        (row): TargetHistoryEntry => ({
          id: row.id,
          meta: row.target_value,
          faixaMin: row.target_range_min,
          faixaMax: row.target_range_max,
          validoDe: row.valid_from,
          validoAte: row.valid_until,
        }),
      );
    },
  });
}

/* ============================================================
 * Trilha do indicador (activity_log filtrado por entity_code)
 * ============================================================ */

interface ActivityLogRow {
  id: string;
  action: string;
  entity_type: string;
  detail: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string } | null;
}

export interface IndicatorActivityEvent {
  id: string;
  acao: string;
  tipo: string;
  detalhe: Record<string, unknown> | null;
  data: string;
  autor: string;
}

const ACTIVITY_ACTION_LABEL: Record<string, string> = {
  criou: "Criado",
  atualizou: "Atualizado",
  arquivou: "Arquivado",
  meta_alterada: "Meta alterada",
  lancou_medicao: "Medição lançada",
  nc_gerada: "NC gerada",
};

/** Une eventos do indicador (criação/edição/meta) e das medições numa linha
 * do tempo só, buscando por entity_code — todo trigger deste módulo grava o
 * código do indicador ali, mesmo quando o entity_type é diferente
 * ('indicator' vs 'indicator_measurement'). Ver comentário em
 * log_nc_activity (20260730120200_indicators_triggers.sql). */
export function useIndicatorActivity(indicatorCode: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["indicator-activity", indicatorCode ?? ""],
    enabled: Boolean(indicatorCode),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action, entity_type, detail, created_at, actor:profiles!actor_id(full_name)")
        .eq("entity_code", indicatorCode)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as ActivityLogRow[]).map(
        (row): IndicatorActivityEvent => ({
          id: row.id,
          acao: ACTIVITY_ACTION_LABEL[row.action] ?? row.action,
          tipo: row.entity_type,
          detalhe: row.detail,
          data: row.created_at,
          autor: row.actor?.full_name ?? "—",
        }),
      );
    },
  });
}

/* ============================================================
 * NCs geradas a partir do indicador (chip bidirecional)
 * ============================================================ */

interface GeneratedNcRow {
  id: string;
  code: string;
  status: string;
  created_at: string;
}

export function useIndicatorGeneratedNcs(indicatorId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["indicator-generated-ncs", indicatorId ?? ""],
    enabled: Boolean(indicatorId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ncs")
        .select("id, code, status, created_at")
        .eq("indicator_id", indicatorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as GeneratedNcRow[];
    },
  });
}

/** Mesma consulta acima, mas em lote (várias indicator_id de uma vez) — usa
 * a aba Análise Crítica pra mostrar o chip de NC gerada nos indicadores em
 * atenção sem 1 query por linha (hook dentro de .map() quebraria a regra
 * dos hooks). */
export function useNcsByIndicatorIds(indicatorIds: string[]) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["ncs-by-indicator-ids", [...indicatorIds].sort()],
    enabled: indicatorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ncs")
        .select("id, code, status, created_at, indicator_id")
        .in("indicator_id", indicatorIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as (GeneratedNcRow & { indicator_id: string })[];
    },
  });
}

/* ============================================================
 * Análise crítica consolidada por período
 * ============================================================ */

interface CriticalAnalysisPeriodDbRow {
  id: string;
  period_label: string;
  start_date: string;
  end_date: string;
  overall_analysis: string | null;
  direction_decisions: string | null;
  ai_suggested_analysis: boolean;
  status: "draft" | "consolidated" | "exported";
  generated_at: string | null;
}

export interface CriticalAnalysisPeriod {
  id: string;
  periodo: string;
  inicio: string;
  fim: string;
  analiseGeral: string | null;
  decisoesDirecao: string | null;
  aiSuggested: boolean;
  status: "draft" | "consolidated" | "exported";
  geradoEm: string | null;
}

function mapAnalysisRow(row: CriticalAnalysisPeriodDbRow): CriticalAnalysisPeriod {
  return {
    id: row.id,
    periodo: row.period_label,
    inicio: row.start_date,
    fim: row.end_date,
    analiseGeral: row.overall_analysis,
    decisoesDirecao: row.direction_decisions,
    aiSuggested: row.ai_suggested_analysis,
    status: row.status,
    geradoEm: row.generated_at,
  };
}

const analysisKeys = { lists: () => ["critical-analysis-periods", "list"] as const };

export function useCriticalAnalysisPeriods() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: analysisKeys.lists(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("critical_analysis_periods")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data as unknown as CriticalAnalysisPeriodDbRow[]).map(mapAnalysisRow);
    },
  });
}

export interface GenerateConsolidationInput {
  periodo: string;
  inicio: string;
  fim: string;
  analiseGeral: string;
  decisoesDirecao?: string;
  aiSuggested?: boolean;
}

/** "Gerar consolidação" — upsert por (org_id, period_label): reabrir a
 * mesma consolidação de um período já existente atualiza em vez de duplicar. */
export function useGenerateConsolidation() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerateConsolidationInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("critical_analysis_periods")
        .upsert(
          {
            period_label: input.periodo,
            start_date: input.inicio,
            end_date: input.fim,
            overall_analysis: input.analiseGeral,
            direction_decisions: input.decisoesDirecao ?? null,
            ai_suggested_analysis: input.aiSuggested ?? false,
            status: "consolidated",
            generated_at: new Date().toISOString(),
            generated_by: user?.id ?? null,
          },
          { onConflict: "org_id,period_label" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return mapAnalysisRow(data as unknown as CriticalAnalysisPeriodDbRow);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: analysisKeys.lists() }),
  });
}
