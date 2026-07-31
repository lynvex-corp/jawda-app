import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/indicadores")({
  head: () => ({
    meta: [
      { title: "Indicadores e KPIs — Jáwda" },
      {
        name: "description",
        content: "Painel de indicadores, objetivos da qualidade e análise crítica do SGQ.",
      },
      { property: "og:title", content: "Indicadores e KPIs — Jáwda" },
      {
        property: "og:description",
        content: "Painel de indicadores, objetivos da qualidade e análise crítica do SGQ.",
      },
    ],
  }),
  component: () => (
    <ModuleGate module="indicators">
      <Outlet />
    </ModuleGate>
  ),
});
