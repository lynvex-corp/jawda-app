import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { actionPlanKeys, type CreateActionPlanInput } from "@/lib/queries/action-plans";

/* ============================================================
 * Solução de Problemas (A3) — sub-feature de Não Conformidades.
 * Tabela `problem_solutions` (migration 20261003090000). As Entregas
 * (milestones) NÃO moram aqui: são ações corretivas de um action_plans com
 * origin_type='solucao_problemas' (ver buildMilestonesPlanInput).
 * ============================================================ */

export type ProblemSolutionStatusDb = "em_andamento" | "encerrado" | "cancelado";

export const PROBLEM_SOLUTION_STATUS_LABEL: Record<ProblemSolutionStatusDb, string> = {
  em_andamento: "Em andamento",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

export interface ProblemSolutionRow {
  id: string;
  org_id: string;
  unit_id: string | null;
  code: string;
  title: string;
  nc_origin_id: string | null;
  problem_definition: string;
  current_situation: string | null;
  goal: string | null;
  five_whys: string[] | null;
  root_cause_text: string | null;
  future_situation: string | null;
  indicator_id: string | null;
  lessons_learned: string | null;
  milestones_plan_id: string | null;
  status: ProblemSolutionStatusDb;
  closed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  created_by: string;
  nc_origin: { id: string; code: string } | null;
  indicator: { id: string; code: string; name: string } | null;
  milestones_plan: { id: string; code: string } | null;
  created_by_profile: { full_name: string } | null;
}

const SELECT = `
  *,
  nc_origin:ncs!nc_origin_id(id, code),
  indicator:indicators!indicator_id(id, code, name),
  milestones_plan:action_plans!milestones_plan_id(id, code),
  created_by_profile:profiles!created_by(full_name)
`;

export const problemSolutionKeys = {
  all: ["problem-solutions"] as const,
  lists: () => [...problemSolutionKeys.all, "list"] as const,
  detail: (id: string) => [...problemSolutionKeys.all, "detail", id] as const,
  indicatorOptions: () => [...problemSolutionKeys.all, "indicator-options"] as const,
};

export function useProblemSolutions() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: problemSolutionKeys.lists(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("problem_solutions")
        .select(SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ProblemSolutionRow[];
    },
  });
}

export function useProblemSolution(id: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: problemSolutionKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("problem_solutions")
        .select(SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as ProblemSolutionRow;
    },
  });
}

/** Indicadores não arquivados para o campo 7 (vínculo por id). */
export function useIndicatorOptions() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: problemSolutionKeys.indicatorOptions(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicators")
        .select("id, code, name")
        .neq("status", "archived")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; code: string; name: string }[];
    },
  });
}

/** Campos editáveis do formulário A3 (7 campos + título). */
export interface ProblemSolutionInput {
  title: string;
  problemDefinition: string;
  currentSituation: string;
  goal: string;
  fiveWhys: string[];
  rootCauseText: string;
  futureSituation: string;
  indicatorId: string | null;
}

function toColumns(input: ProblemSolutionInput) {
  const temPorques = input.fiveWhys.some((p) => p.trim());
  return {
    title: input.title.trim(),
    problem_definition: input.problemDefinition.trim(),
    current_situation: input.currentSituation.trim() || null,
    goal: input.goal.trim() || null,
    five_whys: temPorques ? input.fiveWhys : null,
    root_cause_text: input.rootCauseText.trim() || null,
    future_situation: input.futureSituation.trim() || null,
    indicator_id: input.indicatorId,
  };
}

export function useCreateProblemSolution() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProblemSolutionInput & { ncOriginId?: string | null }) => {
      const { data, error } = await supabase
        .from("problem_solutions")
        .insert({ ...toColumns(input), nc_origin_id: input.ncOriginId ?? null })
        .select(SELECT)
        .single();
      if (error) throw error;
      return data as unknown as ProblemSolutionRow;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: problemSolutionKeys.lists() }),
  });
}

export function useUpdateProblemSolution() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ProblemSolutionInput & { id: string }) => {
      const { data, error } = await supabase
        .from("problem_solutions")
        .update(toColumns(input))
        .eq("id", id)
        .select(SELECT)
        .single();
      if (error) throw error;
      return data as unknown as ProblemSolutionRow;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: problemSolutionKeys.lists() });
      queryClient.setQueryData(problemSolutionKeys.detail(row.id), row);
    },
  });
}

/** Passo 8 (Padronizar e Replicar): encerra registrando as lições aprendidas
 * (opcional). closed_at nasce da trigger guard_problem_solution_update. */
export function useCloseProblemSolution() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lessonsLearned }: { id: string; lessonsLearned: string }) => {
      const { data, error } = await supabase
        .from("problem_solutions")
        .update({ status: "encerrado", lessons_learned: lessonsLearned.trim() || null })
        .eq("id", id)
        .select(SELECT)
        .single();
      if (error) throw error;
      return data as unknown as ProblemSolutionRow;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: problemSolutionKeys.lists() });
      queryClient.setQueryData(problemSolutionKeys.detail(row.id), row);
    },
  });
}

/** Cancelamento é soft delete — nada apaga (seção 2 do Guia). */
export function useCancelProblemSolution() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (!reason.trim()) throw new Error("Motivo do cancelamento é obrigatório.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("problem_solutions")
        .update({
          status: "cancelado",
          cancel_reason: reason.trim(),
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id ?? null,
        })
        .eq("id", id)
        .select(SELECT)
        .single();
      if (error) throw error;
      return data as unknown as ProblemSolutionRow;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: problemSolutionKeys.lists() });
      queryClient.setQueryData(problemSolutionKeys.detail(row.id), row);
    },
  });
}

/* ============================================================
 * Entregas (milestones) -> Plano de Ação real
 * ============================================================ */

export interface Milestone {
  oque: string;
  responsavelId: string;
  prazo: Date;
}

/** Monta o CreateActionPlanInput do A3: origem "Solução de Problemas",
 * sem nc_id (a NC de origem não é afetada — ver migration), e o 5W2H
 * obrigatório preenchido de forma genérica e editável depois no plano. */
export function buildMilestonesPlanInput(
  solution: Pick<ProblemSolutionRow, "id" | "code" | "problem_definition" | "unit_id">,
  milestones: Milestone[],
): CreateActionPlanInput {
  return {
    origem: "Solução de Problemas",
    problema: solution.problem_definition,
    problemSolutionId: solution.id,
    unitId: solution.unit_id ?? undefined,
    acoes: milestones.map((m) => ({
      oque: m.oque,
      porque: `Entrega do A3 ${solution.code}: ${solution.problem_definition}`,
      onde: `Conforme A3 ${solution.code}`,
      responsavelId: m.responsavelId,
      prazo: m.prazo,
      como: `Conforme A3 ${solution.code}`,
      quanto: 0,
    })),
  };
}

/** Após gerar o plano, o atalho milestones_plan_id é preenchido por trigger
 * (link_action_plan_to_problem_solution) — só precisa recarregar o A3. */
export function useRefreshProblemSolution() {
  const queryClient = useQueryClient();
  return (solutionId: string) => {
    queryClient.invalidateQueries({ queryKey: problemSolutionKeys.detail(solutionId) });
    queryClient.invalidateQueries({ queryKey: problemSolutionKeys.lists() });
    queryClient.invalidateQueries({ queryKey: actionPlanKeys.plans() });
  };
}
