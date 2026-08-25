import { createFileRoute } from "@tanstack/react-router";
import { DocumentosPage } from "@/components/documentos/page";
import { ModuleGate } from "@/components/app/module-gate";

function DocumentosRoute() {
  return (
    <ModuleGate module="documents">
      <DocumentosPage />
    </ModuleGate>
  );
}

const title = "Documentos — Jáwda SGQ";
const description =
  "Controle de documentos internos, externos e repositório: permissões de alteração e redação, histórico de revisões, obsolescência e política de backup.";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocumentosRoute,
});
