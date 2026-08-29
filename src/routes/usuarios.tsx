import { createFileRoute } from "@tanstack/react-router";
import { UsuariosPage } from "@/components/usuarios/page";

export const Route = createFileRoute("/usuarios")({
  component: UsuariosPage,
});
