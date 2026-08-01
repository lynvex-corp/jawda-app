import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";

/* ============================================================
 * Tipos do banco (ver supabase/migrations/20260801100000_support_tables.sql)
 * ============================================================ */

export type SupportTicketType =
  | "duvida"
  | "erro_bug"
  | "melhoria"
  | "suporte_metodologico"
  | "treinamento";

export type SupportTicketPriority = "baixa" | "media" | "alta" | "critica";

export type SupportTicketStatus =
  | "aberto"
  | "em_atendimento"
  | "aguardando_cliente"
  | "resolvido"
  | "fechado";

export interface SupportTicket {
  id: string;
  number: number;
  orgId: string;
  openedBy: string;
  subject: string;
  type: SupportTicketType;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assignedStaffId: string | null;
  slaDeadline: string;
  csatRating: number | null;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderType: "client" | "staff";
  senderId: string;
  message: string;
  attachmentUrl: string | null;
  createdAt: string;
}

const TICKET_SELECT =
  "id, number, org_id, opened_by, subject, type, priority, status, assigned_staff_id, sla_deadline, csat_rating, created_at, first_response_at, resolved_at, closed_at";

interface TicketDbRow {
  id: string;
  number: number;
  org_id: string;
  opened_by: string;
  subject: string;
  type: SupportTicketType;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assigned_staff_id: string | null;
  sla_deadline: string;
  csat_rating: number | null;
  created_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
}

function mapRowToTicket(row: TicketDbRow): SupportTicket {
  return {
    id: row.id,
    number: row.number,
    orgId: row.org_id,
    openedBy: row.opened_by,
    subject: row.subject,
    type: row.type,
    priority: row.priority,
    status: row.status,
    assignedStaffId: row.assigned_staff_id,
    slaDeadline: row.sla_deadline,
    csatRating: row.csat_rating,
    createdAt: row.created_at,
    firstResponseAt: row.first_response_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
  };
}

interface MessageDbRow {
  id: string;
  ticket_id: string;
  sender_type: "client" | "staff";
  sender_id: string;
  message: string;
  attachment_url: string | null;
  created_at: string;
}

function mapRowToMessage(row: MessageDbRow): SupportMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    senderType: row.sender_type,
    senderId: row.sender_id,
    message: row.message,
    attachmentUrl: row.attachment_url,
    createdAt: row.created_at,
  };
}

/* ============================================================
 * Query keys
 * ============================================================ */

export const supportKeys = {
  all: ["support"] as const,
  tickets: () => [...supportKeys.all, "tickets"] as const,
  ticket: (id: string) => [...supportKeys.all, "ticket", id] as const,
  messages: (ticketId: string) => [...supportKeys.all, "messages", ticketId] as const,
};

/* ============================================================
 * Hooks — cliente
 * ============================================================ */

export function useMyTickets() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: supportKeys.tickets(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(TICKET_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as TicketDbRow[]).map(mapRowToTicket);
    },
  });
}

export interface CreateTicketInput {
  subject: string;
  type: SupportTicketType;
  description: string;
}

/** Cria o ticket e já registra a descrição como primeira mensagem da
 * thread — support_tickets não tem coluna de descrição própria (só
 * `subject`), o conteúdo do chamado nasce como support_messages. */
export function useCreateTicket() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({ subject: input.subject, type: input.type })
        .select(TICKET_SELECT)
        .single();
      if (ticketError) throw ticketError;

      const { error: messageError } = await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_type: "client",
        sender_id: user.id,
        message: input.description,
      });
      if (messageError) throw messageError;

      return mapRowToTicket(ticket as unknown as TicketDbRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.tickets() });
    },
  });
}

export function useTicketMessages(ticketId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: supportKeys.messages(ticketId ?? ""),
    enabled: Boolean(ticketId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id, ticket_id, sender_type, sender_id, message, attachment_url, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as MessageDbRow[]).map(mapRowToMessage);
    },
  });
}

export function useSendMessage() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ticketId,
      message,
      attachmentUrl,
    }: {
      ticketId: string;
      message: string;
      attachmentUrl?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const { data, error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: ticketId,
          sender_type: "client",
          sender_id: user.id,
          message,
          attachment_url: attachmentUrl ?? null,
        })
        .select("id, ticket_id, sender_type, sender_id, message, attachment_url, created_at")
        .single();
      if (error) throw error;

      // Cliente respondendo tira o ticket de 'aguardando_cliente'.
      await supabase
        .from("support_tickets")
        .update({ status: "em_atendimento" })
        .eq("id", ticketId)
        .eq("status", "aguardando_cliente");

      return mapRowToMessage(data as unknown as MessageDbRow);
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: supportKeys.messages(message.ticketId) });
      queryClient.invalidateQueries({ queryKey: supportKeys.ticket(message.ticketId) });
      queryClient.invalidateQueries({ queryKey: supportKeys.tickets() });
    },
  });
}

/** Fecha o ciclo do chamado 'resolvido' → 'fechado' junto com a nota de
 * satisfação — csat_rating só é pedido nesse momento (seção do prompt:
 * "cliente vê prompt para avaliar antes de considerar fechado"). */
export function useRateSatisfaction() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, rating }: { ticketId: string; rating: number }) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .update({ csat_rating: rating, status: "fechado" })
        .eq("id", ticketId)
        .select(TICKET_SELECT)
        .single();
      if (error) throw error;
      return mapRowToTicket(data as unknown as TicketDbRow);
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: supportKeys.tickets() });
      queryClient.setQueryData(supportKeys.ticket(ticket.id), ticket);
    },
  });
}
