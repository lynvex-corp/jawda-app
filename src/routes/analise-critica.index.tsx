import { createFileRoute } from "@tanstack/react-router";
import { AnaliseCriticaPage } from "@/components/estrategia/analise-critica/page";

export const Route = createFileRoute("/analise-critica/")({
  component: AnaliseCriticaPage,
});
