import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { type PlanoAcao, type PlanoOrigemTipo, type PlanoStatus, type PDCA } from "@/lib/mock-data";

/* ============================================================
 * Tipos do banco (enums exatamente como gravados nas 3 tabelas de
 * action_plans — ver supabase/migrations/20260729150000_action_plans_table.sql)
 * ============================================================ */

export type ActionPlanStatusDb =
  | "planejado"
  | "em_execucao"
  | "em_avaliacao"
  | "concluido"
  | "atrasado"
  | "cancelado";

export type OriginTypeDb =
  | "nao_conformidade"
  | "auditoria_interna"
  | "auditoria_externa"
  | "risco_oportunidade"
  | "analise_critica"
  | "reclamacao_cliente"
  | "melhoria_continua"
  | "estrategia";

export type CorrectiveActionStatusDb =
  | "aguardando_aprovacao"
  | "planejada"
  | "em_execucao"
  | "aguardando_verificacao"
  | "aprovada"
  | "encerrada";

export type ClosureReasonDb = "eficaz" | "acao_fraca" | "causa_errada" | "reprovada_definitiva";
export type RestartReasonDb = "acao_fraca" | "causa_errada" | "nao_executada";
export type RequiredApprovalRoleDb = "quality_manager" | "admin";

export type VerificationResultDb = "eficaz" | "nao_eficaz";
export type VerificationReasonDb = "acao_fraca" | "causa_errada" | "nao_executada";

/* ============================================================
 * Mapas de tradução DB (snake_case) <-> UI (rótulos em português já usados
 * por src/lib/mock-data.ts e pelos componentes existentes de
 * planos-de-acao/).
 * ============================================================ */

export const ORIGIN_DB_TO_UI: Record<OriginTypeDb, PlanoOrigemTipo> = {
  nao_conformidade: "Não Conformidade",
  auditoria_interna: "Auditoria Interna",
  auditoria_externa: "Auditoria Externa",
  risco_oportunidade: "Risco/Oportunidade",
  analise_critica: "Análise Crítica",
  reclamacao_cliente: "Reclamação de Cliente",
  melhoria_continua: "Melhoria Contínua",
  estrategia: "Estratégia",
};

export const ORIGIN_UI_TO_DB: Record<PlanoOrigemTipo, OriginTypeDb> = Object.fromEntries(
  Object.entries(ORIGIN_DB_TO_UI).map(([db, ui]) => [ui, db]),
) as Record<PlanoOrigemTipo, OriginTypeDb>;

export const ACTION_PLAN_STATUS_LABEL: Record<ActionPlanStatusDb, PlanoStatus> = {
  planejado: "Planejado",
  em_execucao: "Em Execução",
  em_avaliacao: "Em Avaliação",
  concluido: "Concluído",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

/**
 * Status de UI por AÇÃO CORRETIVA individual (não do plano-cabeçalho). O
 * protótipo tratava plano = ação (1:1); aqui uma ação corretiva vira uma
 * "linha" na tabela/kanban/gantt de Planos de Ação, igual o desenho visual
 * já construído esperava — só a fonte dos dados mudou de mock pra real.
 * 'encerrada' não tem uma única tradução: depende do closure_reason (linha
 * superada por reprovação vs. linha cancelada não existe neste nível, só no
 * plano). Ações superadas somem do Kanban (que só lista as 4 colunas
 * ativas) e aparecem só na tabela e no histórico do plano, com o rótulo
 * "Superada".
 */
const CORRECTIVE_STATUS_DB_TO_UI: Record<
  Exclude<CorrectiveActionStatusDb, "encerrada">,
  PlanoStatus
> = {
  aguardando_aprovacao: "Planejado",
  planejada: "Planejado",
  em_execucao: "Em Execução",
  aguardando_verificacao: "Em Avaliação",
  aprovada: "Concluído",
};

const CORRECTIVE_STATUS_TO_PDCA: Record<CorrectiveActionStatusDb, PDCA> = {
  aguardando_aprovacao: "Plan",
  planejada: "Plan",
  em_execucao: "Do",
  aguardando_verificacao: "Check",
  aprovada: "Act",
  encerrada: "Act",
};

export const VERIFICATION_REASON_LABEL: Record<VerificationReasonDb, string> = {
  acao_fraca: "A ação foi executada mas não resolveu (ação fraca)",
  causa_errada: "A causa raiz identificada estava incorreta",
  nao_executada: "A ação não foi executada corretamente ou no prazo",
};

export const REQUIRED_APPROVAL_ROLE_LABEL: Record<RequiredApprovalRoleDb, string> = {
  quality_manager: "Gestor da Qualidade",
  admin: "Administrador do Cliente",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/* ============================================================
 * Linhas do banco
 * ============================================================ */

export interface ActionPlanRow {
  id: string;
  org_id: string;
  unit_id: string | null;
  code: string;
  nc_id: string | null;
  origin_type: OriginTypeDb;
  problem_description: string;
  contingency_description: string | null;
  contingency_responsible_id: string | null;
  contingency_deadline: string | null;
  contingency_executed_at: string | null;
  status: ActionPlanStatusDb;
  created_at: string;
  created_by: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  nc: { id: string; code: string } | null;
  contingency_responsible: { full_name: string } | null;
}

export interface CorrectiveActionRow {
  id: string;
  org_id: string;
  unit_id: string | null;
  action_plan_id: string;
  seq: number;
  parent_action_id: string | null;
  restart_reason: RestartReasonDb | null;
  escalation_level: number;
  required_approval_role: RequiredApprovalRoleDb | null;
  what_description: string;
  why_justification: string;
  where_location: string;
  who_responsible_id: string;
  how_method: string;
  how_much_cost: number;
  when_start: string;
  when_end: string;
  status: CorrectiveActionStatusDb;
  closure_reason: ClosureReasonDb | null;
  percent_complete: number;
  executed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  created_by: string;
  who_responsible: { id: string; full_name: string } | null;
  action_plan: ActionPlanRow;
}

export interface VerificationRow {
  id: string;
  org_id: string;
  corrective_action_id: string;
  attempt_number: number;
  verified_by: string;
  verified_at: string;
  result: VerificationResultDb;
  reason: VerificationReasonDb | null;
  notes: string | null;
  new_root_cause: string | null;
  new_deadline: string | null;
  escalation_level_required: number | null;
  required_approval_role: RequiredApprovalRoleDb | null;
  next_attempt_approved_by: string | null;
  next_attempt_approved_at: string | null;
  resulting_action_id: string | null;
  created_at: string;
  verified_by_profile: { full_name: string } | null;
  next_attempt_approved_by_profile: { full_name: string } | null;
}

const ACTION_PLAN_SELECT =
  "*, nc:ncs!nc_id(id, code), contingency_responsible:profiles!contingency_responsible_id(full_name)";

const CORRECTIVE_ACTION_SELECT = `
  *,
  who_responsible:profiles!who_responsible_id(id, full_name),
  action_plan:action_plans!action_plan_id(${ACTION_PLAN_SELECT})
`;

const VERIFICATION_SELECT = `
  *,
  verified_by_profile:profiles!verified_by(full_name),
  next_attempt_approved_by_profile:profiles!next_attempt_approved_by(full_name)
`;

/* ============================================================
 * Ação corretiva -> shape PlanoAcao (view model já consumido pela tabela /
 * kanban / gantt / gráficos de src/components/planos-de-acao/page.tsx).
 * Mantém a UI existente funcionando trocando só a fonte do dado.
 * ============================================================ */

export interface CorrectiveActionView extends PlanoAcao {
  actionId: string;
  planId: string;
  planCode: string;
  seq: number;
  statusDb: CorrectiveActionStatusDb;
  closureReason: ClosureReasonDb | null;
  escalationLevel: number;
  requiredApprovalRole: RequiredApprovalRoleDb | null;
  approvedBy: string | null;
  restartReason: RestartReasonDb | null;
  parentActionId: string | null;
  whoResponsibleId: string;
  ncId: string | null;
  /** 5W2H completo (seção 10 do Guia) — `descricao` (herdado de PlanoAcao)
   * já cobre "O quê"; os demais campos individuais não existiam no shape
   * mockado e são usados pela tela de detalhe do plano. */
  why: string;
  onde: string;
  como: string;
}

function departamentoFromRole(role?: string | null) {
  switch (role) {
    case "admin":
      return "Administrador do Cliente";
    case "quality_manager":
      return "Gestor da Qualidade";
    case "auditor":
      return "Auditor";
    case "area_manager":
      return "Gestor de Área";
    case "viewer":
      return "Somente Leitura";
    default:
      return "Colaborador";
  }
}

export function mapCorrectiveActionToView(
  row: CorrectiveActionRow,
  roleByUserId: Record<string, string> = {},
): CorrectiveActionView {
  const plan = row.action_plan;
  const nome = row.who_responsible?.full_name ?? "Não atribuído";
  const status: PlanoStatus =
    row.status === "encerrada" ? "Cancelado" : CORRECTIVE_STATUS_DB_TO_UI[row.status];
  const eficaciaAprovadaPrimeira =
    row.status === "aprovada"
      ? row.escalation_level === 0
      : row.status === "encerrada"
        ? false
        : null;

  return {
    id: row.id,
    codigo: `${plan.code} · Ação ${row.seq}`,
    descricao: row.what_description,
    motivo: plan.problem_description,
    origemTipo: ORIGIN_DB_TO_UI[plan.origin_type],
    vinculadoCodigo: plan.nc?.code ?? null,
    vinculadoLink: plan.nc?.id ?? null,
    responsavel: {
      nome,
      iniciais: initials(nome),
      departamento: departamentoFromRole(roleByUserId[row.who_responsible_id]),
    },
    pdca: CORRECTIVE_STATUS_TO_PDCA[row.status],
    status,
    inicio: row.when_start,
    prazo: row.when_end,
    percentual: row.status === "aprovada" ? 100 : row.percent_complete,
    custo: Number(row.how_much_cost),
    eficaciaAprovadaPrimeira,
    marcos: [row.when_end],
    concluidoNoPrazo:
      row.status === "aprovada"
        ? new Date(row.approved_at ?? row.when_end) <= new Date(row.when_end)
        : null,
    actionId: row.id,
    planId: plan.id,
    planCode: plan.code,
    seq: row.seq,
    statusDb: row.status,
    closureReason: row.closure_reason,
    escalationLevel: row.escalation_level,
    requiredApprovalRole: row.required_approval_role,
    approvedBy: row.approved_by,
    restartReason: row.restart_reason,
    parentActionId: row.parent_action_id,
    whoResponsibleId: row.who_responsible_id,
    ncId: plan.nc_id,
    why: row.why_justification,
    onde: row.where_location,
    como: row.how_method,
  };
}

/* ============================================================
 * Query keys
 * ============================================================ */

export const actionPlanKeys = {
  all: ["action-plans"] as const,
  plans: () => [...actionPlanKeys.all, "plans"] as const,
  plan: (id: string) => [...actionPlanKeys.all, "plan", id] as const,
  planByNc: (ncId: string) => [...actionPlanKeys.all, "plan-by-nc", ncId] as const,
  correctiveActions: () => [...actionPlanKeys.all, "corrective-actions"] as const,
  correctiveActionsByPlan: (planId: string) =>
    [...actionPlanKeys.all, "corrective-actions", "by-plan", planId] as const,
  verifications: (actionId: string) => [...actionPlanKeys.all, "verifications", actionId] as const,
  orgMembers: () => [...actionPlanKeys.all, "org-members"] as const,
};

/* ============================================================
 * Hooks de leitura
 * ============================================================ */

/** Lista achatada de ações corretivas — alimenta tabela/kanban/gantt/gráficos. */
export function useCorrectiveActions() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: actionPlanKeys.correctiveActions(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plan_corrective_actions")
        .select(CORRECTIVE_ACTION_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CorrectiveActionRow[];
    },
  });
}

export function useCorrectiveActionsByPlan(planId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: actionPlanKeys.correctiveActionsByPlan(planId ?? ""),
    enabled: Boolean(planId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plan_corrective_actions")
        .select(CORRECTIVE_ACTION_SELECT)
        .eq("action_plan_id", planId)
        .order("seq", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as CorrectiveActionRow[];
    },
  });
}

export function useActionPlan(id: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: actionPlanKeys.plan(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plans")
        .select(ACTION_PLAN_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as ActionPlanRow;
    },
  });
}

/** Plano de ação mais recente (não cancelado) vinculado a uma NC — usado
 * pelo card "Plano de Ação Vinculado" da tela de detalhe de NC. */
export function useActionPlanByNc(ncId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: actionPlanKeys.planByNc(ncId ?? ""),
    enabled: Boolean(ncId),
    queryFn: async () => {
      const { data: plan, error } = await supabase
        .from("action_plans")
        .select(ACTION_PLAN_SELECT)
        .eq("nc_id", ncId)
        .neq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!plan) return null;
      const planRow = plan as unknown as ActionPlanRow;

      const { data: actions, error: actionsError } = await supabase
        .from("action_plan_corrective_actions")
        .select("status, percent_complete")
        .eq("action_plan_id", planRow.id);
      if (actionsError) throw actionsError;

      const rows = actions as unknown as {
        status: CorrectiveActionStatusDb;
        percent_complete: number;
      }[];
      const live = rows.filter((r) => r.status !== "encerrada");
      const percentual = live.length
        ? Math.round(
            live.reduce((sum, r) => sum + (r.status === "aprovada" ? 100 : r.percent_complete), 0) /
              live.length,
          )
        : 0;

      return { plan: planRow, percentual };
    },
  });
}

export function useVerifications(actionId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: actionPlanKeys.verifications(actionId ?? ""),
    enabled: Boolean(actionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plan_verifications")
        .select(VERIFICATION_SELECT)
        .eq("corrective_action_id", actionId)
        .order("attempt_number", { ascending: true });
      if (error) throw error;
      return data as unknown as VerificationRow[];
    },
  });
}

export interface OrgMember {
  id: string;
  fullName: string;
  role: string;
}

/** Membros da organização ativa — usado no seletor de responsável (5W2H) e
 * para traduzir papel em rótulo de "departamento" na UI (profiles não tem
 * coluna de cargo/departamento — ver comentário em departamentoFromRole). */
export function useOrgMembers() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: actionPlanKeys.orgMembers(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_organizations")
        .select("user_id, role, profile:profiles!user_id(full_name)")
        .eq("is_active", true);
      if (error) throw error;
      return (
        data as unknown as {
          user_id: string;
          role: string;
          profile: { full_name: string } | null;
        }[]
      ).map(
        (r): OrgMember => ({
          id: r.user_id,
          fullName: r.profile?.full_name ?? "Usuário",
          role: r.role,
        }),
      );
    },
  });
}

/* ============================================================
 * Criação do plano (contingência + N ações corretivas de uma vez).
 * ============================================================ */

export interface CreateActionPlanCorrectiveActionInput {
  oque: string;
  porque: string;
  onde: string;
  responsavelId: string;
  prazo: Date;
  como: string;
  quanto: number;
}

export interface CreateActionPlanInput {
  origem: PlanoOrigemTipo;
  problema: string;
  ncId?: string;
  unitId?: string;
  contingencia?: {
    descricao: string;
    responsavelId: string;
    prazo: Date;
  };
  acoes: CreateActionPlanCorrectiveActionInput[];
}

export function useCreateActionPlan() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateActionPlanInput) => {
      const { data: plan, error: planError } = await supabase
        .from("action_plans")
        .insert({
          origin_type: ORIGIN_UI_TO_DB[input.origem],
          problem_description: input.problema,
          nc_id: input.ncId ?? null,
          unit_id: input.unitId ?? null,
          contingency_description: input.contingencia?.descricao ?? null,
          contingency_responsible_id: input.contingencia?.responsavelId ?? null,
          contingency_deadline: input.contingencia?.prazo.toISOString() ?? null,
        })
        .select(ACTION_PLAN_SELECT)
        .single();
      if (planError) throw planError;
      const planRow = plan as unknown as ActionPlanRow;

      const { error: actionsError } = await supabase.from("action_plan_corrective_actions").insert(
        input.acoes.map((a) => ({
          action_plan_id: planRow.id,
          what_description: a.oque,
          why_justification: a.porque,
          where_location: a.onde,
          who_responsible_id: a.responsavelId,
          how_method: a.como,
          how_much_cost: a.quanto,
          when_end: a.prazo.toISOString(),
        })),
      );
      if (actionsError) throw actionsError;

      return planRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: actionPlanKeys.correctiveActions() });
      queryClient.invalidateQueries({ queryKey: actionPlanKeys.plans() });
    },
  });
}

/* ============================================================
 * Transições de status de uma ação corretiva (execução / pedido de
 * verificação). Aprovação de escalonamento e verificação de eficácia têm
 * mutations próprias abaixo porque carregam regra de negócio adicional.
 * ============================================================ */

export function useUpdateCorrectiveActionStatus() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      percentComplete,
    }: {
      id: string;
      status: "em_execucao" | "aguardando_verificacao";
      percentComplete?: number;
    }) => {
      const patch: Record<string, unknown> = { status };
      if (percentComplete !== undefined) patch.percent_complete = percentComplete;
      const { data, error } = await supabase
        .from("action_plan_corrective_actions")
        .update(patch)
        .eq("id", id)
        .select(CORRECTIVE_ACTION_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as CorrectiveActionRow;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: actionPlanKeys.correctiveActions() });
      queryClient.invalidateQueries({
        queryKey: actionPlanKeys.correctiveActionsByPlan(row.action_plan_id),
      });
      queryClient.invalidateQueries({ queryKey: actionPlanKeys.plan(row.action_plan_id) });
    },
  });
}

/** Gestor da Qualidade (nível 1) ou Administrador (nível 2+) libera a
 * próxima tentativa após uma reprovação — seção 11 do Guia. O papel exigido
 * é validado de novo no banco (guard_corrective_action_update), então um
 * usuário sem permissão recebe erro do Postgres mesmo que a UI esconda o
 * botão. */
export function useApproveNextAttempt() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approvedBy }: { id: string; approvedBy: string }) => {
      const { data, error } = await supabase
        .from("action_plan_corrective_actions")
        .update({ approved_by: approvedBy })
        .eq("id", id)
        .select(CORRECTIVE_ACTION_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as CorrectiveActionRow;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: actionPlanKeys.correctiveActions() });
      queryClient.invalidateQueries({
        queryKey: actionPlanKeys.correctiveActionsByPlan(row.action_plan_id),
      });
      queryClient.invalidateQueries({ queryKey: actionPlanKeys.plan(row.action_plan_id) });
      queryClient.invalidateQueries({ queryKey: actionPlanKeys.verifications(row.id) });
    },
  });
}

/* ============================================================
 * Verificação de eficácia — os 3 caminhos da seção 11 do Guia. O trigger
 * handle_effectiveness_verification decide sozinho o que fazer (reabrir a
 * mesma ação, encerrar e criar uma nova, etc); aqui só mandamos o payload
 * que o modal coleta.
 * ============================================================ */

export interface VerifyEffectivenessInput {
  correctiveActionId: string;
  verifiedBy: string;
  result: VerificationResultDb;
  reason?: VerificationReasonDb;
  notes?: string;
  newRootCause?: string;
  newDeadline?: Date;
}

export function useVerifyEffectiveness() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: VerifyEffectivenessInput) => {
      const { data, error } = await supabase
        .from("action_plan_verifications")
        .insert({
          corrective_action_id: input.correctiveActionId,
          verified_by: input.verifiedBy,
          result: input.result,
          reason: input.reason ?? null,
          notes: input.notes ?? null,
          new_root_cause: input.newRootCause ?? null,
          new_deadline: input.newDeadline?.toISOString() ?? null,
        })
        .select(VERIFICATION_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as VerificationRow;
    },
    onSuccess: (_row, variables) => {
      queryClient.invalidateQueries({ queryKey: actionPlanKeys.correctiveActions() });
      queryClient.invalidateQueries({ queryKey: actionPlanKeys.plans() });
      queryClient.invalidateQueries({
        queryKey: actionPlanKeys.verifications(variables.correctiveActionId),
      });
      queryClient.invalidateQueries({ queryKey: ["ncs"] });
    },
  });
}

/* ============================================================
 * Cancelamento do plano — soft delete com motivo (seção 2 do Guia), mesmo
 * padrão de useCancelNC.
 * ============================================================ */

export function useCancelActionPlan() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (!reason.trim()) throw new Error("Motivo do cancelamento é obrigatório.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("action_plans")
        .update({
          status: "cancelado" satisfies ActionPlanStatusDb,
          cancel_reason: reason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id ?? null,
        })
        .eq("id", id)
        .select(ACTION_PLAN_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as ActionPlanRow;
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: actionPlanKeys.correctiveActions() });
      queryClient.invalidateQueries({ queryKey: actionPlanKeys.plan(plan.id) });
    },
  });
}

/* ============================================================
 * Trilha de auditoria de um plano — item 7 do prompt da ABA 5 ("reprovou
 * eficácia com motivo X", "reabriu 5 porquês", "aprovou nova tentativa",
 * etc). Toda linha nasce de trigger de banco (ver
 * supabase/migrations/20260729150200_action_plans_triggers.sql); aqui só
 * lemos por entity_code = código do plano.
 * ============================================================ */

export interface ActivityLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_code: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string } | null;
}

export function useActionPlanActivityLog(planCode: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: [...actionPlanKeys.all, "activity-log", planCode ?? ""],
    enabled: Boolean(planCode),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select(
          "id, action, entity_type, entity_code, detail, created_at, actor:profiles!actor_id(full_name)",
        )
        .eq("entity_type", "action_plan")
        .eq("entity_code", planCode)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ActivityLogRow[];
    },
  });
}
