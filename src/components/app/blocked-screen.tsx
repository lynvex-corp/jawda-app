import { Download, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { JawdaLogo } from "@/components/brand/logo";
import { useAuth } from "@/hooks/use-auth";
import { useExportOrganizationData } from "@/lib/queries/org-access";

/** 4º gatilho da escada (seção 7 do Guia): bloqueio total de acesso.
 * Substitui a árvore de rotas inteira — sem sidebar, sem topbar, nenhuma
 * outra rota acessível. Só exportação (sempre liberada, em qualquer nível)
 * e contato com a Jáwda ficam disponíveis. Renderizado por OrgAccessGate. */
export function BlockedScreen() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const exportData = useExportOrganizationData();

  function handleExport() {
    exportData.mutate(undefined, {
      onSuccess: () => toast.success("Exportação gerada", { description: "Download iniciado." }),
      onError: (err) => toast.error("Não foi possível exportar", { description: String(err) }),
    });
  }

  async function handleLogout() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8">
        <JawdaLogo size={30} />
      </div>
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--danger-deep)]/10 text-[color:var(--danger-deep)]">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Acesso bloqueado por pendência financeira
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O acesso ao sistema foi suspenso por atraso no pagamento. Regularize sua situação
            financeira com a Jáwda para restaurar o acesso completo. Você ainda pode exportar os
            seus dados a qualquer momento.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button
            className="w-full rounded-lg bg-brand text-white hover:bg-brand/90"
            onClick={handleExport}
            disabled={exportData.isPending}
          >
            <Download className="mr-1.5 h-4 w-4" /> Exportar meus dados
          </Button>
          <a href="mailto:contato@jawda.com.br" className="w-full">
            <Button variant="outline" className="w-full rounded-lg">
              <Mail className="mr-1.5 h-4 w-4" /> Falar com a Jáwda
            </Button>
          </a>
          <Button
            variant="ghost"
            className="w-full rounded-lg text-muted-foreground"
            onClick={handleLogout}
          >
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
