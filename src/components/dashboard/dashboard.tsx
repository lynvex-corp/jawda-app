import { TrendingUp, AlertTriangle, Clock, CalendarCheck, ArrowRight } from "lucide-react";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  mockNCs,
  ncsPorMes,
  ncsPorGravidade,
  severityClasses,
  statusClasses,
} from "@/lib/mock-data";
import { eficaciaPlanosMensal } from "@/lib/mock-data";
import { useJawda } from "@/lib/jawda-store";
import { Line, LineChart } from "recharts";
import { Link } from "@tanstack/react-router";
import { ReconhecimentoPanel } from "@/components/dashboard/reconhecimento";

const chartConfig: ChartConfig = {
  abertas: { label: "Abertas", color: "var(--brand)" },
  fechadas: { label: "Fechadas", color: "var(--severity-low)" },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const toneMap = {
    default: "text-brand bg-brand-soft",
    danger: "text-[color:var(--severity-critical)] bg-[color:var(--severity-critical)]/10",
    warning: "text-[color:var(--severity-high)] bg-[color:var(--severity-high)]/10",
    success: "text-[color:var(--success)] bg-[color:var(--success)]/10",
  } as const;
  return (
    <Card className="rounded-xl border-border/80 shadow-sm">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneMap[tone ?? "default"]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { naoConformidades, kpis } = useJawda();
  const source = naoConformidades.length ? naoConformidades : mockNCs;
  const ultimasNCs = [...source].sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)).slice(0, 5);
  const planosAtrasados = kpis.planosAtrasados;
  const eficaciaAtual = eficaciaPlanosMensal[eficaciaPlanosMensal.length - 1].taxa;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Dashboard Executivo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão consolidada da conformidade e qualidade — atualizado agora.
          </p>
        </div>
        <Button className="rounded-lg bg-brand text-brand-foreground hover:bg-brand/90">
          Exportar relatório
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={TrendingUp}
          label="Conformidade geral"
          value={`${kpis.conformidade}%`}
          hint="+2,4 pts vs. mês anterior"
          tone="success"
        />
        <KpiCard
          icon={AlertTriangle}
          label="NCs abertas"
          value={String(kpis.ncsAbertas)}
          hint="6 registradas nesta semana"
          tone="default"
        />
        <KpiCard
          icon={Clock}
          label="NCs vencidas"
          value={String(kpis.ncsVencidas)}
          hint="Requer ação imediata"
          tone="danger"
        />
        <KpiCard
          icon={CalendarCheck}
          label="Próximas auditorias"
          value={String(kpis.proximasAuditorias)}
          hint="Nos próximos 30 dias"
          tone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Link to="/planos-de-acao" className="block">
          <Card className="rounded-xl border-border/80 shadow-sm transition-colors hover:border-brand/40">
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Planos de Ação Atrasados
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  {planosAtrasados}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Clique para ver detalhes →</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)]">
                <ListChecks className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </Link>
        <Card className="rounded-xl border-border/80 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Eficácia dos Planos de Ação</CardTitle>
              <CardDescription>Últimos 6 meses — % aprovados na 1ª avaliação</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-brand">{eficaciaAtual}%</div>
              <div className="text-[10px] text-muted-foreground">mês atual</div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ taxa: { label: "Eficácia %", color: "var(--brand)" } }}
              className="h-[120px] w-full"
            >
              <LineChart data={eficaciaPlanosMensal}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="mes"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  style={{ fontSize: 11 }}
                />
                <YAxis hide domain={[60, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="taxa"
                  type="monotone"
                  stroke="var(--brand)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--brand)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl border-border/80 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Não conformidades — últimos 6 meses
            </CardTitle>
            <CardDescription>Abertas x fechadas por período</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={ncsPorMes} barGap={6}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={30} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="abertas" fill="var(--color-abertas)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="fechadas" fill="var(--color-fechadas)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">NCs por gravidade</CardTitle>
            <CardDescription>Distribuição no período</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[280px] w-full">
              <BarChart data={ncsPorGravidade} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="gravidade"
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                  {ncsPorGravidade.map((entry) => (
                    <Cell key={entry.gravidade} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Últimas não conformidades</CardTitle>
            <CardDescription>5 mais recentes</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="text-brand hover:bg-brand-soft">
            Ver todas <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="pl-6">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Gravidade</TableHead>
                <TableHead className="pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ultimasNCs.map((nc) => (
                <TableRow
                  key={nc.id}
                  className="cursor-pointer border-border/60 transition-colors hover:bg-brand-soft/30"
                >
                  <TableCell className="pl-6 font-mono text-xs font-medium text-brand">
                    {nc.codigo}
                  </TableCell>
                  <TableCell className="max-w-[420px] truncate text-sm">{nc.descricao}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-brand-soft text-brand text-[10px] font-semibold">
                          {nc.responsavel.iniciais}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{nc.responsavel.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`rounded-md border ${severityClasses(nc.gravidade)}`}
                    >
                      {nc.gravidade}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6">
                    <Badge
                      variant="outline"
                      className={`rounded-md border font-normal ${statusClasses(nc.status)}`}
                    >
                      {nc.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Reconhecimento</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Rankings e selos de sequência — engajamento com a cultura de qualidade.
          </p>
        </div>
        <ReconhecimentoPanel />
      </div>
    </div>
  );
}
