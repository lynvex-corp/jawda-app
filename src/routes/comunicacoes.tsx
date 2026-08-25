import { createFileRoute } from "@tanstack/react-router";
import { ComunicacoesPage } from "@/components/comunicacoes/page";
import { ModuleGate } from "@/components/app/module-gate";

function ComunicacoesRoute() {
  return (
    <ModuleGate module="communications">
      <ComunicacoesPage />
    </ModuleGate>
  );
}

export const Route = createFileRoute("/comunicacoes")({
  head: () => ({
    meta: [
      { title: "Comunicações · Jáwda" },
      {
        name: "description",
        content:
          "Processo de comunicação e disparo de comunicados internos e externos, com códigos COM_INT/COM_EXT e registro de ciência.",
      },
      { property: "og:title", content: "Comunicações · Jáwda" },
      {
        property: "og:description",
        content:
          "Documente o processo de comunicação e envie comunicados com controle de leitura e ciência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComunicacoesRoute,
});
