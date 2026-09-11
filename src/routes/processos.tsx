import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/processos")({
  component: () => (
    <ModuleGate module="processes">
      <Outlet />
    </ModuleGate>
  ),
});
