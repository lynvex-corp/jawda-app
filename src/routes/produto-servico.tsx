import { createFileRoute } from "@tanstack/react-router";
import { ProdutoServicoPage } from "@/components/producao/produto-servico";
import { ModuleGate } from "@/components/app/module-gate";

function ProdutoServicoRoute() {
  return (
    <ModuleGate module="production">
      <ProdutoServicoPage />
    </ModuleGate>
  );
}

export const Route = createFileRoute("/produto-servico")({
  head: () => ({
    meta: [
      { title: "Produto ou Serviço | Jáwda" },
      {
        name: "description",
        content:
          "Acompanhe cada demanda de produto ou serviço do requisito do cliente até a entrega, com etapas, responsáveis e comparação pedido × entrega.",
      },
      { property: "og:title", content: "Produto ou Serviço | Jáwda" },
      {
        property: "og:description",
        content:
          "Cards de demanda com etapas, responsáveis, filtro rápido por status e atalho para registrar não conformidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProdutoServicoRoute,
});
