import { createFileRoute } from "@tanstack/react-router";
import { AnaliseCriticaDetailPage } from "@/components/estrategia/analise-critica/detalhe";

export const Route = createFileRoute("/analise-critica/$id")({
  component: AnaliseCriticaDetailPage,
});
