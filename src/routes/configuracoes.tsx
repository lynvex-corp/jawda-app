import { createFileRoute } from "@tanstack/react-router";
import { ConfiguracoesPage } from "@/components/configuracoes/page";

export const Route = createFileRoute("/configuracoes")({
  component: ConfiguracoesPage,
});
