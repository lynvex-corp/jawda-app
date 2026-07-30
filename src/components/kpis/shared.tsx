import { Link } from "@tanstack/react-router";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  semaforo,
  semaforoClasses,
  semaforoCor,
  semaforoLabel,
  tendencia,
  tendenciaBoa,
} from "@/lib/kpi-data";
import type { Indicator } from "@/lib/queries/indicators";
import type { Measurement } from "@/lib/queries/indicator-measurements";

export function Sparkline({ valores, cor }: { valores: number[]; cor: string }) {
  if (valores.length < 2) {
    return (
      <div className="flex h-[38px] items-center text-[10px] text-muted-foreground">
        Sem histórico de medições
      </div>
    );
  }
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = max - min || 1;
  const pts = valores
    .map((v, i) => `${(i / (valores.length - 1)) * 100},${34 - ((v - min) / span) * 30}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 38" preserveAspectRatio="none" className="h-[38px] w-full">
      <polyline
        points={pts}
        fill="none"
        stroke={cor}
        strokeWidth={1.6}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function TendenciaIcon({
  valores,
  polaridade,
  className,
}: {
  valores: number[];
  polaridade: Indicator["polaridade"];
  className?: string;
}) {
  const t = tendencia(valores);
  const boa = tendenciaBoa(valores, polaridade);
  const Icon = t === "up" ? TrendingUp : t === "down" ? TrendingDown : Minus;
  return (
    <Icon
      className={cn(
        "h-4 w-4",
        boa === null
          ? "text-muted-foreground"
          : boa
            ? "text-[color:var(--success)]"
            : "text-[color:var(--danger-deep)]",
        className,
      )}
    />
  );
}

export function SemaforoChip({ valor, indicador }: { valor: number | null; indicador: Indicator }) {
  const s = semaforo(valor, indicador);
  return (
    <Badge variant="outline" className={cn("rounded-md text-[10px]", semaforoClasses[s])}>
      {semaforoLabel[s]}
    </Badge>
  );
}

export function SemaforoDot({
  valor,
  indicador,
  size = "sm",
}: {
  valor: number | null;
  indicador: Indicator;
  size?: "sm" | "lg";
}) {
  const s = semaforo(valor, indicador);
  return (
    <span
      title={semaforoLabel[s]}
      className={cn(
        "inline-block shrink-0 rounded-full ring-4",
        size === "lg" ? "h-5 w-5" : "h-3 w-3",
      )}
      style={{
        background: semaforoCor[s],
        boxShadow: `0 0 0 4px color-mix(in oklab, ${semaforoCor[s]} 18%, transparent)`,
      }}
    />
  );
}

export function KpiCard({
  indicador,
  medicoes,
}: {
  indicador: Indicator;
  medicoes: Measurement[];
}) {
  const valores = medicoes.map((m) => m.valor);
  const v = valores.length ? valores[valores.length - 1] : null;
  const s = semaforo(v, indicador);
  const ultima = medicoes[medicoes.length - 1];
  return (
    <Link to="/indicadores/$id" params={{ id: indicador.id }} className="block">
      <Card className="h-full rounded-2xl border-border/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1.5">
              <span className="font-mono text-[10px] font-semibold text-brand">
                {indicador.codigo}
              </span>
              <h3 className="truncate text-sm font-semibold text-foreground">{indicador.nome}</h3>
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant="outline"
                  className="rounded-md border-brand/20 bg-brand-soft text-[10px] text-brand"
                >
                  {indicador.objetivoNome}
                </Badge>
                {indicador.processo && (
                  <Badge variant="outline" className="rounded-md text-[10px] text-muted-foreground">
                    {indicador.processo}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <SemaforoDot valor={v} indicador={indicador} />
              <TendenciaIcon valores={valores} polaridade={indicador.polaridade} />
            </div>
          </div>

          <div className="flex items-end gap-6 border-t border-border/60 pt-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Meta</p>
              <p className="text-lg font-semibold text-foreground">
                {indicador.meta}
                <span className="ml-0.5 text-xs text-muted-foreground">{indicador.unidade}</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Resultado</p>
              <p className="text-2xl font-bold tracking-tight" style={{ color: semaforoCor[s] }}>
                {v === null ? "—" : v}
                {v !== null && (
                  <span className="ml-0.5 text-xs text-muted-foreground">{indicador.unidade}</span>
                )}
              </p>
            </div>
            <div className="ml-auto w-24">
              <Sparkline valores={valores} cor={semaforoCor[s]} />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            {ultima
              ? `última medição em ${new Date(ultima.criadoEm).toLocaleDateString("pt-BR")} · ${ultima.autorNome}`
              : `aguardando 1ª medição · ${indicador.responsavelMedicaoNome}`}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
