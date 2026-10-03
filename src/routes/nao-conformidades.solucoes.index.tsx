import { createFileRoute } from "@tanstack/react-router";
import { SolucoesProblemasPage } from "@/components/nao-conformidades/solucao-problemas/page";

export const Route = createFileRoute("/nao-conformidades/solucoes/")({
  component: SolucoesProblemasPage,
});
