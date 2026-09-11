import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { semaforo, type SemaforoKpi } from "@/lib/kpi-data";
import { useIndicators, type Indicator } from "@/lib/queries/indicators";
import { useIndicatorMeasurements } from "@/lib/queries/indicator-measurements";

/** Reaproveita a matemática já existente do módulo Indicadores (semáforo)
 * em vez de reimplementar a regra de "dentro da meta" aqui — mesma fonte
 * de verdade que a tela de Indicadores usa. */
function metaTexto(ind: Indicator): string {
  if (ind.polaridade === "maior_melhor") return `Meta ≥${ind.meta}${ind.unidade}`;
  if (ind.polaridade === "menor_melhor") return `Meta ≤${ind.meta}${ind.unidade}`;
  return `Meta ${ind.faixaMin ?? "—"}–${ind.faixaMax ?? "—"}${ind.unidade}`;
}

const SEMAFORO_CLASSES: Record<SemaforoKpi, string> = {
  verde: "text-[color:var(--success)]",
  amarelo: "text-[color:var(--severity-high)]",
  vermelho: "text-[color:var(--severity-critical)]",
  novo: "text-muted-foreground",
};

/** Usa a mesma useIndicators()/useIndicatorMeasurements() sem filtro que a
 * própria tela de Indicadores usa pro painel — uma consulta só resolve
 * o indicador vinculado de TODOS os cartões da grade, sem N+1. */
export function useProcessKpiLookup() {
  const { data: indicators = [] } = useIndicators();
  const { data: measurements = [] } = useIndicatorMeasurements();

  return useMemo(() => {
    const byIndicator = new Map<string, Indicator>();
    for (const i of indicators) byIndicator.set(i.id, i);

    const latestByIndicator = new Map<string, number>();
    const latestCreatedAt = new Map<string, string>();
    for (const m of measurements) {
      const prev = latestCreatedAt.get(m.indicatorId);
      if (!prev || m.criadoEm > prev) {
        latestCreatedAt.set(m.indicatorId, m.criadoEm);
        latestByIndicator.set(m.indicatorId, m.valor);
      }
    }

    return { byIndicator, latestByIndicator };
  }, [indicators, measurements]);
}

export function ProcessKpiBadge({
  indicatorId,
  lookup,
}: {
  indicatorId: string;
  lookup: ReturnType<typeof useProcessKpiLookup>;
}) {
  const indicator = lookup.byIndicator.get(indicatorId);
  if (!indicator) return null;
  const valor = lookup.latestByIndicator.get(indicatorId) ?? null;
  const cor = semaforo(valor, {
    meta: indicator.meta,
    faixaMin: indicator.faixaMin,
    faixaMax: indicator.faixaMax,
    polaridade: indicator.polaridade,
    toleranciaPct: indicator.toleranciaPct,
  });

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px]">
      <div className="flex items-center gap-1.5">
        <TrendingUp className={cn("h-3.5 w-3.5", SEMAFORO_CLASSES[cor])} />
        <span className="text-muted-foreground">{indicator.nome}</span>
      </div>
      <div className="text-right">
        <div className={cn("text-sm font-bold", SEMAFORO_CLASSES[cor])}>
          {valor !== null ? `${valor}${indicator.unidade}` : "Sem medição"}
        </div>
        <Badge variant="outline" className="rounded-md text-[9px] text-muted-foreground">
          {metaTexto(indicator)}
        </Badge>
      </div>
    </div>
  );
}
