import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type CommunicationEntityType = "interna" | "externa";
export type CommunicationForm =
  | "aplicativo_mensagem"
  | "comunicacao_impressa"
  | "comunicacao_informal"
  | "comunicacao_virtual"
  | "dialogo_seguranca"
  | "email"
  | "quadro_aviso"
  | "reuniao_analise_critica"
  | "reuniao_rotina";
export type CommunicationWhenType = "data_especifica" | "sob_demanda";

/** Ordem alfabética (seção 21.7) — sem significado semântico entre as formas. */
export const COMMUNICATION_FORM_OPTIONS: { value: CommunicationForm; label: string }[] = [
  { value: "aplicativo_mensagem", label: "Aplicativo de mensagem" },
  { value: "comunicacao_impressa", label: "Comunicação impressa" },
  { value: "comunicacao_informal", label: "Comunicação informal" },
  { value: "comunicacao_virtual", label: "Comunicação virtual" },
  { value: "dialogo_seguranca", label: "Diálogo de segurança" },
  { value: "email", label: "E-mail" },
  { value: "quadro_aviso", label: "Quadro de aviso" },
  { value: "reuniao_analise_critica", label: "Reunião de análise crítica" },
  { value: "reuniao_rotina", label: "Reunião de rotina" },
];

/** Papéis usados como alvo de comunicação (mesmo enum de user_organizations.role).
 * "Todos" é exceção semântica — não é um papel, fica fixado primeiro. */
export const TARGET_PROFILE_OPTIONS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "admin", label: "Administrador do Cliente" },
  { value: "auditor", label: "Auditor" },
  { value: "collaborator", label: "Colaborador" },
  { value: "quality_manager", label: "Gestor da Qualidade" },
  { value: "area_manager", label: "Gestor de Área" },
  { value: "viewer", label: "Visualizador" },
];

const targetProfileLabel = new Map(TARGET_PROFILE_OPTIONS.map((o) => [o.value, o.label]));
export function labelForTargetProfile(value: string): string {
  return targetProfileLabel.get(value) ?? value;
}

/* ============================================================
 * Processos de Comunicação (o "plano")
 * ============================================================ */

export interface CommunicationProcess {
  id: string;
  type: CommunicationEntityType;
  description: string;
  form: CommunicationForm;
  communicatorName: string | null;
  whenType: CommunicationWhenType;
  scheduledDate: string | null;
  targetProfiles: string[];
  code: string;
  createdAt: string;
}

const communicationProcessKeys = {
  all: ["communication-processes"] as const,
  list: () => [...communicationProcessKeys.all, "list"] as const,
};

interface CommunicationProcessRow {
  id: string;
  type: CommunicationEntityType;
  description: string;
  form: CommunicationForm;
  communicator: { full_name: string } | null;
  when_type: CommunicationWhenType;
  scheduled_date: string | null;
  target_profiles: string[];
  code: string;
  created_at: string;
}

export function useCommunicationProcesses() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: communicationProcessKeys.list(),
    queryFn: async (): Promise<CommunicationProcess[]> => {
      const { data, error } = await supabase
        .from("communication_processes")
        .select(
          "id, type, description, form, communicator:profiles!communicator_id(full_name), " +
            "when_type, scheduled_date, target_profiles, code, created_at",
        )
        .order("code");
      if (error) throw error;
      return (data as unknown as CommunicationProcessRow[]).map((r) => ({
        id: r.id,
        type: r.type,
        description: r.description,
        form: r.form,
        communicatorName: r.communicator?.full_name ?? null,
        whenType: r.when_type,
        scheduledDate: r.scheduled_date,
        targetProfiles: r.target_profiles ?? [],
        code: r.code,
        createdAt: r.created_at,
      }));
    },
  });
}

export function useCreateCommunicationProcess() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type: CommunicationEntityType;
      description: string;
      form: CommunicationForm;
      communicatorId: string | null;
      whenType: CommunicationWhenType;
      scheduledDate: string | null;
      targetProfiles: string[];
    }) => {
      const { error } = await supabase.from("communication_processes").insert({
        type: input.type,
        description: input.description,
        form: input.form,
        communicator_id: input.communicatorId,
        when_type: input.whenType,
        scheduled_date: input.scheduledDate,
        target_profiles: input.targetProfiles,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communicationProcessKeys.list() }),
  });
}

/* ============================================================
 * Comunicações (disparo real)
 * ============================================================ */

export interface Communication {
  id: string;
  communicationProcessId: string | null;
  type: CommunicationEntityType;
  description: string;
  communicatorId: string;
  communicatorName: string | null;
  scheduledDatetime: string | null;
  isImmediate: boolean;
  externalName: string | null;
  externalEmails: string[] | null;
  targetProfiles: string[];
  sentAt: string | null;
  createdAt: string;
}

const communicationKeys = {
  all: ["communications"] as const,
  list: () => [...communicationKeys.all, "list"] as const,
  reads: (communicationId: string) => [...communicationKeys.all, communicationId, "reads"] as const,
  myAcknowledged: () => [...communicationKeys.all, "my-acknowledged"] as const,
};

interface CommunicationRow {
  id: string;
  communication_process_id: string | null;
  type: CommunicationEntityType;
  description: string;
  communicator_id: string;
  communicator: { full_name: string } | null;
  scheduled_datetime: string | null;
  is_immediate: boolean;
  external_name: string | null;
  external_emails: string[] | null;
  target_profiles: string[];
  sent_at: string | null;
  created_at: string;
}

function mapCommunication(r: CommunicationRow): Communication {
  return {
    id: r.id,
    communicationProcessId: r.communication_process_id,
    type: r.type,
    description: r.description,
    communicatorId: r.communicator_id,
    communicatorName: r.communicator?.full_name ?? null,
    scheduledDatetime: r.scheduled_datetime,
    isImmediate: r.is_immediate,
    externalName: r.external_name,
    externalEmails: r.external_emails,
    targetProfiles: r.target_profiles ?? [],
    sentAt: r.sent_at,
    createdAt: r.created_at,
  };
}

const COMMUNICATION_SELECT =
  "id, communication_process_id, type, description, communicator_id, " +
  "communicator:profiles!communicator_id(full_name), scheduled_datetime, is_immediate, " +
  "external_name, external_emails, target_profiles, sent_at, created_at";

export function useCommunications() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: communicationKeys.list(),
    queryFn: async (): Promise<Communication[]> => {
      const { data, error } = await supabase
        .from("communications")
        .select(COMMUNICATION_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as CommunicationRow[]).map(mapCommunication);
    },
  });
}

export function useCreateCommunication() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      communicationProcessId: string | null;
      type: CommunicationEntityType;
      description: string;
      isImmediate: boolean;
      scheduledDatetime: string | null;
      externalName: string | null;
      externalEmails: string[] | null;
      targetProfiles: string[];
    }) => {
      const { error } = await supabase.from("communications").insert({
        communication_process_id: input.communicationProcessId,
        type: input.type,
        description: input.description,
        is_immediate: input.isImmediate,
        scheduled_datetime: input.isImmediate ? null : input.scheduledDatetime,
        external_name: input.externalName,
        external_emails: input.externalEmails,
        target_profiles: input.targetProfiles,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communicationKeys.list() }),
  });
}

/** Quem já confirmou ciência de uma comunicação — visão do comunicador. */
export function useCommunicationReads(communicationId: string | null) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: communicationKeys.reads(communicationId ?? ""),
    enabled: !!communicationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_reads")
        .select(
          "recipient_user_id, acknowledged_at, recipient:profiles!recipient_user_id(full_name)",
        )
        .eq("communication_id", communicationId as string)
        .order("acknowledged_at", { ascending: false });
      if (error) throw error;
      return (
        data as unknown as {
          recipient_user_id: string;
          acknowledged_at: string | null;
          recipient: { full_name: string } | null;
        }[]
      ).map((r) => ({
        recipientUserId: r.recipient_user_id,
        acknowledgedAt: r.acknowledged_at,
        recipientName: r.recipient?.full_name ?? null,
      }));
    },
  });
}

/** IDs de comunicação já confirmados pelo próprio usuário logado — usado
 * pelo Quadro de Notificações pra saber o que ainda falta clicar "Ciente". */
export function useMyAcknowledgedCommunicationIds() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: communicationKeys.myAcknowledged(),
    queryFn: async (): Promise<Set<string>> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return new Set();
      const { data, error } = await supabase
        .from("communication_reads")
        .select("communication_id")
        .eq("recipient_user_id", user.id);
      if (error) throw error;
      return new Set(
        (data as unknown as { communication_id: string }[]).map((r) => r.communication_id),
      );
    },
  });
}

export function useAcknowledgeCommunication() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (communicationId: string) => {
      const { error } = await supabase
        .from("communication_reads")
        .insert({ communication_id: communicationId, acknowledged_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_, communicationId) => {
      queryClient.invalidateQueries({ queryKey: communicationKeys.myAcknowledged() });
      queryClient.invalidateQueries({ queryKey: communicationKeys.reads(communicationId) });
    },
  });
}
