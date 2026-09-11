import { createFileRoute } from "@tanstack/react-router";
import { DocumentosPage } from "@/components/documentos/page";

export const Route = createFileRoute("/documentos/")({
  component: DocumentosPage,
});
