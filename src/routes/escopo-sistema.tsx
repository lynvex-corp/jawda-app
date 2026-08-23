import { createFileRoute } from "@tanstack/react-router";
import { EscopoSistemaPage } from "@/components/estrategia/escopo-sistema";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/escopo-sistema")({
  component: () => (
    <ModuleGate module="strategy">
      <EscopoSistemaPage />
    </ModuleGate>
  ),
});
