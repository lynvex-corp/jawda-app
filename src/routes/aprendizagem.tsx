import { createFileRoute } from "@tanstack/react-router";
import { AprendizagemPage } from "@/components/pessoas/aprendizagem";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/aprendizagem")({
  component: () => (
    <ModuleGate module="people">
      <AprendizagemPage />
    </ModuleGate>
  ),
});
