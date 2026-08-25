import { AlertTriangle, Download, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useExportOrganizationData } from "@/lib/queries/org-access";
import type { OrgAccessLevel } from "@/lib/org-access-guard";
import { getErrorMessage } from "@/lib/utils";

/** Reflexo visual dos níveis 'aware' (2º gatilho — banner de aviso, seção 7
 * do Guia) e 'read_only' (3º gatilho — módulos ficam visíveis mas ação de
 * criar/editar é bloqueada). O nível 'blocked' não passa por aqui — vira
 * BlockedScreen (org-access-gate.tsx), que substitui a tela inteira. */
export function DelinquencyBanner({ level }: { level: OrgAccessLevel }) {
  const exportData = useExportOrganizationData();

  if (level !== "aware" && level !== "read_only") return null;

  const isReadOnly = level === "read_only";

  function handleExport() {
    exportData.mutate(undefined, {
      onSuccess: () => toast.success("Exportação gerada", { description: "Download iniciado." }),
      onError: (err) =>
        toast.error("Não foi possível exportar", { description: getErrorMessage(err) }),
    });
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs md:px-8 ${
        isReadOnly
          ? "border-[color:var(--severity-high)]/30 bg-[color:var(--severity-high)]/10 text-[color:var(--severity-high)]"
          : "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/15 text-foreground"
      }`}
    >
      <span className="flex items-center gap-2">
        {isReadOnly ? (
          <Lock className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        )}
        {isReadOnly
          ? "Acesso em modo somente leitura por pendência financeira. Criação e edição de registros estão bloqueadas — exportação continua disponível."
          : "Há uma pendência financeira. Regularize para evitar restrição de acesso."}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 rounded-md px-2 text-[11px] hover:bg-background/60"
        onClick={handleExport}
        disabled={exportData.isPending}
      >
        <Download className="mr-1 h-3 w-3" /> Exportar meus dados
      </Button>
    </div>
  );
}
