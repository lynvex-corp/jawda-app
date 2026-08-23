import { createFileRoute } from "@tanstack/react-router";
import { RiscosPage } from "@/components/riscos/page";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/riscos")({
  component: () => (
    <ModuleGate module="strategy">
      <RiscosPage />
    </ModuleGate>
  ),
});
