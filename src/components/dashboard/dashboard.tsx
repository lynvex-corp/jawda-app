import { useMemo } from "react";
import type { Layout } from "react-grid-layout";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CalendarCheck,
  ArrowRight,
  ListChecks,
  X,
  Inbox,
  Pencil,
  Check,
  RotateCcw,
  Plus,
  GripVertical,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, Line, LineChart } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { severityClasses, statusClasses } from "@/lib/mock-data";
import { Link } from "@tanstack/react-router";
import { ReconhecimentoPanel } from "@/components/dashboard/reconhecimento";
import { QuadroPendencias } from "@/components/dashboard/pendencias";
import { CulturaDaQualidadeIndicador } from "@/components/dashboard/cultura-qualidade-indicador";
import { MinhasAnotacoesCard } from "@/components/dashboard/minhas-anotacoes";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { useAuth } from "@/hooks/use-auth";
import {
  DASHBOARD_PERIODO_OPTIONS,
  DASHBOARD_PERIODO_PADRAO,
  useDashboardData,
  useDashboardPeriodo,
  type DashboardPeriodo,
} from "@/lib/queries/dashboard";
import {
  useDashboardLayout,
  WIDGET_IDS,
  WIDGET_LABEL,
  type WidgetId,
} from "@/lib/queries/dashboard-layout";
import { cn, getErrorMessage } from "@/lib/utils";

const chartConfig: ChartConfig = {
  abertas: { label: "Abertas no mês", color: "var(--brand)" },
  fechadas: { label: "Já encerradas", color: "var(--severity-low)" },
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

/** Placa de "ainda não há registro" — usada no lugar de cada gráfico quando a
 * empresa não tem dado no período. Melhor do que desenhar eixos zerados, que
 * dão a impressão de erro de carregamento. */
function SemDados({ mensagem }: { mensagem: string }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 py-6 text-center">
      <Inbox className="h-5 w-5 text-muted-foreground/60" />
      <p className="max-w-[280px] text-xs text-muted-foreground">{mensagem}</p>
    </div>
  );
}

const PERFIS_CULTURA_QUALIDADE = new Set(["admin", "quality_manager"]);

export function Dashboard() {
  const { periodo, setPeriodo, limpar } = useDashboardPeriodo();
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardData(periodo);
  const { currentOrg } = useAuth();
  const vejoCulturaDaQualidade = !!currentOrg && PERFIS_CULTURA_QUALIDADE.has(currentOrg.role);
  const { layout, hidden, setLayout, toggleWidget, resetLayout, editMode, setEditMode, pronto } =
    useDashboardLayout();

  const kpis = data?.kpis;
  const semNC = (kpis?.totalNCs ?? 0) === 0;

  // "cultura" nem entra na lista de widgets escolhíveis pra quem não tem o
  // perfil — não é só "esconder", a pessoa nunca vê a opção de reexibir algo
  // que não pode ver de qualquer forma (mesmo critério do ModuleGate).
  const widgetsDoMeuPerfil = useMemo(
    () => WIDGET_IDS.filter((id) => id !== "cultura" || vejoCulturaDaQualidade),
    [vejoCulturaDaQualidade],
  );
  const visibleIds = useMemo(
    () => widgetsDoMeuPerfil.filter((id) => !hidden.includes(id)),
    [widgetsDoMeuPerfil, hidden],
  );
  const escondidos = useMemo(
    () => widgetsDoMeuPerfil.filter((id) => hidden.includes(id)),
    [widgetsDoMeuPerfil, hidden],
  );

  // RGL só devolve a posição dos itens VISÍVEIS no onLayoutChange — sem essa
  // mesclagem, esconder um widget e reexibir depois faria ele "esquecer" a
  // posição salva (o item escondido ficaria de fora do layout persistido).
  function aoMudarLayout(layoutVisivel: Layout) {
    const idsVisiveis = new Set(visibleIds);
    const mantidos = layout.filter((item) => !idsVisiveis.has(item.i as WidgetId));
    setLayout([...mantidos, ...layoutVisivel]);
  }

  function renderWidget(id: WidgetId) {
    switch (id) {
      case "kpis":
        return (
          <div className="grid h-full gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={TrendingUp}
              label="Conformidade geral"
              value={isLoading || !kpis ? "—" : `${kpis.conformidade}%`}
              hint={
                semNC
                  ? "Sem NC registrada ainda"
                  : `${kpis?.totalNCs ?? 0} NCs registradas no total`
              }
              tone="success"
            />
            <KpiCard
              icon={AlertTriangle}
              label="NCs abertas"
              value={isLoading || !kpis ? "—" : String(kpis.ncsAbertas)}
              hint={
                kpis
                  ? `${kpis.ncsNaSemana} registrada(s) nos últimos 7 dias`
                  : "Carregando do sistema…"
              }
              tone="default"
            />
            <KpiCard
              icon={Clock}
              label="NCs vencidas"
              value={isLoading || !kpis ? "—" : String(kpis.ncsVencidas)}
              hint={kpis && kpis.ncsVencidas > 0 ? "Requer ação imediata" : "Nenhum SLA estourado"}
              tone="danger"
            />
            <KpiCard
              icon={CalendarCheck}
              label="Próximas auditorias"
              value={isLoading || !kpis ? "—" : String(kpis.proximasAuditorias)}
              hint="Programadas nos próximos 30 dias"
              tone="warning"
            />
          </div>
        );

      case "pendencias":
        return <QuadroPendencias />;

      case "notas":
        return <MinhasAnotacoesCard />;

      case "cultura":
        return <CulturaDaQualidadeIndicador />;

      case "planos-eficacia":
        return (
          <div className="grid h-full gap-4 lg:grid-cols-3">
            <Link to="/planos-de-acao" className="block">
              <Card className="h-full rounded-xl border-border/80 shadow-sm transition-colors hover:border-brand/40">
                <CardContent className="flex items-start justify-between p-5">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Planos de Ação Atrasados
                    </div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                      {isLoading || !kpis ? "—" : kpis.planosAtrasados}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Clique para ver detalhes →
                    </div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)]">
                    <ListChecks className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Card className="h-full rounded-xl border-border/80 shadow-sm lg:col-span-2">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Eficácia dos Planos de Ação
                  </CardTitle>
                  <CardDescription>% aprovados na 1ª avaliação, por mês</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-brand">
                    {kpis?.eficaciaAtual === null || kpis?.eficaciaAtual === undefined
                      ? "—"
                      : `${kpis.eficaciaAtual}%`}
                  </div>
                  <div className="text-[10px] text-muted-foreground">acumulado</div>
                </div>
              </CardHeader>
              <CardContent>
                {data && data.eficaciaMensal.length === 0 ? (
                  <SemDados mensagem="Nenhuma ação corretiva avaliada no período. A taxa aparece assim que a primeira verificação de eficácia for registrada." />
                ) : (
                  <ChartContainer
                    config={{ taxa: { label: "Eficácia %", color: "var(--brand)" } }}
                    className="h-[120px] w-full"
                  >
                    <LineChart data={data?.eficaciaMensal ?? []}>
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="mes"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={6}
                        style={{ fontSize: 11 }}
                      />
                      <YAxis hide domain={[0, 100]} />
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
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "ncs-graficos":
        return (
          <div className="grid h-full gap-4 lg:grid-cols-3">
            <Card className="h-full rounded-xl border-border/80 shadow-sm lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Não conformidades por mês de abertura
                </CardTitle>
                <CardDescription>
                  Quantas foram abertas em cada mês e quantas dessas já estão encerradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {semNC && data ? (
                  <SemDados mensagem="Nenhuma não conformidade registrada no período selecionado." />
                ) : (
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart data={data?.ncsPorMes ?? []} barGap={6}>
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="abertas" fill="var(--color-abertas)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="fechadas" fill="var(--color-fechadas)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="h-full rounded-xl border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">NCs por gravidade</CardTitle>
                <CardDescription>Distribuição no período</CardDescription>
              </CardHeader>
              <CardContent>
                {semNC && data ? (
                  <SemDados mensagem="Sem NC no período para distribuir por gravidade." />
                ) : (
                  <ChartContainer config={{}} className="h-[280px] w-full">
                    <BarChart
                      data={data?.ncsPorGravidade ?? []}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid
                        horizontal={false}
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="gravidade"
                        tickLine={false}
                        axisLine={false}
                        width={70}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                        {(data?.ncsPorGravidade ?? []).map((entry) => (
                          <Cell key={entry.gravidade} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "ultimas-ncs":
        return (
          <Card className="h-full rounded-xl border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">Últimas não conformidades</CardTitle>
                <CardDescription>5 mais recentes do período</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-brand hover:bg-brand-soft" asChild>
                <Link to="/nao-conformidades">
                  Ver todas <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {data && data.ultimasNCs.length === 0 ? (
                <SemDados mensagem="Nenhuma não conformidade registrada no período selecionado." />
              ) : (
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
                    {(data?.ultimasNCs ?? []).map((nc) => (
                      <TableRow
                        key={nc.id}
                        className="border-border/60 transition-colors hover:bg-brand-soft/30"
                      >
                        <TableCell className="pl-6 font-mono text-xs font-medium text-brand">
                          <Link to="/nao-conformidades/$id" params={{ id: nc.id }}>
                            {nc.codigo}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[420px] truncate text-sm">
                          {nc.descricao}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-brand-soft text-brand text-[10px] font-semibold">
                                {nc.responsavelIniciais}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{nc.responsavelNome}</span>
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
              )}
            </CardContent>
          </Card>
        );

      case "reconhecimento":
        return (
          <div className="h-full">
            <div className="mb-3">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Reconhecimento
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Rankings e selos de sequência — engajamento com a cultura de qualidade.
              </p>
            </div>
            <ReconhecimentoPanel />
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestão à Vista</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe num só lugar o que está aberto, vencido ou aguardando você
            {isFetching ? ", atualizando…" : "."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as DashboardPeriodo)}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DASHBOARD_PERIODO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {periodo !== DASHBOARD_PERIODO_PADRAO && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={limpar}
              aria-label="Limpar filtro de período"
              title="Limpar filtro de período"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {editMode ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg">
                    <Plus className="h-4 w-4" /> Adicionar widget
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {escondidos.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Todos os widgets já estão visíveis
                    </div>
                  ) : (
                    escondidos.map((id) => (
                      <DropdownMenuCheckboxItem
                        key={id}
                        checked={false}
                        onCheckedChange={() => toggleWidget(id)}
                      >
                        {WIDGET_LABEL[id]}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-lg"
                onClick={resetLayout}
              >
                <RotateCcw className="h-4 w-4" /> Restaurar padrão
              </Button>
              <Button
                size="sm"
                className="h-9 gap-2 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
                onClick={() => setEditMode(false)}
              >
                <Check className="h-4 w-4" /> Concluir
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-lg"
              onClick={() => setEditMode(true)}
            >
              <Pencil className="h-4 w-4" /> Editar painel
            </Button>
          )}
        </div>
      </div>

      {isError && (
        <Card className="rounded-xl border-[color:var(--severity-critical)]/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Não foi possível carregar os dados do painel
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{getErrorMessage(error)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      )}

      {editMode && (
        <p className="flex items-center gap-2 rounded-lg border border-dashed border-brand/40 bg-brand-soft/40 px-3 py-2 text-xs text-brand">
          <GripVertical className="h-3.5 w-3.5 shrink-0" /> Arraste um card para reposicionar, puxe
          o canto inferior direito para redimensionar, ou esconda com o × — só funciona em telas
          maiores (tablet/desktop).
        </p>
      )}

      {pronto && (
        <DashboardGrid
          editMode={editMode}
          layout={layout}
          onLayoutChange={aoMudarLayout}
          visibleIds={visibleIds}
          renderWidget={renderWidget}
          onHideWidget={toggleWidget}
        />
      )}
    </div>
  );
}
