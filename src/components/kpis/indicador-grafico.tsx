import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { semaforoCor, type SemaforoKpi } from "@/lib/kpi-data";
import type { Indicator } from "@/lib/queries/indicators";

/** Aba "Visão geral" — gráfico de linha com a meta vigente por período (que
 * muda de patamar no ponto em que a meta foi alterada, reconstruída a
 * partir de indicator_target_history) e os 3 cartões de melhor/pior/média. */
export function IndicadorGrafico({
  indicador,
  chart,
  metaMudou,
  melhor,
  pior,
  media,
  semaforoAtual,
}: {
  indicador: Indicator;
  chart: { periodo: string; valor: number; meta: number }[];
  metaMudou: boolean;
  melhor: number | null;
  pior: number | null;
  media: number | null;
  semaforoAtual: SemaforoKpi;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="p-5">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand">
            Últimos períodos
          </h2>
          {metaMudou && (
            <p className="mb-2 text-[10px] text-muted-foreground">
              A linha tracejada mostra a meta vigente em cada período — ela muda de patamar no ponto
              em que a meta foi alterada.
            </p>
          )}
          <div className="h-[300px]">
            {chart.length ? (
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      fontSize: 11,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="meta"
                    stroke="var(--brand)"
                    strokeDasharray="5 4"
                    strokeWidth={1.6}
                    dot={false}
                    name="Meta vigente"
                  />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    stroke={semaforoCor[semaforoAtual]}
                    strokeWidth={2.4}
                    dot={{ r: 3 }}
                    name="Realizado"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Ainda sem medições registradas.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {[
          { l: "Melhor resultado", v: melhor, c: "var(--success)" },
          { l: "Pior resultado", v: pior, c: "var(--danger-deep)" },
          { l: "Média do período", v: media, c: "var(--brand)" },
        ].map((c) => (
          <Card key={c.l} className="rounded-2xl border-border/80">
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground">{c.l}</p>
              <p className="text-2xl font-bold" style={{ color: c.c }}>
                {c.v ?? "—"}
                {c.v !== null ? indicador.unidade : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
