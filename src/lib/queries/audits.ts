import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useCreateNC } from "./ncs";
import { useCreateActionPlan, type CreateActionPlanCorrectiveActionInput } from "./action-plans";
import type { Severity } from "@/lib/mock-data";
import { AUDIT_CHECKLIST_TEMPLATE_ISO_9001 } from "@/lib/audit-checklist-template";

/* ============================================================
 * Tipos do banco — ver supabase/migrations/20260729160000_audits_tables.sql
 * ============================================================ */

export type AuditTypeDb = "interna" | "externa";
export type AuditStatusDb = "programada" | "em_andamento" | "concluida" | "cancelada";
export type AuditEventDb =
  | "certificacao"
  | "monitoracao_12m"
  | "monitoracao_24m"
  | "recertificacao";
export type ChecklistClassificationDb = "C" | "OPM" | "NCS" | "NCM" | "NCC";
export type FindingTypeDb = "OPM" | "NCS" | "NCM" | "NCC";
export type FindingStatusDb =
  | "aberto"
  | "em_tratativa"
  | "aguardando_verificacao"
  | "encerrado_eficaz"
  | "encerrado_nao_eficaz";
export type ReportRecommendationDb = "manutencao_certificacao" | "reauditoria";

export const AUDIT_TYPE_LABEL: Record<AuditTypeDb, string> = {
  interna: "Interna",
  externa: "Externa",
};

export const AUDIT_STATUS_LABEL: Record<AuditStatusDb, string> = {
  programada: "Programada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const AUDIT_EVENT_LABEL: Record<AuditEventDb, string> = {
  certificacao: "Certificação",
  monitoracao_12m: "Monitoração 12 meses",
  monitoracao_24m: "Monitoração 24 meses",
  recertificacao: "Recertificação",
};

/** Mesma escala usada no checklist e no apontamento — Conforme / Oportunidade
 * de Melhoria Potencial / NC Simples / Moderada / Crítica. */
export const CLASSIFICATION_META: Record<
  ChecklistClassificationDb,
  { label: string; long: string; badge: string }
> = {
  C: {
    label: "C",
    long: "Conforme",
    badge:
      "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/40",
  },
  OPM: {
    label: "OPM",
    long: "Oportunidade de melhoria",
    badge: "bg-brand-soft text-brand border-brand/30",
  },
  NCS: {
    label: "NCS",
    long: "NC Simples",
    badge:
      "bg-[color:var(--warning)]/15 text-[color:var(--severity-high)] border-[color:var(--warning)]/40",
  },
  NCM: {
    label: "NCM",
    long: "NC Moderada",
    badge:
      "bg-[color:var(--severity-high)]/15 text-[color:var(--severity-high)] border-[color:var(--severity-high)]/40",
  },
  NCC: {
    label: "NCC",
    long: "NC Crítica",
    badge:
      "bg-[color:var(--severity-critical)]/15 text-[color:var(--severity-critical)] border-[color:var(--severity-critical)]/40",
  },
};

export const FINDING_STATUS_LABEL: Record<FindingStatusDb, string> = {
  aberto: "Aberto",
  em_tratativa: "Em tratativa",
  aguardando_verificacao: "Aguardando verificação",
  encerrado_eficaz: "Encerrado — eficaz",
  encerrado_nao_eficaz: "Encerrado — não eficaz",
};

/* ============================================================
 * Linhas do banco
 * ============================================================ */

export interface AuditRow {
  id: string;
  org_id: string;
  unit_id: string | null;
  code: string;
  type: AuditTypeDb;
  norm: "iso_9001";
  scope: string;
  start_date: string;
  end_date: string;
  status: AuditStatusDb;
  lead_auditor_id: string | null;
  external_certifier: string | null;
  event: AuditEventDb | null;
  created_at: string;
  created_by: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  lead_auditor: { id: string; full_name: string } | null;
}

const AUDIT_SELECT = "*, lead_auditor:profiles!lead_auditor_id(id, full_name)";

export interface AuditAuditorRow {
  audit_id: string;
  auditor_name: string;
  is_internal: boolean;
  user_id: string | null;
}

export interface AuditPlanItemRow {
  id: string;
  audit_id: string;
  day_number: number;
  start_time: string;
  end_time: string;
  process: string;
  requirements: string[];
  auditor_id: string | null;
  notes: string | null;
  auditor: { id: string; full_name: string } | null;
}

const PLAN_ITEM_SELECT = "*, auditor:profiles!auditor_id(id, full_name)";

export interface AuditChecklistItemRow {
  id: string;
  audit_id: string;
  requirement_code: string;
  requirement_title: string;
  guidance: string | null;
  classification: ChecklistClassificationDb | null;
  evidence_notes: string | null;
  evidence_files: { path: string; name: string }[];
  evaluated_at: string | null;
  evaluated_by: string | null;
}

export interface AuditFindingRow {
  id: string;
  audit_id: string;
  checklist_item_id: string | null;
  code: string;
  type: FindingTypeDb;
  norm_requirement: string | null;
  description: string;
  severity_suggested: "baixa" | "media" | "alta" | "critica" | null;
  generated_nc_id: string | null;
  generated_action_plan_id: string | null;
  status: FindingStatusDb;
  created_at: string;
  created_by: string;
  generated_nc: { id: string; code: string } | null;
  generated_action_plan: { id: string; code: string } | null;
}

const FINDING_SELECT =
  "*, generated_nc:ncs!generated_nc_id(id, code), generated_action_plan:action_plans!generated_action_plan_id(id, code)";

export interface AuditReportRow {
  audit_id: string;
  summary: string | null;
  positive_points: string | null;
  conclusion: string | null;
  recommendation: ReportRecommendationDb | null;
  exported_pdf_url: string | null;
  generated_at: string | null;
  generated_by: string | null;
}

/* ============================================================
 * Query keys
 * ============================================================ */

export const auditKeys = {
  all: ["audits"] as const,
  lists: () => [...auditKeys.all, "list"] as const,
  list: (filters: AuditListFilters) => [...auditKeys.lists(), filters] as const,
  detail: (id: string) => [...auditKeys.all, "detail", id] as const,
  auditors: (auditId: string) => [...auditKeys.all, "auditors", auditId] as const,
  planItems: (auditId: string) => [...auditKeys.all, "plan-items", auditId] as const,
  checklist: (auditId: string) => [...auditKeys.all, "checklist", auditId] as const,
  findings: (auditId: string) => [...auditKeys.all, "findings", auditId] as const,
  report: (auditId: string) => [...auditKeys.all, "report", auditId] as const,
  activityLog: (auditCode: string) => [...auditKeys.all, "activity-log", auditCode] as const,
};

/* ============================================================
 * Auditoria — leitura
 * ============================================================ */

export interface AuditListFilters {
  type?: AuditTypeDb;
  status?: AuditStatusDb;
}

export function useAudits(filters: AuditListFilters = {}) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: async () => {
      let query = supabase
        .from("audits")
        .select(AUDIT_SELECT)
        .order("start_date", { ascending: false });
      if (filters.type) query = query.eq("type", filters.type);
      if (filters.status) query = query.eq("status", filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AuditRow[];
    },
  });
}

export function useAudit(id: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: auditKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audits")
        .select(AUDIT_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as AuditRow;
    },
  });
}

export function useAuditAuditors(auditId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: auditKeys.auditors(auditId ?? ""),
    enabled: Boolean(auditId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_auditors")
        .select("*")
        .eq("audit_id", auditId)
        .order("is_internal", { ascending: false });
      if (error) throw error;
      return data as unknown as AuditAuditorRow[];
    },
  });
}

/* ============================================================
 * Auditoria — criação / transições de status
 * ============================================================ */

export interface CreateAuditAuditorInput {
  name: string;
  isInternal: boolean;
  userId?: string;
}

export interface CreateAuditInput {
  type: AuditTypeDb;
  scope: string;
  startDate: string;
  endDate: string;
  unitId?: string;
  leadAuditorId?: string;
  // Só externa:
  externalCertifier?: string;
  event?: AuditEventDb;
  // Equipe (líder já entra como auditor is_internal=true separado do papel de leadAuditorId).
  auditors?: CreateAuditAuditorInput[];
}

export function useCreateAudit() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAuditInput) => {
      const { data: audit, error } = await supabase
        .from("audits")
        .insert({
          type: input.type,
          scope: input.scope,
          start_date: input.startDate,
          end_date: input.endDate,
          unit_id: input.unitId ?? null,
          lead_auditor_id: input.leadAuditorId ?? null,
          external_certifier: input.type === "externa" ? (input.externalCertifier ?? null) : null,
          event: input.type === "externa" ? (input.event ?? null) : null,
        })
        .select(AUDIT_SELECT)
        .single();
      if (error) throw error;
      const auditRow = audit as unknown as AuditRow;

      if (input.auditors?.length) {
        const { error: auditorsError } = await supabase.from("audit_auditors").insert(
          input.auditors.map((a) => ({
            audit_id: auditRow.id,
            auditor_name: a.name,
            is_internal: a.isInternal,
            user_id: a.userId ?? null,
          })),
        );
        if (auditorsError) throw auditorsError;
      }

      return auditRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
    },
  });
}

export function useUpdateAuditStatus() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: Exclude<AuditStatusDb, "cancelada">;
    }) => {
      const { data, error } = await supabase
        .from("audits")
        .update({ status })
        .eq("id", id)
        .select(AUDIT_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as AuditRow;
    },
    onSuccess: (audit) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
      queryClient.setQueryData(auditKeys.detail(audit.id), audit);
    },
  });
}

/** Cancelamento é soft delete — nada apaga (seção 2 do Guia). */
export function useCancelAudit() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (!reason.trim()) throw new Error("Motivo do cancelamento é obrigatório.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("audits")
        .update({
          status: "cancelada" satisfies AuditStatusDb,
          cancel_reason: reason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id ?? null,
        })
        .eq("id", id)
        .select(AUDIT_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as AuditRow;
    },
    onSuccess: (audit) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
      queryClient.setQueryData(auditKeys.detail(audit.id), audit);
    },
  });
}

/* ============================================================
 * Plano de auditoria (agenda por dia — só interna)
 * ============================================================ */

export function useAuditPlanItems(auditId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: auditKeys.planItems(auditId ?? ""),
    enabled: Boolean(auditId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_plan_items")
        .select(PLAN_ITEM_SELECT)
        .eq("audit_id", auditId)
        .order("day_number", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as unknown as AuditPlanItemRow[];
    },
  });
}

export interface UpsertPlanItemInput {
  id?: string;
  auditId: string;
  dayNumber: number;
  startTime: string;
  endTime: string;
  process: string;
  requirements: string[];
  auditorId?: string;
  notes?: string;
}

export function useUpsertPlanItem() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertPlanItemInput) => {
      const payload = {
        audit_id: input.auditId,
        day_number: input.dayNumber,
        start_time: input.startTime,
        end_time: input.endTime,
        process: input.process,
        requirements: input.requirements,
        auditor_id: input.auditorId ?? null,
        notes: input.notes ?? null,
      };
      const query = input.id
        ? supabase.from("audit_plan_items").update(payload).eq("id", input.id)
        : supabase.from("audit_plan_items").insert(payload);
      const { data, error } = await query.select(PLAN_ITEM_SELECT).single();
      if (error) throw error;
      return data as unknown as AuditPlanItemRow;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.planItems(row.audit_id) });
    },
  });
}

/* ============================================================
 * Checklist (só interna) — semeado do template estático ISO 9001 na
 * primeira visita, depois vive independente por auditoria.
 * ============================================================ */

export function useChecklistItems(auditId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: auditKeys.checklist(auditId ?? ""),
    enabled: Boolean(auditId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_checklist_items")
        .select("*")
        .eq("audit_id", auditId)
        .order("requirement_code", { ascending: true });
      if (error) throw error;
      return data as unknown as AuditChecklistItemRow[];
    },
  });
}

/** Semeia as linhas do template na primeira vez que a aba Checklist de uma
 * auditoria interna é aberta (idempotente — ignora duplicata pela unique
 * (audit_id, requirement_code)). Chamado pela UI quando useChecklistItems
 * retorna vazio. */
export function useSeedAuditChecklist() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (auditId: string) => {
      const { error } = await supabase.from("audit_checklist_items").upsert(
        AUDIT_CHECKLIST_TEMPLATE_ISO_9001.map((t) => ({
          audit_id: auditId,
          requirement_code: t.requirementCode,
          requirement_title: t.requirementTitle,
          guidance: t.guidance,
        })),
        { onConflict: "audit_id,requirement_code", ignoreDuplicates: true },
      );
      if (error) throw error;
      return auditId;
    },
    onSuccess: (auditId) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.checklist(auditId) });
    },
  });
}

/** Anexa evidência (Storage) a um item do checklist. Path
 * {org_id}/audits/{audit_id}/checklist/{checklist_item_id}/{filename} —
 * convenção da skill jawda-multitenant regra 5, bucket criado em
 * 20260729160400_evidence_storage_bucket.sql. */
export function useAttachChecklistEvidence() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      auditId,
      orgId,
      file,
      currentFiles,
    }: {
      itemId: string;
      auditId: string;
      orgId: string;
      file: File;
      currentFiles: { path: string; name: string }[];
    }) => {
      const path = `${orgId}/audits/${auditId}/checklist/${itemId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("evidencias").upload(path, file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("audit_checklist_items")
        .update({ evidence_files: [...currentFiles, { path, name: file.name }] })
        .eq("id", itemId)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as AuditChecklistItemRow;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.checklist(item.audit_id) });
    },
  });
}

export interface EvaluateChecklistItemInput {
  id: string;
  auditId: string;
  requirementCode: string;
  requirementTitle: string;
  classification: ChecklistClassificationDb;
  evidenceNotes?: string;
}

/** Avalia um item do checklist e, se a classificação for OPM/NCS/NCM/NCC,
 * cria (ou atualiza, se já existir e ainda não tiver gerado NC/PA) o
 * apontamento correspondente — mesma regra que o protótipo aplicava em
 * memória (handleClassif), agora persistida. */
export function useEvaluateChecklistItem() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EvaluateChecklistItemInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: item, error } = await supabase
        .from("audit_checklist_items")
        .update({
          classification: input.classification,
          evidence_notes: input.evidenceNotes ?? null,
          evaluated_at: new Date().toISOString(),
          evaluated_by: user?.id ?? null,
        })
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw error;

      if (input.classification !== "C") {
        const findingType = input.classification;
        const { data: existing, error: existingError } = await supabase
          .from("audit_findings")
          .select("id, generated_nc_id, generated_action_plan_id")
          .eq("checklist_item_id", input.id)
          .maybeSingle();
        if (existingError) throw existingError;

        const description = input.evidenceNotes?.trim() || input.requirementTitle;

        if (existing && !existing.generated_nc_id && !existing.generated_action_plan_id) {
          const { error: updateError } = await supabase
            .from("audit_findings")
            .update({ type: findingType, description })
            .eq("id", existing.id);
          if (updateError) throw updateError;
        } else if (!existing) {
          const { error: insertError } = await supabase.from("audit_findings").insert({
            audit_id: input.auditId,
            checklist_item_id: input.id,
            type: findingType,
            norm_requirement: input.requirementCode,
            description,
            severity_suggested: FINDING_TYPE_TO_SEVERITY_DB[findingType],
          });
          if (insertError) throw insertError;
        }
      }

      return item as unknown as AuditChecklistItemRow;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.checklist(item.audit_id) });
      queryClient.invalidateQueries({ queryKey: auditKeys.findings(item.audit_id) });
    },
  });
}

/* ============================================================
 * Apontamentos (findings, só interna) + gancho NC/PA reais
 * ============================================================ */

export function useFindings(auditId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: auditKeys.findings(auditId ?? ""),
    enabled: Boolean(auditId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_findings")
        .select(FINDING_SELECT)
        .eq("audit_id", auditId)
        .order("code", { ascending: true });
      if (error) throw error;
      return data as unknown as AuditFindingRow[];
    },
  });
}

export interface CreateFindingInput {
  auditId: string;
  type: FindingTypeDb;
  description: string;
  normRequirement?: string;
}

/** Apontamento criado manualmente (fora do checklist — ex.: observação
 * registrada em entrevista durante a auditoria). */
export function useCreateFinding() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFindingInput) => {
      const { data, error } = await supabase
        .from("audit_findings")
        .insert({
          audit_id: input.auditId,
          type: input.type,
          description: input.description,
          norm_requirement: input.normRequirement ?? null,
          severity_suggested: FINDING_TYPE_TO_SEVERITY_DB[input.type],
        })
        .select(FINDING_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as AuditFindingRow;
    },
    onSuccess: (finding) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.findings(finding.audit_id) });
    },
  });
}

const FINDING_TYPE_TO_SEVERITY: Record<FindingTypeDb, Severity> = {
  NCC: "Crítica",
  NCM: "Alta",
  NCS: "Média",
  OPM: "Baixa",
};

const FINDING_TYPE_TO_SEVERITY_DB: Record<FindingTypeDb, "baixa" | "media" | "alta" | "critica"> = {
  NCC: "critica",
  NCM: "alta",
  NCS: "media",
  OPM: "baixa",
};

/** "Gerar NC deste apontamento" (item 8 do prompt da ABA 6): cria uma NC
 * real com origem "Auditoria Interna" (código ganha sigla AI) reaproveitando
 * o mesmo hook da ABA 4, e marca o vínculo bidirecional no finding. */
export function useGenerateNcFromFinding() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  const createNC = useCreateNC();
  return useMutation({
    mutationFn: async (input: {
      findingId: string;
      auditId: string;
      description: string;
      type: FindingTypeDb;
      unitId?: string;
    }) => {
      const nc = await createNC.mutateAsync({
        origem: "Auditoria Interna",
        descricao: input.description,
        gravidade: FINDING_TYPE_TO_SEVERITY[input.type],
        unitId: input.unitId,
      });
      const { data, error } = await supabase
        .from("audit_findings")
        .update({ generated_nc_id: nc.id, status: "em_tratativa" satisfies FindingStatusDb })
        .eq("id", input.findingId)
        .select(FINDING_SELECT)
        .single();
      if (error) throw error;
      return { finding: data as unknown as AuditFindingRow, nc };
    },
    onSuccess: ({ finding }) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.findings(finding.audit_id) });
      queryClient.invalidateQueries({ queryKey: ["ncs"] });
    },
  });
}

export interface GenerateActionPlanFromFindingInput {
  findingId: string;
  auditId: string;
  description: string;
  ncId?: string;
  unitId?: string;
  acao: CreateActionPlanCorrectiveActionInput;
}

/** "Gerar Plano de Ação" (item 8): reaproveita o hook da ABA 5. Diferente da
 * NC (auto-derivável a partir do apontamento), o plano exige o 5W2H mínimo
 * de uma ação corretiva — coletado num diálogo pequeno na UI antes de
 * chamar este hook. */
export function useGenerateActionPlanFromFinding() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  const createActionPlan = useCreateActionPlan();
  return useMutation({
    mutationFn: async (input: GenerateActionPlanFromFindingInput) => {
      const plan = await createActionPlan.mutateAsync({
        origem: "Auditoria Interna",
        problema: input.description,
        ncId: input.ncId,
        unitId: input.unitId,
        acoes: [input.acao],
      });
      const { data, error } = await supabase
        .from("audit_findings")
        .update({
          generated_action_plan_id: plan.id,
          status: "em_tratativa" satisfies FindingStatusDb,
        })
        .eq("id", input.findingId)
        .select(FINDING_SELECT)
        .single();
      if (error) throw error;
      return { finding: data as unknown as AuditFindingRow, plan };
    },
    onSuccess: ({ finding }) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.findings(finding.audit_id) });
      queryClient.invalidateQueries({ queryKey: ["action-plans"] });
    },
  });
}

export function useCloseFinding() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, effective }: { id: string; effective: boolean }) => {
      const { data, error } = await supabase
        .from("audit_findings")
        .update({
          status: (effective
            ? "encerrado_eficaz"
            : "encerrado_nao_eficaz") satisfies FindingStatusDb,
        })
        .eq("id", id)
        .select(FINDING_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as AuditFindingRow;
    },
    onSuccess: (finding) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.findings(finding.audit_id) });
    },
  });
}

/* ============================================================
 * Relatório final (só interna)
 * ============================================================ */

export function useAuditReport(auditId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: auditKeys.report(auditId ?? ""),
    enabled: Boolean(auditId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_reports")
        .select("*")
        .eq("audit_id", auditId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AuditReportRow | null;
    },
  });
}

export interface UpsertReportInput {
  auditId: string;
  summary?: string;
  positivePoints?: string;
  conclusion?: string;
  recommendation?: ReportRecommendationDb;
  /** true só quando o usuário clica em "Emitir relatório" — grava
   * generated_at/generated_by e é o gatilho do log "emitiu_relatorio". */
  emit?: boolean;
}

export function useUpsertReport() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertReportInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = {
        audit_id: input.auditId,
        summary: input.summary ?? null,
        positive_points: input.positivePoints ?? null,
        conclusion: input.conclusion ?? null,
        recommendation: input.recommendation ?? null,
      };
      if (input.emit) {
        payload.generated_at = new Date().toISOString();
        payload.generated_by = user?.id ?? null;
      }
      const { data, error } = await supabase
        .from("audit_reports")
        .upsert(payload, { onConflict: "audit_id" })
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as AuditReportRow;
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: auditKeys.report(report.audit_id) });
    },
  });
}

/* ============================================================
 * KPIs agregados (página de listagem) — apontamentos ainda abertos e taxa
 * de conformidade do checklist em toda a organização (não por auditoria).
 * ============================================================ */

export function useAuditKpis() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: [...auditKeys.all, "kpis"],
    queryFn: async () => {
      const [findingsRes, checklistRes] = await Promise.all([
        supabase
          .from("audit_findings")
          .select("id", { count: "exact", head: true })
          .not("status", "in", "(encerrado_eficaz,encerrado_nao_eficaz)"),
        supabase
          .from("audit_checklist_items")
          .select("classification")
          .not("classification", "is", null),
      ]);
      if (findingsRes.error) throw findingsRes.error;
      if (checklistRes.error) throw checklistRes.error;

      const classifications = checklistRes.data as unknown as {
        classification: ChecklistClassificationDb;
      }[];
      const conformes = classifications.filter((c) => c.classification === "C").length;
      const taxaConformidade = classifications.length
        ? Math.round((conformes / classifications.length) * 100)
        : 0;

      return {
        apontamentosAbertos: findingsRes.count ?? 0,
        taxaConformidade,
      };
    },
  });
}

/* ============================================================
 * Trilha de auditoria de uma auditoria (activity_log)
 * ============================================================ */

export interface AuditActivityLogRow {
  id: string;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string } | null;
}

export function useAuditActivityLog(auditCode: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: auditKeys.activityLog(auditCode ?? ""),
    enabled: Boolean(auditCode),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action, detail, created_at, actor:profiles!actor_id(full_name)")
        .eq("entity_type", "audit")
        .eq("entity_code", auditCode)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AuditActivityLogRow[];
    },
  });
}
