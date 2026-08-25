import { createFileRoute } from "@tanstack/react-router";
import { ProcessosPage } from "@/components/processos/page";
import { ModuleGate } from "@/components/app/module-gate";

function ProcessosRoute() {
  return (
    <ModuleGate module="processes">
      <ProcessosPage />
    </ModuleGate>
  );
}

export const Route = createFileRoute("/processos")({
  component: ProcessosRoute,
});
