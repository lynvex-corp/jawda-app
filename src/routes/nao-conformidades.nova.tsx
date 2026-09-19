import { createFileRoute } from "@tanstack/react-router";
import { NovaNCWizard } from "@/components/nao-conformidades/nova-wizard";

/** Bloco 10, itens 7 e 9: "Editar"/"retomar de onde parou" reabrem o
 * mesmo wizard com ?ncId= — reaproveita o mecanismo já usado por
 * /planos-de-acao/novo (ncId) em vez de criar uma rota nova. */
type NovaNCSearch = {
  ncId?: string;
};

export const Route = createFileRoute("/nao-conformidades/nova")({
  validateSearch: (search: Record<string, unknown>): NovaNCSearch => ({
    ncId: typeof search.ncId === "string" ? search.ncId : undefined,
  }),
  component: NovaNCWizard,
});
