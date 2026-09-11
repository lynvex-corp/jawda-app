import { createFileRoute } from "@tanstack/react-router";
import { ProcessosPage } from "@/components/processos/page";

export const Route = createFileRoute("/processos/")({
  component: ProcessosPage,
});
