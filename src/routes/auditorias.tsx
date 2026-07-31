import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/auditorias")({
  component: () => (
    <ModuleGate module="audit">
      <Outlet />
    </ModuleGate>
  ),
});
