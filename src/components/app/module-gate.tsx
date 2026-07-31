import { Lock } from "lucide-react";
import { AppShell } from "./app-shell";
import { Button } from "@/components/ui/button";
import { useEnabledModules } from "@/lib/queries/contract";
import type { ContractModule } from "@/lib/queries/contract";

/** Trava o módulo inteiro (não só o item da sidebar) quando o contrato não
 * inclui — gancho crítico da seção 4/7 do Guia: "módulos não contratados
 * aparecem com cadeado e 'falar com a Jáwda'". Enquanto o contrato ainda
 * está carregando, deixa passar (undefined = "ainda não sei"), pra não
 * bloquear a tela por um instante em todo carregamento normal. */
export function ModuleGate({
  module,
  children,
}: {
  module: ContractModule;
  children: React.ReactNode;
}) {
  const { data: enabledModules } = useEnabledModules();

  if (enabledModules && !enabledModules.has(module)) {
    return (
      <AppShell>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Módulo não contratado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Este módulo não está incluído no seu plano atual. Fale com a Jáwda para contratar.
            </p>
          </div>
          <Button className="rounded-lg bg-brand text-white hover:bg-brand/90" disabled>
            Falar com a Jáwda
          </Button>
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
