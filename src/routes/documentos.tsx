import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleGate } from "@/components/app/module-gate";

const title = "Documentos — Jawda SGQ";
const description =
  "Controle de documentos internos, externos e repositório: permissões de alteração e redação, histórico de revisões, obsolescência e política de backup.";

// Vira rota de layout no Bloco 3: a Análise Crítica pela Direção passou a
// viver dentro de Documentos, com detalhe em rota própria
// (/documentos/analise-critica/$id). O ModuleGate sobe para cá para valer
// em toda a árvore — a análise crítica exigia o módulo `strategy` antes, e
// agora exige `documents`, junto com o resto da seção.
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
  component: () => (
    <ModuleGate module="documents">
      <Outlet />
    </ModuleGate>
  ),
});
