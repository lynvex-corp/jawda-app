import { createFileRoute } from "@tanstack/react-router";
import { IndicadorDetalhe } from "@/components/kpis/detalhe";

function DetalheRoute() {
  const { id } = Route.useParams();
  return <IndicadorDetalhe id={id} />;
}

export const Route = createFileRoute("/indicadores/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do indicador — Jáwda" },
      {
        name: "description",
        content: "Histórico de medições, análise por período, configuração e trilha do indicador.",
      },
      { property: "og:title", content: "Detalhe do indicador — Jáwda" },
      {
        property: "og:description",
        content: "Histórico de medições, análise por período, configuração e trilha do indicador.",
      },
    ],
  }),
  component: DetalheRoute,
});
