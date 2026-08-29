import { createFileRoute } from "@tanstack/react-router";
import { TreinamentosPage } from "@/components/treinamentos/page";

export const Route = createFileRoute("/treinamentos")({
  component: TreinamentosPage,
});
