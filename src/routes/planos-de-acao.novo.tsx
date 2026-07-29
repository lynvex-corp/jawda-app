import { createFileRoute } from "@tanstack/react-router";
import { NovoPlanoWizard } from "@/components/planos-de-acao/nova-wizard";

type NovoPlanoSearch = {
  origem?: string;
  vinculado?: string;
  ncId?: string;
  problema?: string;
};

export const Route = createFileRoute("/planos-de-acao/novo")({
  validateSearch: (search: Record<string, unknown>): NovoPlanoSearch => ({
    origem: typeof search.origem === "string" ? search.origem : undefined,
    vinculado: typeof search.vinculado === "string" ? search.vinculado : undefined,
    ncId: typeof search.ncId === "string" ? search.ncId : undefined,
    problema: typeof search.problema === "string" ? search.problema : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Novo Plano de Ação | Jáwda" },
      {
        name: "description",
        content:
          "Cadastre ações corretivas 5W2H individuais, com contingência imediata, prazo e responsável por ação.",
      },
      { property: "og:title", content: "Novo Plano de Ação | Jáwda" },
      {
        property: "og:description",
        content: "Ações corretivas 5W2H com prazo e responsável definidos ação por ação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovoPlanoWizard,
});
