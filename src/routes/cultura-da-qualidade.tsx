import { createFileRoute } from "@tanstack/react-router";
import { CulturaDaQualidadePage } from "@/components/estrategia/cultura-da-qualidade";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/cultura-da-qualidade")({
  component: () => (
    <ModuleGate module="strategy">
      <CulturaDaQualidadePage />
    </ModuleGate>
  ),
});
