import { createFileRoute } from "@tanstack/react-router";
import { DiretrizesEstrategicasPage } from "@/components/estrategia/diretrizes-estrategicas";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/diretrizes-estrategicas")({
  component: () => (
    <ModuleGate module="strategy">
      <DiretrizesEstrategicasPage />
    </ModuleGate>
  ),
});
