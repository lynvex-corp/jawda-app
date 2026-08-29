import { createFileRoute } from "@tanstack/react-router";
import { NovaNCWizard } from "@/components/nao-conformidades/nova-wizard";

export const Route = createFileRoute("/nao-conformidades/nova")({
  component: NovaNCWizard,
});
