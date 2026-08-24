import { createFileRoute } from "@tanstack/react-router";
import { PerformancePage } from "@/components/pessoas/performance";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/avaliacao-performance")({
  component: () => (
    <ModuleGate module="people">
      <PerformancePage />
    </ModuleGate>
  ),
});
