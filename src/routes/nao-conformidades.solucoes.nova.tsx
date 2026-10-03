import { createFileRoute } from "@tanstack/react-router";
import { SolucaoProblemasForm } from "@/components/nao-conformidades/solucao-problemas/form";

/** ?ncId= — "Gerar Solução de Problemas a partir desta NC". */
type NovaSolucaoSearch = {
  ncId?: string;
};

export const Route = createFileRoute("/nao-conformidades/solucoes/nova")({
  validateSearch: (search: Record<string, unknown>): NovaSolucaoSearch => ({
    ncId: typeof search.ncId === "string" ? search.ncId : undefined,
  }),
  component: NovaSolucaoPage,
});

function NovaSolucaoPage() {
  const { ncId } = Route.useSearch();
  return <SolucaoProblemasForm ncId={ncId} />;
}
