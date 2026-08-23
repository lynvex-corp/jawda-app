import { createFileRoute } from "@tanstack/react-router";
import { AnaliseCenarioPage } from "@/components/estrategia/analise-cenario";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/analise-cenario")({
  component: () => (
    <ModuleGate module="strategy">
      <AnaliseCenarioPage />
    </ModuleGate>
  ),
});
