import type { ReactNode } from "react";
import { Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Overlay "Previsão de disponibilidade na versão 2.0" (item 9, Bloco 6) —
 * usado em telas que FUNCIONAM (navegam, renderizam) mas cujo CONTEÚDO por
 * trás é institucional fictício, não dado real (ex.: Treinamentos da
 * Plataforma, e as abas Integrações/SLA/Normas de Configurações). Diferente
 * do ModuleGate (módulo não contratado — bloqueio de verdade, cadeado), este
 * é só uma vitrine do que vem a seguir: o conteúdo real fica por baixo,
 * levemente visível e desabilitado (pointer-events-none), não escondido. */
export function VersaoFuturaOverlay({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none select-none opacity-40 blur-[1px]">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/40">
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card px-5 py-2.5 shadow-md">
          <Sparkle className="h-4 w-4 text-brand" />
          <span className="text-sm font-medium text-foreground">
            Previsão de disponibilidade na versão 2.0
          </span>
        </div>
      </div>
    </div>
  );
}
