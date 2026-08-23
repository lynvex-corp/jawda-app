import { createFileRoute } from "@tanstack/react-router";
import { MudancasSGPage } from "@/components/estrategia/mudancas-sg";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/mudancas-sg")({
  component: () => (
    <ModuleGate module="strategy">
      <MudancasSGPage />
    </ModuleGate>
  ),
});
