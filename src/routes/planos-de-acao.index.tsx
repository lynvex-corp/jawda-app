import { createFileRoute } from "@tanstack/react-router";
import { PlanosDeAcaoPage } from "@/components/planos-de-acao/page";

export const Route = createFileRoute("/planos-de-acao/")({
  component: PlanosDeAcaoPage,
});
