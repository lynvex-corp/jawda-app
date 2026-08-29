import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Send, Star } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  useMyTickets,
  useTicketMessages,
  useSendMessage,
  useRateSatisfaction,
  type SupportTicketType,
  type SupportTicketStatus,
} from "@/lib/queries/support";

const TYPE_LABEL: Record<SupportTicketType, string> = {
  duvida: "Dúvida",
  erro_bug: "Erro / Bug",
  melhoria: "Melhoria",
  suporte_metodologico: "Suporte Metodológico",
  treinamento: "Treinamento",
};

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  aberto: "Aberto",
  em_atendimento: "Em Atendimento",
  aguardando_cliente: "Aguardando Você",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CsatPrompt({ ticketId }: { ticketId: string }) {
  const [rating, setRating] = useState(0);
  const rate = useRateSatisfaction();

  return (
    <Card className="border-brand/30 bg-brand-soft/30">
      <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
        <p className="text-sm font-medium text-foreground">
          Seu chamado foi marcado como resolvido. Como foi o atendimento?
        </p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} aria-label={`${n} estrelas`}>
              <Star
                className={cn(
                  "h-7 w-7 transition",
                  n <= rating
                    ? "fill-[color:var(--warning)] text-[color:var(--warning)]"
                    : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
        </div>
        <Button
          className="bg-brand text-white hover:bg-brand/90"
          disabled={rating === 0 || rate.isPending}
          onClick={() =>
            rate.mutate(
              { ticketId, rating },
              {
                onSuccess: () => toast.success("Obrigado pela avaliação!"),
                onError: (err) =>
                  toast.error(err instanceof Error ? err.message : "Erro ao avaliar."),
              },
            )
          }
        >
          {rate.isPending ? "Enviando..." : "Enviar avaliação e fechar chamado"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function SupportTicketDetailPage() {
  const { id } = useParams({ from: "/suporte/$id" });
  const { data: tickets = [] } = useMyTickets();
  const ticket = tickets.find((t) => t.id === id);
  const { data: messages = [], isLoading: loadingMessages } = useTicketMessages(id);
  const sendMessage = useSendMessage();
  const [reply, setReply] = useState("");

  function handleSend() {
    if (!reply.trim() || !id) return;
    sendMessage.mutate(
      { ticketId: id, message: reply.trim() },
      {
        onSuccess: () => setReply(""),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Erro ao enviar mensagem."),
      },
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[900px] space-y-5">
        <Link
          to="/suporte"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Suporte
        </Link>

        {ticket && (
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {ticket.subject}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {TYPE_LABEL[ticket.type]} · Aberto em {formatDateTime(ticket.createdAt)}
              </p>
            </div>
            <Badge variant="outline">{STATUS_LABEL[ticket.status]}</Badge>
          </header>
        )}

        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            {loadingMessages && (
              <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex gap-2", m.senderType === "client" && "justify-end")}
              >
                {m.senderType === "staff" && (
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-brand text-[10px] font-semibold text-brand-foreground">
                      JA
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                    m.senderType === "client" ? "bg-brand text-brand-foreground" : "bg-muted",
                  )}
                >
                  <div className="mb-0.5 text-[10px] font-semibold opacity-70">
                    {m.senderType === "client" ? "Você" : "Equipe Jáwda"} ·{" "}
                    {formatDateTime(m.createdAt)}
                  </div>
                  {m.message}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {ticket?.status === "resolvido" && <CsatPrompt ticketId={ticket.id} />}

        {ticket && ticket.status !== "fechado" && (
          <div className="flex items-end gap-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escreva sua resposta..."
              rows={2}
              className="flex-1"
            />
            <Button
              className="bg-brand text-white hover:bg-brand/90"
              onClick={handleSend}
              disabled={sendMessage.isPending || !reply.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
