import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { assertNotReadOnly } from "@/lib/org-access-guard";

/* ============================================================
 * Análise de Cenário (SWOT)
 *
 * Documento versionado (seção 21.5 do Guia): só existe UM rascunho aberto
 * por organização por vez (trava no banco, unique index parcial). "Nova
 * versão" e "Formalizar" são RPCs (supabase/migrations/
 * 20260823110200_estrategia_swot_triggers.sql), nunca UPDATE livre pelo
 * client — mesma filosofia de update_indicator_target.
 * ============================================================ */

export type SwotQuadrant = "forca" | "fraqueza" | "oportunidade" | "ameaca" | "nao_classificado";
export type SwotAnalysisStatus = "rascunho" | "formalizada";

export interface SwotCard {
  id: string;
  quadrant: SwotQuadrant;
  description: string;
  sourceNcId: string | null;
  sourceNcCode: string | null;
  generatedActionPlanId: string | null;
  generatedActionPlanCode: string | null;
  createdAt: string;
}

export interface SwotAnalysis {
  id: string;
  status: SwotAnalysisStatus;
  versionLabel: string | null;
  contextoInterno: string;
  contextoExterno: string;
  formalizedAt: string | null;
  formalizedByName: string | null;
}

export interface SwotAnalysisWithCards {
  analysis: SwotAnalysis;
  isDraft: boolean;
  cards: SwotCard[];
}

const swotKeys = {
  all: ["estrategia-swot"] as const,
  current: () => [...swotKeys.all, "current"] as const,
  history: () => [...swotKeys.all, "history"] as const,
};

const SWOT_ANALYSIS_SELECT =
  "id, status, version_label, contexto_interno, contexto_externo, formalized_at, formalized_by_profile:profiles!formalized_by(full_name)";

interface SwotAnalysisRow {
  id: string;
  status: SwotAnalysisStatus;
  version_label: string | null;
  contexto_interno: string | null;
  contexto_externo: string | null;
  formalized_at: string | null;
  formalized_by_profile: { full_name: string } | null;
}

function mapAnalysis(row: SwotAnalysisRow): SwotAnalysis {
  return {
    id: row.id,
    status: row.status,
    versionLabel: row.version_label,
    contextoInterno: row.contexto_interno ?? "",
    contextoExterno: row.contexto_externo ?? "",
    formalizedAt: row.formalized_at,
    formalizedByName: row.formalized_by_profile?.full_name ?? null,
  };
}

interface SwotCardRow {
  id: string;
  quadrant: SwotQuadrant;
  description: string;
  source_nc_id: string | null;
  generated_action_plan_id: string | null;
  created_at: string;
  source_nc: { code: string } | null;
  generated_action_plan: { code: string } | null;
}

function mapCard(row: SwotCardRow): SwotCard {
  return {
    id: row.id,
    quadrant: row.quadrant,
    description: row.description,
    sourceNcId: row.source_nc_id,
    sourceNcCode: row.source_nc?.code ?? null,
    generatedActionPlanId: row.generated_action_plan_id,
    generatedActionPlanCode: row.generated_action_plan?.code ?? null,
    createdAt: row.created_at,
  };
}

/** Rascunho atual da organização; se não houver nenhum, cai para a última
 * versão formalizada (somente leitura — precisa de "Nova versão" pra
 * editar de novo). `null` só quando a organização nunca teve nenhuma
 * análise (nem rascunho, nem formalizada). */
export function useSwotCurrent() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: swotKeys.current(),
    queryFn: async (): Promise<SwotAnalysisWithCards | null> => {
      const { data: draft, error: draftErr } = await supabase
        .from("swot_analyses")
        .select(SWOT_ANALYSIS_SELECT)
        .eq("status", "rascunho")
        .maybeSingle();
      if (draftErr) throw draftErr;

      let row = draft as unknown as SwotAnalysisRow | null;
      let isDraft = true;

      if (!row) {
        const { data: lastFormalized, error: lastErr } = await supabase
          .from("swot_analyses")
          .select(SWOT_ANALYSIS_SELECT)
          .eq("status", "formalizada")
          .order("formalized_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastErr) throw lastErr;
        row = lastFormalized as unknown as SwotAnalysisRow | null;
        isDraft = false;
      }

      if (!row) return null;

      const { data: cards, error: cardsErr } = await supabase
        .from("swot_cards")
        .select(
          "id, quadrant, description, source_nc_id, generated_action_plan_id, created_at, source_nc:ncs!source_nc_id(code), generated_action_plan:action_plans!generated_action_plan_id(code)",
        )
        .eq("swot_analysis_id", row.id)
        .order("created_at");
      if (cardsErr) throw cardsErr;

      return {
        analysis: mapAnalysis(row),
        isDraft,
        cards: ((cards as unknown as SwotCardRow[]) ?? []).map(mapCard),
      };
    },
  });
}

/** Histórico de versões formalizadas, mais recente primeiro. */
export function useSwotHistory() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: swotKeys.history(),
    queryFn: async (): Promise<SwotAnalysis[]> => {
      const { data, error } = await supabase
        .from("swot_analyses")
        .select(SWOT_ANALYSIS_SELECT)
        .eq("status", "formalizada")
        .order("formalized_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as SwotAnalysisRow[]).map(mapAnalysis);
    },
  });
}

/** Cria o primeiro rascunho da organização (só usado quando ainda não
 * existe nenhuma análise — nem rascunho, nem formalizada). Versões
 * seguintes nascem sempre pela RPC start_new_swot_version, que copia os
 * cards da última formalizada. */
export function useStartFirstSwotDraft() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("swot_analyses").insert({});
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: swotKeys.all }),
  });
}

export function useStartNewSwotVersion() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("start_new_swot_version");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: swotKeys.all }),
  });
}

export function useFormalizeSwotAnalysis() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      analysisId,
      versionLabel,
    }: {
      analysisId: string;
      versionLabel: string;
    }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("formalize_swot_analysis", {
        p_analysis_id: analysisId,
        p_version_label: versionLabel,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: swotKeys.all }),
  });
}

export function useUpdateSwotContext() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      analysisId,
      contextoInterno,
      contextoExterno,
    }: {
      analysisId: string;
      contextoInterno: string;
      contextoExterno: string;
    }) => {
      const { error } = await supabase
        .from("swot_analyses")
        .update({ contexto_interno: contextoInterno, contexto_externo: contextoExterno })
        .eq("id", analysisId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: swotKeys.current() }),
  });
}

export function useCreateSwotCard() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      analysisId,
      quadrant,
      description,
    }: {
      analysisId: string;
      quadrant: SwotQuadrant;
      description: string;
    }) => {
      const { error } = await supabase
        .from("swot_cards")
        .insert({ swot_analysis_id: analysisId, quadrant, description });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: swotKeys.current() }),
  });
}

export function useUpdateSwotCard() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      const { error } = await supabase.from("swot_cards").update({ description }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: swotKeys.current() }),
  });
}

export function useMoveSwotCard() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quadrant }: { id: string; quadrant: SwotQuadrant }) => {
      const { error } = await supabase.from("swot_cards").update({ quadrant }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: swotKeys.current() }),
  });
}

/** Gancho SWOT → Plano de Ação (seção 21.4 do Guia): 2 passos, mesmo padrão
 * de audit_findings em src/lib/queries/audits.ts — cria o plano, depois
 * aponta o card pra ele. O trigger de swot_cards já registra
 * "gerou_plano_de_acao" na trilha quando o UPDATE acontece. */
export function useGenerateActionPlanFromSwotCard() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cardId, description }: { cardId: string; description: string }) => {
      const { data: plan, error: planErr } = await supabase
        .from("action_plans")
        .insert({ origin_type: "estrategia", problem_description: description })
        .select("id, code")
        .single();
      if (planErr) throw planErr;

      const { error: cardErr } = await supabase
        .from("swot_cards")
        .update({ generated_action_plan_id: plan.id })
        .eq("id", cardId);
      if (cardErr) throw cardErr;

      return plan as { id: string; code: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: swotKeys.current() }),
  });
}

/** Plano de ação avulso a partir de uma recomendação cruzada da IA (não
 * está preso a um card específico — combina dois ou mais quadrantes). Sem
 * gancho bidirecional porque não há uma única entidade de origem para
 * apontar de volta (seção 21.4 do Guia: o gancho existe quando há UM
 * registro de origem; aqui a origem é a análise como um todo). */
export function useCreateStrategyActionPlan() {
  const supabase = getSupabaseBrowserClient();
  return useMutation({
    mutationFn: async ({ description }: { description: string }) => {
      const { data, error } = await supabase
        .from("action_plans")
        .insert({ origin_type: "estrategia", problem_description: description })
        .select("id, code")
        .single();
      if (error) throw error;
      return data as { id: string; code: string };
    },
  });
}

/* ============================================================
 * Partes Interessadas (ISO 9001 4.2)
 *
 * Mesmo padrão de documento versionado do SWOT. Mapa de influência ×
 * interesse do protótipo fica fora da v1 (v2.0, conforme prompt desta
 * aba) — só nome/requisitos/expectativas persistem.
 * ============================================================ */

export type StakeholderAnalysisStatus = "rascunho" | "formalizada";

export interface Stakeholder {
  id: string;
  nome: string;
  requisitos: string;
  expectativas: string;
  createdAt: string;
}

export interface StakeholderAnalysis {
  id: string;
  status: StakeholderAnalysisStatus;
  versionLabel: string | null;
  formalizedAt: string | null;
  formalizedByName: string | null;
}

export interface StakeholderAnalysisWithRows {
  analysis: StakeholderAnalysis;
  isDraft: boolean;
  stakeholders: Stakeholder[];
}

const stakeholderKeys = {
  all: ["estrategia-stakeholders"] as const,
  current: () => [...stakeholderKeys.all, "current"] as const,
  history: () => [...stakeholderKeys.all, "history"] as const,
};

const STAKEHOLDER_ANALYSIS_SELECT =
  "id, status, version_label, formalized_at, formalized_by_profile:profiles!formalized_by(full_name)";

interface StakeholderAnalysisRow {
  id: string;
  status: StakeholderAnalysisStatus;
  version_label: string | null;
  formalized_at: string | null;
  formalized_by_profile: { full_name: string } | null;
}

function mapStakeholderAnalysis(row: StakeholderAnalysisRow): StakeholderAnalysis {
  return {
    id: row.id,
    status: row.status,
    versionLabel: row.version_label,
    formalizedAt: row.formalized_at,
    formalizedByName: row.formalized_by_profile?.full_name ?? null,
  };
}

interface StakeholderRow {
  id: string;
  nome: string;
  requisitos: string | null;
  expectativas: string | null;
  created_at: string;
}

function mapStakeholder(row: StakeholderRow): Stakeholder {
  return {
    id: row.id,
    nome: row.nome,
    requisitos: row.requisitos ?? "",
    expectativas: row.expectativas ?? "",
    createdAt: row.created_at,
  };
}

export function useStakeholderCurrent() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: stakeholderKeys.current(),
    queryFn: async (): Promise<StakeholderAnalysisWithRows | null> => {
      const { data: draft, error: draftErr } = await supabase
        .from("stakeholder_analyses")
        .select(STAKEHOLDER_ANALYSIS_SELECT)
        .eq("status", "rascunho")
        .maybeSingle();
      if (draftErr) throw draftErr;

      let row = draft as unknown as StakeholderAnalysisRow | null;
      let isDraft = true;

      if (!row) {
        const { data: lastFormalized, error: lastErr } = await supabase
          .from("stakeholder_analyses")
          .select(STAKEHOLDER_ANALYSIS_SELECT)
          .eq("status", "formalizada")
          .order("formalized_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastErr) throw lastErr;
        row = lastFormalized as unknown as StakeholderAnalysisRow | null;
        isDraft = false;
      }

      if (!row) return null;

      const { data: stakeholders, error: rowsErr } = await supabase
        .from("stakeholders")
        .select("id, nome, requisitos, expectativas, created_at")
        .eq("stakeholder_analysis_id", row.id)
        .order("created_at");
      if (rowsErr) throw rowsErr;

      return {
        analysis: mapStakeholderAnalysis(row),
        isDraft,
        stakeholders: ((stakeholders as unknown as StakeholderRow[]) ?? []).map(mapStakeholder),
      };
    },
  });
}

export function useStakeholderHistory() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: stakeholderKeys.history(),
    queryFn: async (): Promise<StakeholderAnalysis[]> => {
      const { data, error } = await supabase
        .from("stakeholder_analyses")
        .select(STAKEHOLDER_ANALYSIS_SELECT)
        .eq("status", "formalizada")
        .order("formalized_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as StakeholderAnalysisRow[]).map(mapStakeholderAnalysis);
    },
  });
}

export function useStartFirstStakeholderDraft() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stakeholder_analyses").insert({});
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stakeholderKeys.all }),
  });
}

export function useStartNewStakeholderVersion() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("start_new_stakeholder_version");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stakeholderKeys.all }),
  });
}

export function useFormalizeStakeholderAnalysis() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      analysisId,
      versionLabel,
    }: {
      analysisId: string;
      versionLabel: string;
    }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("formalize_stakeholder_analysis", {
        p_analysis_id: analysisId,
        p_version_label: versionLabel,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stakeholderKeys.all }),
  });
}

export function useCreateStakeholder() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      analysisId,
      nome,
      requisitos,
      expectativas,
    }: {
      analysisId: string;
      nome: string;
      requisitos: string;
      expectativas: string;
    }) => {
      const { error } = await supabase
        .from("stakeholders")
        .insert({ stakeholder_analysis_id: analysisId, nome, requisitos, expectativas });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stakeholderKeys.current() }),
  });
}

export function useUpdateStakeholder() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{ nome: string; requisitos: string; expectativas: string }>;
    }) => {
      const { error } = await supabase.from("stakeholders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stakeholderKeys.current() }),
  });
}
