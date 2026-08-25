import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type SupplierCategory = "material" | "servico";
export type EvaluationPeriodicity = "anual" | "semestral" | "trimestral";

/** Lista fechada de 10 critérios de qualificação — ordem alfabética por
 * rótulo, confirmada pelo usuário porque o documento de origem
 * ("pacote consolidado de prompts") não está neste repositório. Não
 * editar sem confirmar de novo — vira CHECK constraint no banco
 * (20260825120000_fornecedores_tables.sql). */
export type QualificationCriterion =
  | "atendimento_normas_sso"
  | "atendimento_prazo_acordado"
  | "capacidade_produtiva"
  | "certificacoes_produto_servico"
  | "licencas_sanitarias_ambientais"
  | "permissao_acesso_instalacoes"
  | "regularidade_fiscal_trabalhista_previdenciaria"
  | "responsabilidade_qualificacao_tecnica"
  | "sistema_gestao"
  | "situacao_cadastral_ativa";

export const QUALIFICATION_CRITERION_OPTIONS: { value: QualificationCriterion; label: string }[] = [
  {
    value: "atendimento_normas_sso",
    label: "Atendimento às normas de Saúde e Segurança Ocupacional",
  },
  { value: "atendimento_prazo_acordado", label: "Atendimento ao prazo acordado" },
  { value: "capacidade_produtiva", label: "Capacidade Produtiva" },
  { value: "certificacoes_produto_servico", label: "Certificações de produto ou serviço" },
  {
    value: "licencas_sanitarias_ambientais",
    label: "Licenças sanitárias e ambientais aplicáveis à atividade",
  },
  { value: "permissao_acesso_instalacoes", label: "Permissão de acesso às instalações" },
  {
    value: "regularidade_fiscal_trabalhista_previdenciaria",
    label: "Regularidade fiscal, trabalhista e previdenciária",
  },
  {
    value: "responsabilidade_qualificacao_tecnica",
    label: "Responsabilidade e qualificação técnica",
  },
  { value: "sistema_gestao", label: "Sistema de gestão" },
  { value: "situacao_cadastral_ativa", label: "Situação cadastral ativa" },
];

const PERIODICITY_MONTHS: Record<EvaluationPeriodicity, number> = {
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Ordem alfabética (seção 21.7). */
export const EVALUATION_PERIODICITY_OPTIONS: { value: EvaluationPeriodicity; label: string }[] = [
  { value: "anual", label: "Anual" },
  { value: "semestral", label: "Semestral" },
  { value: "trimestral", label: "Trimestral" },
];

export interface Supplier {
  id: string;
  nomeFantasia: string;
  ramo: string | null;
  nomeRepresentante: string | null;
  contato: string | null;
  email: string | null;
  cnpj: string | null;
  descricaoFornecimento: string | null;
  categoria: SupplierCategory;
  createdAt: string;
}

export interface QualificationCriterionEntry {
  id: string;
  supplierId: string;
  criterion: QualificationCriterion;
  attachmentUrl: string | null;
  observation: string | null;
  createdAt: string;
}

export interface EvaluationParameters {
  id: string;
  supplierId: string | null;
  minimumApprovalScore: number;
  periodicity: EvaluationPeriodicity;
}

export interface SupplierEvaluation {
  id: string;
  supplierId: string;
  evaluationNumber: number;
  qualityScore: number;
  deadlineScore: number;
  serviceScore: number;
  legalRequirementsScore: number;
  overallScore: number;
  feedbackMessage: string | null;
  feedbackSentAt: string | null;
  createdAt: string;
}

/** Fornecedor com os campos derivados client-side — "Pendência é
 * calculada, não armazenada" (regra explícita do prompt). */
export interface SupplierWithStatus extends Supplier {
  criteriaCount: number;
  missingCriteria: QualificationCriterion[];
  lastEvaluation: SupplierEvaluation | null;
  applicableParameters: EvaluationParameters | null;
  isEvaluationOverdue: boolean;
  isPending: boolean;
  lastTwoBelowMinimum: boolean;
}

const fornecedoresKeys = {
  suppliers: ["suppliers"] as const,
  criteria: (supplierId: string) => ["supplier-criteria", supplierId] as const,
  allCriteria: ["supplier-criteria", "all"] as const,
  parameters: ["supplier-evaluation-parameters"] as const,
  evaluations: (supplierId: string) => ["supplier-evaluations", supplierId] as const,
  allEvaluations: ["supplier-evaluations", "all"] as const,
};

interface SupplierRow {
  id: string;
  nome_fantasia: string;
  ramo: string | null;
  nome_representante: string | null;
  contato: string | null;
  email: string | null;
  cnpj: string | null;
  descricao_fornecimento: string | null;
  categoria: SupplierCategory;
  created_at: string;
}

function mapSupplier(r: SupplierRow): Supplier {
  return {
    id: r.id,
    nomeFantasia: r.nome_fantasia,
    ramo: r.ramo,
    nomeRepresentante: r.nome_representante,
    contato: r.contato,
    email: r.email,
    cnpj: r.cnpj,
    descricaoFornecimento: r.descricao_fornecimento,
    categoria: r.categoria,
    createdAt: r.created_at,
  };
}

/** Lista de fornecedores já com pendência, última avaliação e alerta de
 * "2 avaliações seguidas abaixo da média" calculados no cliente — busca os
 * 4 conjuntos de dados e faz o join em memória (volume baixo, um único
 * fornecedor tem no máximo 10 critérios e um punhado de avaliações). */
export function useSuppliers() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: fornecedoresKeys.suppliers,
    queryFn: async (): Promise<SupplierWithStatus[]> => {
      const [suppliersRes, criteriaRes, paramsRes, evaluationsRes] = await Promise.all([
        supabase.from("suppliers").select("*").order("nome_fantasia"),
        supabase.from("supplier_qualification_criteria").select("supplier_id, criterion"),
        supabase
          .from("supplier_evaluation_parameters")
          .select("id, supplier_id, minimum_approval_score, periodicity"),
        supabase
          .from("supplier_evaluations")
          .select(
            "id, supplier_id, evaluation_number, quality_score, deadline_score, service_score, " +
              "legal_requirements_score, overall_score, feedback_message, feedback_sent_at, created_at",
          )
          .order("evaluation_number", { ascending: false }),
      ]);
      if (suppliersRes.error) throw suppliersRes.error;
      if (criteriaRes.error) throw criteriaRes.error;
      if (paramsRes.error) throw paramsRes.error;
      if (evaluationsRes.error) throw evaluationsRes.error;

      const suppliers = (suppliersRes.data as unknown as SupplierRow[]).map(mapSupplier);
      const criteriaBySupplier = new Map<string, QualificationCriterion[]>();
      for (const c of criteriaRes.data as unknown as {
        supplier_id: string;
        criterion: QualificationCriterion;
      }[]) {
        const list = criteriaBySupplier.get(c.supplier_id) ?? [];
        list.push(c.criterion);
        criteriaBySupplier.set(c.supplier_id, list);
      }

      const params = paramsRes.data as unknown as {
        id: string;
        supplier_id: string | null;
        minimum_approval_score: number;
        periodicity: EvaluationPeriodicity;
      }[];
      const orgDefaultParams = params.find((p) => p.supplier_id === null) ?? null;
      const paramsBySupplier = new Map(
        params.filter((p) => p.supplier_id).map((p) => [p.supplier_id as string, p]),
      );

      const evalRows = evaluationsRes.data as unknown as {
        id: string;
        supplier_id: string;
        evaluation_number: number;
        quality_score: number;
        deadline_score: number;
        service_score: number;
        legal_requirements_score: number;
        overall_score: number;
        feedback_message: string | null;
        feedback_sent_at: string | null;
        created_at: string;
      }[];
      const evaluationsBySupplier = new Map<string, typeof evalRows>();
      for (const e of evalRows) {
        const list = evaluationsBySupplier.get(e.supplier_id) ?? [];
        list.push(e);
        evaluationsBySupplier.set(e.supplier_id, list);
      }

      const allCriteria = QUALIFICATION_CRITERION_OPTIONS.map((o) => o.value);

      return suppliers.map((s): SupplierWithStatus => {
        const registered = criteriaBySupplier.get(s.id) ?? [];
        const missingCriteria = allCriteria.filter((c) => !registered.includes(c));
        const rawParam = paramsBySupplier.get(s.id) ?? orgDefaultParams;
        const applicableParameters: EvaluationParameters | null = rawParam
          ? {
              id: rawParam.id,
              supplierId: rawParam.supplier_id,
              minimumApprovalScore: rawParam.minimum_approval_score,
              periodicity: rawParam.periodicity,
            }
          : null;

        const evals = (evaluationsBySupplier.get(s.id) ?? []).sort(
          (a, b) => b.evaluation_number - a.evaluation_number,
        );
        const last = evals[0]
          ? {
              id: evals[0].id,
              supplierId: evals[0].supplier_id,
              evaluationNumber: evals[0].evaluation_number,
              qualityScore: evals[0].quality_score,
              deadlineScore: evals[0].deadline_score,
              serviceScore: evals[0].service_score,
              legalRequirementsScore: evals[0].legal_requirements_score,
              overallScore: evals[0].overall_score,
              feedbackMessage: evals[0].feedback_message,
              feedbackSentAt: evals[0].feedback_sent_at,
              createdAt: evals[0].created_at,
            }
          : null;

        let isEvaluationOverdue = false;
        if (applicableParameters && last) {
          const months = PERIODICITY_MONTHS[applicableParameters.periodicity];
          const dueDate = new Date(last.createdAt);
          dueDate.setMonth(dueDate.getMonth() + months);
          isEvaluationOverdue = dueDate.getTime() < Date.now();
        } else if (applicableParameters && !last) {
          isEvaluationOverdue = true;
        }

        const lastTwoBelowMinimum =
          !!applicableParameters &&
          evals.length >= 2 &&
          evals[0].overall_score < applicableParameters.minimumApprovalScore &&
          evals[1].overall_score < applicableParameters.minimumApprovalScore;

        return {
          ...s,
          criteriaCount: registered.length,
          missingCriteria,
          lastEvaluation: last,
          applicableParameters,
          isEvaluationOverdue,
          isPending: missingCriteria.length > 0 || isEvaluationOverdue,
          lastTwoBelowMinimum,
        };
      });
    },
  });
}

export function useCreateSupplier() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nomeFantasia: string;
      ramo: string;
      nomeRepresentante: string;
      contato: string;
      email: string;
      cnpj: string;
      descricaoFornecimento: string;
      categoria: SupplierCategory;
    }) => {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          nome_fantasia: input.nomeFantasia,
          ramo: input.ramo || null,
          nome_representante: input.nomeRepresentante || null,
          contato: input.contato || null,
          email: input.email || null,
          cnpj: input.cnpj || null,
          descricao_fornecimento: input.descricaoFornecimento || null,
          categoria: input.categoria,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as unknown as { id: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fornecedoresKeys.suppliers }),
  });
}

export function useSupplierQualificationCriteria(supplierId: string | null) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: fornecedoresKeys.criteria(supplierId ?? ""),
    enabled: !!supplierId,
    queryFn: async (): Promise<QualificationCriterionEntry[]> => {
      const { data, error } = await supabase
        .from("supplier_qualification_criteria")
        .select("id, supplier_id, criterion, attachment_url, observation, created_at")
        .eq("supplier_id", supplierId as string);
      if (error) throw error;
      return (
        data as unknown as {
          id: string;
          supplier_id: string;
          criterion: QualificationCriterion;
          attachment_url: string | null;
          observation: string | null;
          created_at: string;
        }[]
      ).map((r) => ({
        id: r.id,
        supplierId: r.supplier_id,
        criterion: r.criterion,
        attachmentUrl: r.attachment_url,
        observation: r.observation,
        createdAt: r.created_at,
      }));
    },
  });
}

/** Upsert por (supplier_id, criterion) — cadastra ou atualiza o
 * anexo/observação de um critério. Sempre precisa de pelo menos um dos
 * dois preenchidos (reforçado pelo CHECK do banco). */
export function useUpsertSupplierQualificationCriterion() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      supplierId: string;
      criterion: QualificationCriterion;
      attachmentUrl: string | null;
      observation: string | null;
    }) => {
      const { error } = await supabase.from("supplier_qualification_criteria").upsert(
        {
          supplier_id: input.supplierId,
          criterion: input.criterion,
          attachment_url: input.attachmentUrl,
          observation: input.observation,
        },
        { onConflict: "supplier_id,criterion" },
      );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: fornecedoresKeys.suppliers });
      queryClient.invalidateQueries({ queryKey: fornecedoresKeys.criteria(vars.supplierId) });
    },
  });
}

export function useSupplierEvaluationParameters() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: fornecedoresKeys.parameters,
    queryFn: async (): Promise<EvaluationParameters[]> => {
      const { data, error } = await supabase
        .from("supplier_evaluation_parameters")
        .select("id, supplier_id, minimum_approval_score, periodicity");
      if (error) throw error;
      return (
        data as unknown as {
          id: string;
          supplier_id: string | null;
          minimum_approval_score: number;
          periodicity: EvaluationPeriodicity;
        }[]
      ).map((r) => ({
        id: r.id,
        supplierId: r.supplier_id,
        minimumApprovalScore: r.minimum_approval_score,
        periodicity: r.periodicity,
      }));
    },
  });
}

export function useSetSupplierEvaluationParameters() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      supplierId: string | null;
      minimumApprovalScore: number;
      periodicity: EvaluationPeriodicity;
    }) => {
      const { error } = await supabase.from("supplier_evaluation_parameters").insert({
        supplier_id: input.supplierId,
        minimum_approval_score: input.minimumApprovalScore,
        periodicity: input.periodicity,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fornecedoresKeys.parameters });
      queryClient.invalidateQueries({ queryKey: fornecedoresKeys.suppliers });
    },
  });
}

export function useSupplierEvaluations(supplierId: string | null) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: fornecedoresKeys.evaluations(supplierId ?? ""),
    enabled: !!supplierId,
    queryFn: async (): Promise<SupplierEvaluation[]> => {
      const { data, error } = await supabase
        .from("supplier_evaluations")
        .select(
          "id, supplier_id, evaluation_number, quality_score, deadline_score, service_score, " +
            "legal_requirements_score, overall_score, feedback_message, feedback_sent_at, created_at",
        )
        .eq("supplier_id", supplierId as string)
        .order("evaluation_number", { ascending: false });
      if (error) throw error;
      return (
        data as unknown as {
          id: string;
          supplier_id: string;
          evaluation_number: number;
          quality_score: number;
          deadline_score: number;
          service_score: number;
          legal_requirements_score: number;
          overall_score: number;
          feedback_message: string | null;
          feedback_sent_at: string | null;
          created_at: string;
        }[]
      ).map((r) => ({
        id: r.id,
        supplierId: r.supplier_id,
        evaluationNumber: r.evaluation_number,
        qualityScore: r.quality_score,
        deadlineScore: r.deadline_score,
        serviceScore: r.service_score,
        legalRequirementsScore: r.legal_requirements_score,
        overallScore: r.overall_score,
        feedbackMessage: r.feedback_message,
        feedbackSentAt: r.feedback_sent_at,
        createdAt: r.created_at,
      }));
    },
  });
}

export function useCreateSupplierEvaluation() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      supplierId: string;
      qualityScore: number;
      deadlineScore: number;
      serviceScore: number;
      legalRequirementsScore: number;
    }) => {
      const { data, error } = await supabase
        .from("supplier_evaluations")
        .insert({
          supplier_id: input.supplierId,
          quality_score: input.qualityScore,
          deadline_score: input.deadlineScore,
          service_score: input.serviceScore,
          legal_requirements_score: input.legalRequirementsScore,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as unknown as { id: string };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: fornecedoresKeys.suppliers });
      queryClient.invalidateQueries({ queryKey: fornecedoresKeys.evaluations(vars.supplierId) });
    },
  });
}

export function useSendSupplierFeedback() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      evaluationId,
      supplierId,
      feedbackMessage,
    }: {
      evaluationId: string;
      supplierId: string;
      feedbackMessage: string;
    }) => {
      const { error } = await supabase
        .from("supplier_evaluations")
        .update({ feedback_message: feedbackMessage, feedback_sent_at: new Date().toISOString() })
        .eq("id", evaluationId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: fornecedoresKeys.suppliers });
      queryClient.invalidateQueries({ queryKey: fornecedoresKeys.evaluations(vars.supplierId) });
    },
  });
}
