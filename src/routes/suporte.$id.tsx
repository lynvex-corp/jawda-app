import { createFileRoute } from "@tanstack/react-router";
import { SupportTicketDetailPage } from "@/components/suporte/detalhe";

export const Route = createFileRoute("/suporte/$id")({
  component: SupportTicketDetailPage,
});
