import { createFileRoute } from "@tanstack/react-router";
import { ProcessoDetailPage } from "@/components/processos/detalhe";

export const Route = createFileRoute("/processos/$id")({
  component: ProcessoDetailPage,
});
