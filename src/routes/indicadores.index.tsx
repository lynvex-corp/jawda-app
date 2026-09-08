import { createFileRoute } from "@tanstack/react-router";
import { IndicadoresModule } from "@/components/kpis/module";

export const Route = createFileRoute("/indicadores/")({
  head: () => ({
    meta: [
      { title: "Painel de Indicadores e KPIs — Jawda" },
      {
        name: "description",
        content:
          "Acompanhe metas, semáforos, objetivos da qualidade e análise crítica por período.",
      },
      { property: "og:title", content: "Painel de Indicadores e KPIs — Jawda" },
      {
        property: "og:description",
        content:
          "Acompanhe metas, semáforos, objetivos da qualidade e análise crítica por período.",
      },
    ],
  }),
  component: IndicadoresModule,
});
