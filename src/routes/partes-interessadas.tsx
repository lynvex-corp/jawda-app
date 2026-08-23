import { createFileRoute } from "@tanstack/react-router";
import { PartesInteressadasPage } from "@/components/estrategia/partes-interessadas";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/partes-interessadas")({
  component: () => (
    <ModuleGate module="strategy">
      <PartesInteressadasPage />
    </ModuleGate>
  ),
});
