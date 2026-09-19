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
    mutationFn: async ({ id }: { id: string }) => {
      assertNotReadOnly();
      const { data, error } = await supabase.rpc("formalize_quality_policy", { p_id: id });
      if (error) throw error;
      return data as { version_label: string | null };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qualityPolicyKeys.all }),
  });
}

/** Bloco 7, item 4: sai do rascunho sem formalizar nada — marca
 * 'descartada' no banco (nunca some, seção 20 do Guia) e a tela volta a
 * mostrar a última versão formalizada. */
export function useDiscardQualityPolicyDraft() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("discard_quality_policy_draft", { p_id: id });
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
      const { data, error } = await supabase
        .from("documents")
        .insert({
          code: input.code,
          title: input.title,
          type: input.type,
          responsible_id: input.responsibleId,
          elaborador_id: input.elaboradorId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.list() }),
  });
}

/** Grava no documento a referência do arquivo da revisão 01 (Bloco 3, item
 * 2). Fica separado do insert porque o path do Storage precisa do id, que
 * só existe depois que a linha nasce. Se o upload falhar, o documento
 * continua válido e o arquivo pode entrar depois, por uma revisão. */
export function useSetDocumentFile() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentId,
      storedValue,
    }: {
      documentId: string;
      storedValue: string;
    }) => {
      assertNotReadOnly();
      const { error } = await supabase
        .from("documents")
        .update({ file_url: storedValue })
        .eq("id", documentId);
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

/** Participante vindo de Cargos e Perfis (Bloco 3, item 1). Substitui o
 * jsonb de texto livre, que não tinha como identificar a pessoa nem
 * receber confirmação individual. */
export interface EventParticipant {
  id: string;
  employeeId: string;
  employeeName: string;
  jobPositionName: string | null;
  /** null = colaborador sem conta no sistema; não recebe notificação e não
   * tem como confirmar pela plataforma. */
  linkedUserId: string | null;
  confirmed: boolean;
  confirmedAt: string | null;
}

export interface MeetingMinute {
  id: string;
  title: string;
  meetingDate: string;
  meetingTime: string | null;
  speakerName: string | null;
  folder: string | null;
  /** Registros anteriores ao Bloco 3, em texto livre. Mantido só para
   * histórico — o que nasce agora usa `participantRows`. */
  participants: MeetingParticipant[];
  participantRows: EventParticipant[];
  agenda: string;
  deliberations: string;
  attachmentUrl: string | null;
  createdAt: string;
}

const meetingMinutesKeys = {
  all: ["meeting-minutes"] as const,
  list: () => [...meetingMinutesKeys.all, "list"] as const,
};

/** Embed dos participantes normalizados, igual nos dois módulos. */
const PARTICIPANT_EMBED =
  "id, confirmed, confirmed_at, employee:employees!employee_id(id, nome, linked_user_id, job_position:job_positions!job_position_id(nome))";

interface ParticipantRow {
  id: string;
  confirmed: boolean;
  confirmed_at: string | null;
  employee: {
    id: string;
    nome: string;
    linked_user_id: string | null;
    job_position: { nome: string } | null;
  } | null;
}

function mapParticipant(r: ParticipantRow): EventParticipant {
  return {
    id: r.id,
    employeeId: r.employee?.id ?? "",
    employeeName: r.employee?.nome ?? "Colaborador",
    jobPositionName: r.employee?.job_position?.nome ?? null,
    linkedUserId: r.employee?.linked_user_id ?? null,
    confirmed: r.confirmed,
    confirmedAt: r.confirmed_at,
  };
}

const MEETING_MINUTE_SELECT =
  "id, title, meeting_date, meeting_time, speaker_name, folder, participants, agenda, deliberations, attachment_url, created_at, " +
  `participant_rows:meeting_minute_participants(${PARTICIPANT_EMBED})`;

interface MeetingMinuteRow {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  speaker_name: string | null;
  folder: string | null;
  participants: MeetingParticipant[];
  participant_rows: ParticipantRow[] | null;
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
    meetingTime: row.meeting_time,
    speakerName: row.speaker_name,
    folder: row.folder,
    participants: row.participants ?? [],
    participantRows: (row.participant_rows ?? []).map(mapParticipant),
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
        .select(MEETING_MINUTE_SELECT)
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
      meetingTime: string | null;
      speakerName: string | null;
      folder: string | null;
      employeeIds: string[];
      agenda: string;
      deliberations: string;
    }) => {
      assertNotReadOnly();
      // RPC em vez de dois inserts: ata e participantes têm que nascer na
      // mesma transação. Se o insert dos participantes falhasse depois do
      // da ata, sobraria uma ata vazia — e meeting_minutes tem policy
      // no_update, então não daria para consertar o registro.
      const { error } = await supabase.rpc("create_meeting_minute_with_participants", {
        p_title: input.title,
        p_meeting_date: input.meetingDate,
        p_agenda: input.agenda,
        p_deliberations: input.deliberations,
        p_employee_ids: input.employeeIds,
        p_meeting_time: input.meetingTime,
        p_speaker_name: input.speakerName,
        p_folder: input.folder,
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
  eventTime: string | null;
  speakerName: string | null;
  folder: string | null;
  /** Texto livre, anterior ao Bloco 3. Só histórico. */
  participants: AttendanceParticipant[];
  participantRows: EventParticipant[];
  createdAt: string;
}

const attendanceListKeys = {
  all: ["attendance-lists"] as const,
  list: () => [...attendanceListKeys.all, "list"] as const,
};

const ATTENDANCE_LIST_SELECT =
  "id, event_title, event_date, event_time, speaker_name, folder, participants, created_at, " +
  `participant_rows:attendance_list_participants(${PARTICIPANT_EMBED})`;

interface AttendanceListRow {
  id: string;
  event_title: string;
  event_date: string;
  event_time: string | null;
  speaker_name: string | null;
  folder: string | null;
  participants: AttendanceParticipant[];
  participant_rows: ParticipantRow[] | null;
  created_at: string;
}

export function useAttendanceLists() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: attendanceListKeys.list(),
    queryFn: async (): Promise<AttendanceList[]> => {
      const { data, error } = await supabase
        .from("attendance_lists")
        .select(ATTENDANCE_LIST_SELECT)
        .order("event_date", { ascending: false });
      if (error) throw error;
      return (data as unknown as AttendanceListRow[]).map((r) => ({
        id: r.id,
        eventTitle: r.event_title,
        eventDate: r.event_date,
        eventTime: r.event_time,
        speakerName: r.speaker_name,
        folder: r.folder,
        participants: r.participants ?? [],
        participantRows: (r.participant_rows ?? []).map(mapParticipant),
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
      eventTime: string | null;
      speakerName: string | null;
      folder: string | null;
      employeeIds: string[];
    }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("create_attendance_list_with_participants", {
        p_event_title: input.eventTitle,
        p_event_date: input.eventDate,
        p_employee_ids: input.employeeIds,
        p_event_time: input.eventTime,
        p_speaker_name: input.speakerName,
        p_folder: input.folder,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attendanceListKeys.list() }),
  });
}

/* ============================================================
 * Confirmação individual de presença (Bloco 3, item 4)
 *
 * Só o próprio participante confirma a si mesmo — a policy
 * *_confirm_self (linked_user_id = auth.uid()) é quem garante isso. As RPCs
 * são security invoker justamente para não contornar essa checagem.
 * ============================================================ */

export function useConfirmMeetingAttendance() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (participantId: string) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("confirm_meeting_attendance", {
        p_participant_id: participantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingMinutesKeys.list() });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useConfirmAttendanceListPresence() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (participantId: string) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("confirm_attendance_list_presence", {
        p_participant_id: participantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceListKeys.list() });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/* ============================================================
 * Arquivo de documento (Bloco 3, item 2)
 *
 * Antes NADA em Documentos subia arquivo de verdade — nem interno nem
 * externo. O campo era um textarea onde se colava um link ou o texto da
 * revisão. Agora sobe para o Storage.
 *
 * Bucket `evidencias`, o mesmo já usado por auditorias: o comentário da
 * migração que o criou (20260729160400) diz explicitamente que é bucket
 * compartilhado entre módulos, com o módulo indo no path. Bucket dedicado
 * só se justifica quando o conteúdo é mais sensível que o padrão — foi o
 * caso de `pessoas-dossie` (ASO, documento pessoal), não é o caso aqui.
 *
 * Convenção de path (regra 5 da skill jawda-multitenant):
 * {org_id}/documentos/{document_id}/{revisao}/{timestamp}-{arquivo}
 *
 * O valor gravado leva o prefixo `storage:` para distinguir de um link
 * colado ou de texto puro — os três convivem no mesmo campo, inclusive nos
 * registros que já existiam antes desta mudança.
 * ============================================================ */

const STORAGE_PREFIX = "storage:";

export function isStoredFile(value: string | null): boolean {
  return !!value && value.startsWith(STORAGE_PREFIX);
}

/** Nome legível a partir do path — o path carrega `{timestamp}-{arquivo}`,
 * então basta remover o carimbo. */
export function storedFileName(value: string): string {
  const path = value.slice(STORAGE_PREFIX.length);
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d+-/, "");
}

export function useUploadDocumentFile() {
  const supabase = getSupabaseBrowserClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      documentId,
      revision,
      file,
    }: {
      orgId: string;
      documentId: string;
      revision: number;
      file: File;
    }): Promise<string> => {
      assertNotReadOnly();
      const path = `${orgId}/documentos/${documentId}/${revision}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("evidencias").upload(path, file);
      if (error) throw error;
      return `${STORAGE_PREFIX}${path}`;
    },
  });
}

/** URL assinada de curta duração para abrir o arquivo. Igual ao padrão do
 * dossiê de Pessoas — o bucket é privado, então não existe URL pública. */
export function useDocumentFileUrl() {
  const supabase = getSupabaseBrowserClient();
  return useMutation({
    mutationFn: async (storedValue: string): Promise<string> => {
      const path = storedValue.slice(STORAGE_PREFIX.length);
      const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(path, 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/* ============================================================
 * Reverter revogação (Bloco 3, item 3)
 * ============================================================ */

export interface RevocationReversal {
  id: string;
  justification: string;
  reversedByName: string | null;
  reversedAt: string;
}

export function useDocumentRevocationReversals(documentId: string | null) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: [...documentKeys.all, "reversals", documentId ?? null],
    enabled: !!documentId,
    queryFn: async (): Promise<RevocationReversal[]> => {
      if (!documentId) return [];
      const { data, error } = await supabase
        .from("document_revocation_reversals")
        .select("id, justification, reversed_at, author:profiles!reversed_by(full_name)")
        .eq("document_id", documentId)
        .order("reversed_at", { ascending: false });
      if (error) throw error;
      return (
        data as unknown as {
          id: string;
          justification: string;
          reversed_at: string;
          author: { full_name: string } | null;
        }[]
      ).map((r) => ({
        id: r.id,
        justification: r.justification,
        reversedByName: r.author?.full_name ?? null,
        reversedAt: r.reversed_at,
      }));
    },
  });
}

export function useReverseDocumentRevocation() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentId,
      justification,
    }: {
      documentId: string;
      justification: string;
    }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("reverse_document_revocation", {
        p_document_id: documentId,
        p_justification: justification,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.all }),
  });
}
