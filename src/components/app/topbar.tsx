import { Search, ChevronDown, Download, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "./theme-toggle";
import { NotificationsDrawer } from "./notifications-drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useExportOrganizationData } from "@/lib/queries/org-access";
import { getErrorMessage } from "@/lib/utils";

const CARGO_POR_PAPEL: Record<string, string> = {
  admin: "Administrador do Cliente",
  quality_manager: "Gerente da Qualidade",
  auditor: "Auditor",
  area_manager: "Gestor de Área",
  collaborator: "Colaborador",
  viewer: "Somente Leitura",
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeiras = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : [partes[0]];
  return primeiras.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function Topbar() {
  const navigate = useNavigate();
  const { profile, currentOrg, organizations, signOut, switchOrganization } = useAuth();
  const exportData = useExportOrganizationData();

  const nome = profile?.full_name ?? "…";
  const cargo = currentOrg ? (CARGO_POR_PAPEL[currentOrg.role] ?? currentOrg.role) : "";

  async function handleLogout() {
    await signOut();
    navigate({ to: "/login" });
  }

  function handleExport() {
    exportData.mutate(undefined, {
      onSuccess: () => toast.success("Exportação gerada", { description: "Download iniciado." }),
      onError: (err) =>
        toast.error("Não foi possível exportar", { description: getErrorMessage(err) }),
    });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

      {organizations.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="hidden h-9 gap-2 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-brand-soft/60 md:inline-flex"
            >
              {currentOrg?.trade_name || currentOrg?.legal_name || "Selecionar empresa"}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Trocar empresa</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.org_id}
                disabled={org.is_current}
                onClick={() => switchOrganization(org.org_id)}
              >
                {org.trade_name || org.legal_name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="relative ml-auto hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar NCs, documentos, auditorias…"
          className="h-9 rounded-lg border-border bg-muted/40 pl-9 text-sm focus-visible:bg-background"
        />
      </div>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <ThemeToggle />
        <NotificationsDrawer />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-brand-soft/60">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-brand text-brand-foreground text-xs font-semibold">
                {profile ? iniciais(profile.full_name) : "…"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left md:block">
              <div className="text-xs font-medium leading-tight">{nome}</div>
              <div className="text-[11px] text-muted-foreground leading-tight">{cargo}</div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" /> Meu perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExport} disabled={exportData.isPending}>
            <Download className="mr-2 h-4 w-4" /> Exportar meus dados
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
