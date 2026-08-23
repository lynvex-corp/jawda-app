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

/* ============================================================
 * Escopo do Sistema (ISO 9001 4.3)
 *
 * Documento versionado com um estado a mais que SWOT/Partes Interessadas:
 * rascunho → aguardando_aprovacao → vigente. Só o Administrador do Cliente
 * (papel que representa a Alta Direção na lista fixa de perfis) aprova.
 * Terminologia "Item Não Aplicável" em toda a UI — nunca "exclusão".
 * ============================================================ */

export type ScopeDocumentStatus = "rascunho" | "aguardando_aprovacao" | "vigente";

export interface ScopeNotApplicableItem {
  id: string;
  requirementDescription: string;
  justification: string;
  createdAt: string;
}

export interface ScopeDocument {
  id: string;
  status: ScopeDocumentStatus;
  declaracaoTexto: string;
  revisionNumber: number;
  approvedAt: string | null;
  approvedByName: string | null;
}

export interface ScopeDocumentWithItems {
  document: ScopeDocument;
  items: ScopeNotApplicableItem[];
}

const scopeKeys = {
  all: ["estrategia-scope"] as const,
  current: () => [...scopeKeys.all, "current"] as const,
  history: () => [...scopeKeys.all, "history"] as const,
};

const SCOPE_DOCUMENT_SELECT =
  "id, status, declaracao_texto, revision_number, approved_at, approved_by_profile:profiles!approved_by(full_name)";

interface ScopeDocumentRow {
  id: string;
  status: ScopeDocumentStatus;
  declaracao_texto: string;
  revision_number: number;
  approved_at: string | null;
  approved_by_profile: { full_name: string } | null;
}

function mapScopeDocument(row: ScopeDocumentRow): ScopeDocument {
  return {
    id: row.id,
    status: row.status,
    declaracaoTexto: row.declaracao_texto,
    revisionNumber: row.revision_number,
    approvedAt: row.approved_at,
    approvedByName: row.approved_by_profile?.full_name ?? null,
  };
}

interface ScopeItemRow {
  id: string;
  requirement_description: string;
  justification: string | null;
  created_at: string;
}

function mapScopeItem(row: ScopeItemRow): ScopeNotApplicableItem {
  return {
    id: row.id,
    requirementDescription: row.requirement_description,
    justification: row.justification ?? "",
    createdAt: row.created_at,
  };
}

/** Revisão em andamento (rascunho ou aguardando_aprovacao); se não houver
 * nenhuma, cai para a última vigente (somente leitura — "Nova revisão" pra
 * voltar a editar). `null` só quando a organização nunca teve nenhum
 * documento de escopo. */
export function useScopeCurrent() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: scopeKeys.current(),
    queryFn: async (): Promise<ScopeDocumentWithItems | null> => {
      const { data: open, error: openErr } = await supabase
        .from("scope_documents")
        .select(SCOPE_DOCUMENT_SELECT)
        .in("status", ["rascunho", "aguardando_aprovacao"])
        .maybeSingle();
      if (openErr) throw openErr;

      let row = open as unknown as ScopeDocumentRow | null;

      if (!row) {
        const { data: lastVigente, error: lastErr } = await supabase
          .from("scope_documents")
          .select(SCOPE_DOCUMENT_SELECT)
          .eq("status", "vigente")
          .order("revision_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastErr) throw lastErr;
        row = lastVigente as unknown as ScopeDocumentRow | null;
      }

      if (!row) return null;

      const { data: items, error: itemsErr } = await supabase
        .from("scope_not_applicable_items")
        .select("id, requirement_description, justification, created_at")
        .eq("scope_document_id", row.id)
        .order("created_at");
      if (itemsErr) throw itemsErr;

      return {
        document: mapScopeDocument(row),
        items: ((items as unknown as ScopeItemRow[]) ?? []).map(mapScopeItem),
      };
    },
  });
}

export function useScopeHistory() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: scopeKeys.history(),
    queryFn: async (): Promise<ScopeDocument[]> => {
      const { data, error } = await supabase
        .from("scope_documents")
        .select(SCOPE_DOCUMENT_SELECT)
        .eq("status", "vigente")
        .order("revision_number", { ascending: false });
      if (error) throw error;
      return (data as unknown as ScopeDocumentRow[]).map(mapScopeDocument);
    },
  });
}

export function useStartFirstScopeDraft() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ declaracaoTexto }: { declaracaoTexto: string }) => {
      const { error } = await supabase
        .from("scope_documents")
        .insert({ declaracao_texto: declaracaoTexto, revision_number: 1 });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scopeKeys.all }),
  });
}

export function useStartNewScopeRevision() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("start_new_scope_revision");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scopeKeys.all }),
  });
}

export function useUpdateScopeText() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, declaracaoTexto }: { id: string; declaracaoTexto: string }) => {
      const { error } = await supabase
        .from("scope_documents")
        .update({ declaracao_texto: declaracaoTexto })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scopeKeys.current() }),
  });
}

export function useSubmitScopeForApproval() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("submit_scope_for_approval", {
        p_scope_document_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scopeKeys.all }),
  });
}

export function useApproveScopeDocument() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("approve_scope_document", { p_scope_document_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scopeKeys.all }),
  });
}

export function useCreateScopeNotApplicableItem() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      scopeDocumentId,
      requirementDescription,
      justification,
    }: {
      scopeDocumentId: string;
      requirementDescription: string;
      justification: string;
    }) => {
      const { error } = await supabase.from("scope_not_applicable_items").insert({
        scope_document_id: scopeDocumentId,
        requirement_description: requirementDescription,
        justification: justification || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scopeKeys.current() }),
  });
}

export function useUpdateScopeItemJustification() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, justification }: { id: string; justification: string }) => {
      const { error } = await supabase
        .from("scope_not_applicable_items")
        .update({ justification })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scopeKeys.current() }),
  });
}

/* ============================================================
 * Riscos e Oportunidades (ISO 9001 6.1)
 * ============================================================ */

export type RiskType = "risco" | "oportunidade";
export type RiskArea =
  | "comercial"
  | "normativo"
  | "operacao"
  | "projeto"
  | "qualidade"
  | "rh"
  | "suprimentos"
  | "ti";
export type RiskDecision = "evitar" | "assumir" | "eliminar_fonte" | "compartilhar";

/** Alfabético por rótulo em português (seção 21.7 do Guia). */
export const RISK_AREA_OPTIONS: { value: RiskArea; label: string }[] = [
  { value: "comercial", label: "Comercial" },
  { value: "normativo", label: "Normativo" },
  { value: "operacao", label: "Operação" },
  { value: "projeto", label: "Projeto" },
  { value: "qualidade", label: "Qualidade" },
  { value: "rh", label: "RH" },
  { value: "suprimentos", label: "Suprimentos" },
  { value: "ti", label: "TI" },
];

export const RISK_DECISION_OPTIONS: { value: RiskDecision; label: string }[] = [
  { value: "assumir", label: "Assumir" },
  { value: "compartilhar", label: "Compartilhar" },
  { value: "eliminar_fonte", label: "Eliminar a fonte" },
  { value: "evitar", label: "Evitar" },
];

export interface RiskReassessment {
  id: string;
  probability: number;
  impact: number;
  reassessedAt: string;
}

export interface RiskOpportunity {
  id: string;
  code: string;
  type: RiskType;
  area: RiskArea;
  description: string;
  probability: number;
  impact: number;
  riskScore: number;
  actionDescription: string;
  decision: RiskDecision | null;
  originSwotCardId: string | null;
  generatedActionPlanId: string | null;
  generatedActionPlanCode: string | null;
  createdAt: string;
}

const riskKeys = {
  all: ["estrategia-risks"] as const,
  list: () => [...riskKeys.all, "list"] as const,
  reassessments: (riskId: string) => [...riskKeys.all, "reassessments", riskId] as const,
};

interface RiskOpportunityRow {
  id: string;
  code: string;
  type: RiskType;
  area: RiskArea;
  description: string;
  probability: number;
  impact: number;
  risk_score: number;
  action_description: string | null;
  decision: RiskDecision | null;
  origin_swot_card_id: string | null;
  generated_action_plan_id: string | null;
  created_at: string;
  generated_action_plan: { code: string } | null;
}

function mapRisk(row: RiskOpportunityRow): RiskOpportunity {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    area: row.area,
    description: row.description,
    probability: row.probability,
    impact: row.impact,
    riskScore: row.risk_score,
    actionDescription: row.action_description ?? "",
    decision: row.decision,
    originSwotCardId: row.origin_swot_card_id,
    generatedActionPlanId: row.generated_action_plan_id,
    generatedActionPlanCode: row.generated_action_plan?.code ?? null,
    createdAt: row.created_at,
  };
}

export function useRisksOpportunities() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: riskKeys.list(),
    queryFn: async (): Promise<RiskOpportunity[]> => {
      const { data, error } = await supabase
        .from("risks_opportunities")
        .select(
          "id, code, type, area, description, probability, impact, risk_score, action_description, decision, origin_swot_card_id, generated_action_plan_id, created_at, generated_action_plan:action_plans!generated_action_plan_id(code)",
        )
        .order("created_at");
      if (error) throw error;
      return ((data as unknown as RiskOpportunityRow[]) ?? []).map(mapRisk);
    },
  });
}

export function useCreateRiskOpportunity() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type: RiskType;
      area: RiskArea;
      description: string;
      probability: number;
      impact: number;
      actionDescription?: string;
      originSwotCardId?: string;
    }) => {
      const { data, error } = await supabase
        .from("risks_opportunities")
        .insert({
          type: input.type,
          area: input.area,
          description: input.description,
          probability: input.probability,
          impact: input.impact,
          action_description: input.actionDescription || null,
          origin_swot_card_id: input.originSwotCardId ?? null,
        })
        .select("id, code")
        .single();
      if (error) throw error;
      return data as { id: string; code: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: riskKeys.list() }),
  });
}

export function useUpdateRiskOpportunity() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{
        area: RiskArea;
        description: string;
        probability: number;
        impact: number;
        action_description: string;
        decision: RiskDecision;
      }>;
    }) => {
      const { error } = await supabase.from("risks_opportunities").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: riskKeys.list() }),
  });
}

/** Gancho Risco/Oportunidade → Plano de Ação, mesmo padrão de 2 passos de
 * useGenerateActionPlanFromSwotCard. */
export function useGenerateActionPlanFromRisk() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ riskId, description }: { riskId: string; description: string }) => {
      const { data: plan, error: planErr } = await supabase
        .from("action_plans")
        .insert({ origin_type: "risco_oportunidade", problem_description: description })
        .select("id, code")
        .single();
      if (planErr) throw planErr;

      const { error: riskErr } = await supabase
        .from("risks_opportunities")
        .update({ generated_action_plan_id: plan.id })
        .eq("id", riskId);
      if (riskErr) throw riskErr;

      return plan as { id: string; code: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: riskKeys.list() }),
  });
}

export function useReassessRisk() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      riskId,
      probability,
      impact,
    }: {
      riskId: string;
      probability: number;
      impact: number;
    }) => {
      const { error } = await supabase
        .from("risk_reassessments")
        .insert({ risk_id: riskId, probability, impact });
      if (error) throw error;
      const { error: updateErr } = await supabase
        .from("risks_opportunities")
        .update({ probability, impact })
        .eq("id", riskId);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: riskKeys.list() }),
  });
}

/* ============================================================
 * Mudanças e Melhoria (ISO 9001 6.3)
 * ============================================================ */

export type ChangeImprovementTipo = "mudanca" | "melhoria";
export type ChangeImprovementStatus =
  | "rascunho"
  | "aguardando_avaliacao"
  | "aguardando_aprovacao"
  | "aprovada"
  | "rejeitada";

export interface ChangeImprovement {
  id: string;
  tipo: ChangeImprovementTipo;
  descricao: string;
  proposito: string;
  dataInicio: string | null;
  status: ChangeImprovementStatus;
  consequenciasBool: boolean | null;
  consequenciasDetalhe: string;
  integridadeBool: boolean | null;
  integridadeDetalhe: string;
  recursoBool: boolean | null;
  recursoDetalhe: string;
  responsabilidadesBool: boolean | null;
  responsabilidadesDetalhe: string;
  avaliadoPorName: string | null;
  aprovadoPorName: string | null;
  createdAt: string;
}

const changeKeys = {
  all: ["estrategia-changes"] as const,
  list: () => [...changeKeys.all, "list"] as const,
};

const CHANGE_SELECT =
  "id, tipo, descricao, proposito, data_inicio, status, consequencias_bool, consequencias_detalhe, integridade_bool, integridade_detalhe, recurso_bool, recurso_detalhe, responsabilidades_bool, responsabilidades_detalhe, created_at, avaliado_por_profile:profiles!avaliado_por(full_name), aprovado_por_profile:profiles!aprovado_por(full_name)";

interface ChangeImprovementRow {
  id: string;
  tipo: ChangeImprovementTipo;
  descricao: string;
  proposito: string;
  data_inicio: string | null;
  status: ChangeImprovementStatus;
  consequencias_bool: boolean | null;
  consequencias_detalhe: string | null;
  integridade_bool: boolean | null;
  integridade_detalhe: string | null;
  recurso_bool: boolean | null;
  recurso_detalhe: string | null;
  responsabilidades_bool: boolean | null;
  responsabilidades_detalhe: string | null;
  created_at: string;
  avaliado_por_profile: { full_name: string } | null;
  aprovado_por_profile: { full_name: string } | null;
}

function mapChange(row: ChangeImprovementRow): ChangeImprovement {
  return {
    id: row.id,
    tipo: row.tipo,
    descricao: row.descricao,
    proposito: row.proposito,
    dataInicio: row.data_inicio,
    status: row.status,
    consequenciasBool: row.consequencias_bool,
    consequenciasDetalhe: row.consequencias_detalhe ?? "",
    integridadeBool: row.integridade_bool,
    integridadeDetalhe: row.integridade_detalhe ?? "",
    recursoBool: row.recurso_bool,
    recursoDetalhe: row.recurso_detalhe ?? "",
    responsabilidadesBool: row.responsabilidades_bool,
    responsabilidadesDetalhe: row.responsabilidades_detalhe ?? "",
    avaliadoPorName: row.avaliado_por_profile?.full_name ?? null,
    aprovadoPorName: row.aprovado_por_profile?.full_name ?? null,
    createdAt: row.created_at,
  };
}

export function useChangesImprovements() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: changeKeys.list(),
    queryFn: async (): Promise<ChangeImprovement[]> => {
      const { data, error } = await supabase
        .from("changes_improvements")
        .select(CHANGE_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as unknown as ChangeImprovementRow[]) ?? []).map(mapChange);
    },
  });
}

export function useCreateChangeImprovement() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tipo: ChangeImprovementTipo;
      descricao: string;
      proposito: string;
      dataInicio?: string;
    }) => {
      const { error } = await supabase.from("changes_improvements").insert({
        tipo: input.tipo,
        descricao: input.descricao,
        proposito: input.proposito,
        data_inicio: input.dataInicio || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: changeKeys.list() }),
  });
}

export function useSubmitChangeForEvaluation() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("submit_change_for_evaluation", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: changeKeys.list() }),
  });
}

export interface EvaluateChangeInput {
  id: string;
  consequenciasBool: boolean;
  consequenciasDetalhe: string;
  integridadeBool: boolean;
  integridadeDetalhe: string;
  recursoBool: boolean;
  recursoDetalhe: string;
  responsabilidadesBool: boolean;
  responsabilidadesDetalhe: string;
}

export function useEvaluateChangeImprovement() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EvaluateChangeInput) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("evaluate_change_improvement", {
        p_id: input.id,
        p_consequencias_bool: input.consequenciasBool,
        p_consequencias_detalhe: input.consequenciasDetalhe || null,
        p_integridade_bool: input.integridadeBool,
        p_integridade_detalhe: input.integridadeDetalhe || null,
        p_recurso_bool: input.recursoBool,
        p_recurso_detalhe: input.recursoDetalhe || null,
        p_responsabilidades_bool: input.responsabilidadesBool,
        p_responsabilidades_detalhe: input.responsabilidadesDetalhe || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: changeKeys.list() }),
  });
}

export function useDecideChangeImprovement() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("decide_change_improvement", {
        p_id: id,
        p_approve: approve,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: changeKeys.list() }),
  });
}
