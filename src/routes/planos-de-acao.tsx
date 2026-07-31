import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/planos-de-acao")({
  component: () => (
    <ModuleGate module="action_plan">
      <Outlet />
    </ModuleGate>
  ),
});
