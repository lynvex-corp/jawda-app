import { createFileRoute } from "@tanstack/react-router";
import { PlanoDetailPage } from "@/components/planos-de-acao/detalhe";

export const Route = createFileRoute("/planos-de-acao/$id")({
  component: PlanoDetailPage,
});
