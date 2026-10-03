import { createFileRoute } from "@tanstack/react-router";
import { SolucaoProblemasForm } from "@/components/nao-conformidades/solucao-problemas/form";

export const Route = createFileRoute("/nao-conformidades/solucoes/$id")({
  component: SolucaoDetalhePage,
});

function SolucaoDetalhePage() {
  const { id } = Route.useParams();
  return <SolucaoProblemasForm solutionId={id} />;
}
