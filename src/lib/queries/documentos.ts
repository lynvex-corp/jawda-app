import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { assertNotReadOnly } from "@/lib/org-access-guard";

/* ============================================================
 * Política da Qualidade
 *
 * Documento versionado (seção 21.5 do Guia) — mesmo desenho de
 * strategic_directives (Estratégia): só um rascunho aberto por org,
 * "Nova versão" e "Formalizar" são RPCs, nunca UPDATE livre do client.
 * ============================================================ */

export interface QualityPolicy {
  id: string;
  status: "rascunho" | "formalizada";
  versionLabel: string | null;
  content: string;
  formalizedAt: string | null;
  formalizedByName: string | null;
}

export interface QualityPolicyWithMeta {
  policy: QualityPolicy;
  isDraft: boolean;
}

const qualityPolicyKeys = {
  all: ["quality-policy"] as const,
  current: () => [...qualityPolicyKeys.all, "current"] as const,
  history: () => [...qualityPolicyKeys.all, "history"] as const,
};

const QUALITY_POLICY_SELECT =
  "id, status, version_label, content, formalized_at, formalized_by_profile:profiles!formalized_by(full_name)";

interface QualityPolicyRow {
  id: string;
  status: "rascunho" | "formalizada";
  version_label: string | null;
  content: string | null;
  formalized_at: string | null;
  formalized_by_profile: { full_name: string } | null;
}

function mapQualityPolicy(row: QualityPolicyRow): QualityPolicy {
  return {
    id: row.id,
    status: row.status,
    versionLabel: row.version_label,
    content: row.content ?? "",
    formalizedAt: row.formalized_at,
    formalizedByName: row.formalized_by_profile?.full_name ?? null,
  };
}

export function useQualityPolicyCurrent() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: qualityPolicyKeys.current(),
    queryFn: async (): Promise<QualityPolicyWithMeta | null> => {
      const { data: draft, error: draftErr } = await supabase
        .from("quality_policy")
        .select(QUALITY_POLICY_SELECT)
        .eq("status", "rascunho")
        .maybeSingle();
      if (draftErr) throw draftErr;

      let row = draft as unknown as QualityPolicyRow | null;
      let isDraft = true;

      if (!row) {
        const { data: lastFormalized, error: lastErr } = await supabase
          .from("quality_policy")
          .select(QUALITY_POLICY_SELECT)
          .eq("status", "formalizada")
          .order("formalized_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastErr) throw lastErr;
        row = lastFormalized as unknown as QualityPolicyRow | null;
        isDraft = false;
      }

      if (!row) return null;
      return { policy: mapQualityPolicy(row), isDraft };
    },
  });
}

export function useQualityPolicyHistory() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: qualityPolicyKeys.history(),
    queryFn: async (): Promise<QualityPolicy[]> => {
      const { data, error } = await supabase
        .from("quality_policy")
        .select(QUALITY_POLICY_SELECT)
        .eq("status", "formalizada")
        .order("formalized_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as QualityPolicyRow[]).map(mapQualityPolicy);
    },
  });
}

export function useStartFirstQualityPolicyDraft() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("quality_policy").insert({});
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qualityPolicyKeys.all }),
  });
}

export function useStartNewQualityPolicyVersion() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("start_new_quality_policy_version");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qualityPolicyKeys.all }),
  });
}

export function useFormalizeQualityPolicy() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, versionLabel }: { id: string; versionLabel: string }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("formalize_quality_policy", {
        p_id: id,
        p_version_label: versionLabel,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qualityPolicyKeys.all }),
  });
}

export function useUpdateQualityPolicyContent() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase.from("quality_policy").update({ content }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qualityPolicyKeys.current() }),
  });
}

/* ============================================================
 * Documentos (documents / document_revisions)
 * ============================================================ */

export type DocumentType = "lei" | "manual" | "norma" | "outro" | "planilha" | "procedimento";
export type DocumentStatus = "vigente" | "em_revisao" | "inutilizado_revogado";

/** Ordem alfabética (seção 21.7) — sem significado semântico entre os tipos. */
export const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "lei", label: "Lei" },
  { value: "manual", label: "Manual" },
  { value: "norma", label: "Norma" },
  { value: "outro", label: "Outro" },
  { value: "planilha", label: "Planilha" },
  { value: "procedimento", label: "Procedimento" },
];

export interface DocumentItem {
  id: string;
  code: string;
  title: string;
  type: DocumentType;
  currentRevision: number;
  lastRevisionDate: string | null;
  responsibleName: string | null;
  elaboradorName: string | null;
  status: DocumentStatus;
  fileUrl: string | null;
  createdAt: string;
}

export interface DocumentRevision {
  id: string;
  revisionNumber: number;
  contentOrFileUrl: string | null;
  createdAt: string;
  createdByName: string | null;
}

const documentKeys = {
  all: ["documents"] as const,
  list: () => [...documentKeys.all, "list"] as const,
  revisions: (documentId: string) => [...documentKeys.all, documentId, "revisions"] as const,
};

const DOCUMENT_SELECT =
  "id, code, title, type, current_revision, last_revision_date, status, file_url, created_at, " +
  "responsible:profiles!responsible_id(full_name), elaborador:profiles!elaborador_id(full_name)";

interface DocumentRow {
  id: string;
  code: string;
  title: string;
  type: DocumentType;
  current_revision: number;
  last_revision_date: string | null;
  status: DocumentStatus;
  file_url: string | null;
  created_at: string;
  responsible: { full_name: string } | null;
  elaborador: { full_name: string } | null;
}

function mapDocument(row: DocumentRow): DocumentItem {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    type: row.type,
    currentRevision: row.current_revision,
    lastRevisionDate: row.last_revision_date,
    responsibleName: row.responsible?.full_name ?? null,
    elaboradorName: row.elaborador?.full_name ?? null,
    status: row.status,
    fileUrl: row.file_url,
    createdAt: row.created_at,
  };
}

export function useDocuments() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: documentKeys.list(),
    queryFn: async (): Promise<DocumentItem[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select(DOCUMENT_SELECT)
        .order("code");
      if (error) throw error;
      return (data as unknown as DocumentRow[]).map(mapDocument);
    },
  });
}

export function useCreateDocument() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      code: string;
      title: string;
      type: DocumentType;
      responsibleId: string | null;
      elaboradorId: string | null;
    }) => {
      const { error } = await supabase.from("documents").insert({
        code: input.code,
        title: input.title,
        type: input.type,
        responsible_id: input.responsibleId,
        elaborador_id: input.elaboradorId,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.list() }),
  });
}

export function useDocumentRevisions(documentId: string | null) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: documentKeys.revisions(documentId ?? ""),
    enabled: !!documentId,
    queryFn: async (): Promise<DocumentRevision[]> => {
      const { data, error } = await supabase
        .from("document_revisions")
        .select(
          "id, revision_number, content_or_file_url, created_at, author:profiles!created_by(full_name)",
        )
        .eq("document_id", documentId as string)
        .order("revision_number", { ascending: false });
      if (error) throw error;
      return (
        data as unknown as {
          id: string;
          revision_number: number;
          content_or_file_url: string | null;
          created_at: string;
          author: { full_name: string } | null;
        }[]
      ).map((r) => ({
        id: r.id,
        revisionNumber: r.revision_number,
        contentOrFileUrl: r.content_or_file_url,
        createdAt: r.created_at,
        createdByName: r.author?.full_name ?? null,
      }));
    },
  });
}

export function useRegisterDocumentRevision() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentId,
      contentOrFileUrl,
    }: {
      documentId: string;
      contentOrFileUrl: string;
    }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("register_document_revision", {
        p_document_id: documentId,
        p_content_or_file_url: contentOrFileUrl,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.list() });
      queryClient.invalidateQueries({ queryKey: documentKeys.revisions(vars.documentId) });
    },
  });
}

/** "Inutilizar ou Revogar" (e outras mudanças de status) — restrito a
 * Gestor da Qualidade/Diretoria pela RLS de update; a UI decide quando
 * mostrar o botão (seção "Regra" da Parte 1 do prompt). */
export function useUpdateDocumentStatus() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DocumentStatus }) => {
      const { error } = await supabase.from("documents").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.list() }),
  });
}

/* ============================================================
 * Ata de Reunião (meeting_minutes)
 * ============================================================ */

export interface MeetingParticipant {
  nome: string;
}

export interface MeetingMinute {
  id: string;
  title: string;
  meetingDate: string;
  participants: MeetingParticipant[];
  agenda: string;
  deliberations: string;
  attachmentUrl: string | null;
  createdAt: string;
}

const meetingMinutesKeys = {
  all: ["meeting-minutes"] as const,
  list: () => [...meetingMinutesKeys.all, "list"] as const,
};

interface MeetingMinuteRow {
  id: string;
  title: string;
  meeting_date: string;
  participants: MeetingParticipant[];
  agenda: string | null;
  deliberations: string | null;
  attachment_url: string | null;
  created_at: string;
}

function mapMeetingMinute(row: MeetingMinuteRow): MeetingMinute {
  return {
    id: row.id,
    title: row.title,
    meetingDate: row.meeting_date,
    participants: row.participants ?? [],
    agenda: row.agenda ?? "",
    deliberations: row.deliberations ?? "",
    attachmentUrl: row.attachment_url,
    createdAt: row.created_at,
  };
}

export function useMeetingMinutes() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: meetingMinutesKeys.list(),
    queryFn: async (): Promise<MeetingMinute[]> => {
      const { data, error } = await supabase
        .from("meeting_minutes")
        .select(
          "id, title, meeting_date, participants, agenda, deliberations, attachment_url, created_at",
        )
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return (data as unknown as MeetingMinuteRow[]).map(mapMeetingMinute);
    },
  });
}

export function useCreateMeetingMinute() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      meetingDate: string;
      participants: MeetingParticipant[];
      agenda: string;
      deliberations: string;
    }) => {
      const { error } = await supabase.from("meeting_minutes").insert({
        title: input.title,
        meeting_date: input.meetingDate,
        participants: input.participants,
        agenda: input.agenda,
        deliberations: input.deliberations,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meetingMinutesKeys.list() }),
  });
}

/* ============================================================
 * Lista de Frequência (attendance_lists)
 * ============================================================ */

export interface AttendanceParticipant {
  nome: string;
  confirmado: boolean;
}

export interface AttendanceList {
  id: string;
  eventTitle: string;
  eventDate: string;
  participants: AttendanceParticipant[];
  createdAt: string;
}

const attendanceListKeys = {
  all: ["attendance-lists"] as const,
  list: () => [...attendanceListKeys.all, "list"] as const,
};

interface AttendanceListRow {
  id: string;
  event_title: string;
  event_date: string;
  participants: AttendanceParticipant[];
  created_at: string;
}

export function useAttendanceLists() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: attendanceListKeys.list(),
    queryFn: async (): Promise<AttendanceList[]> => {
      const { data, error } = await supabase
        .from("attendance_lists")
        .select("id, event_title, event_date, participants, created_at")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return (data as unknown as AttendanceListRow[]).map((r) => ({
        id: r.id,
        eventTitle: r.event_title,
        eventDate: r.event_date,
        participants: r.participants ?? [],
        createdAt: r.created_at,
      }));
    },
  });
}

export function useCreateAttendanceList() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      eventTitle: string;
      eventDate: string;
      participants: AttendanceParticipant[];
    }) => {
      const { error } = await supabase.from("attendance_lists").insert({
        event_title: input.eventTitle,
        event_date: input.eventDate,
        participants: input.participants,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceListKeys.list() }),
  });
}
