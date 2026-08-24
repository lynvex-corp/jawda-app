import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/analise-critica")({
  component: () => (
    <ModuleGate module="strategy">
      <Outlet />
    </ModuleGate>
  ),
});
