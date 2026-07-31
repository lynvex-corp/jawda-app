import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/nao-conformidades")({
  component: () => (
    <ModuleGate module="non_conformity">
      <Outlet />
    </ModuleGate>
  ),
});
