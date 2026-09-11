import { createFileRoute } from "@tanstack/react-router";
import { AnaliseCriticaDetailPage } from "@/components/estrategia/analise-critica/detalhe";

export const Route = createFileRoute("/documentos/analise-critica/$id")({
  head: () => ({
    meta: [{ title: "Análise Crítica pela Direção — Jawda" }],
  }),
  component: AnaliseCriticaDetailPage,
});
