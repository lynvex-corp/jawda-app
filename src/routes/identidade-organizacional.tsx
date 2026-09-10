import { createFileRoute } from "@tanstack/react-router";
import { IdentidadeOrganizacionalPage } from "@/components/identidade/page";
import { ModuleGate } from "@/components/app/module-gate";

export const Route = createFileRoute("/identidade-organizacional")({
  head: () => ({
    meta: [
      { title: "Identidade Organizacional — Jawda" },
      {
        name: "description",
        content:
          "Apresentação da empresa, Política da Qualidade e diretrizes de Missão, Visão, Valores e Propósito.",
      },
    ],
  }),
  component: () => (
    <ModuleGate module="strategy">
      <IdentidadeOrganizacionalPage />
    </ModuleGate>
  ),
});
