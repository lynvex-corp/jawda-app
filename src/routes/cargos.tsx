import { createFileRoute } from "@tanstack/react-router";
import { CargosPage } from "@/components/pessoas/cargos";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/cargos")({
  component: () => (
    <ModuleGate module="people">
      <CargosPage />
    </ModuleGate>
  ),
});
