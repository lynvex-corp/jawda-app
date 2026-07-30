import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  MoreHorizontal,
  Archive,
  Pencil,
  FileDown,
  Plus,
  History,
  Paperclip,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { semaforo, semaforoCor, semaforoLabel } from "@/lib/kpi-data";
import {
  useArchiveIndicator,
  useIndicator,
  useUpdateIndicator,
  useUpdateIndicatorTarget,
  type Indicator,
} from "@/lib/queries/indicators";
import {
  useIndicatorActivity,
  useIndicatorGeneratedNcs,
  useIndicatorMeasurements,
  useIndicatorTargetHistory,
} from "@/lib/queries/indicator-measurements";
import { SemaforoDot, TendenciaIcon } from "./shared";
import { LancarMedicaoDialog } from "./medicao-dialogs";
import { ConfigTab } from "./indicador-config-tab";
import { IndicadorGrafico } from "./indicador-grafico";

export function IndicadorDetalhe({ id }: { id: string }) {
  const { data: indicador } = useIndicator(id);
  const { data: medicoes = [] } = useIndicatorMeasurements(id);
  const { data: targetHistory = [] } = useIndicatorTargetHistory(id);
  const { data: trilha = [] } = useIndicatorActivity(indicador?.codigo);
  const { data: ncsGeradas = [] } = useIndicatorGeneratedNcs(id);
  const archiveIndicador = useArchiveIndicator();
  const updateIndicador = useUpdateIndicator();
  const updateTarget = useUpdateIndicatorTarget();

  const [medOpen, setMedOpen] = useState(false);
  const [metaDialog, setMetaDialog] = useState(false);
  const [novaMeta, setNovaMeta] = useState("");

  if (!indicador) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Indicador não encontrado.{" "}
          <Link to="/indicadores" className="text-brand underline">
            Voltar ao painel
          </Link>
        </div>
      </AppShell>
    );
  }

  const valores = medicoes.map((m) => m.valor);
  const ultimoValor = valores.length ? valores[valores.length - 1] : null;
  const s = semaforo(ultimoValor, indicador);

  /** Meta vigente na data de cada medição, olhando o histórico — sustenta a
   * linha "antiga até a mudança, nova a partir dali" (seção 10 do Guia). */
  function metaNaData(dataIso: string) {
    const d = dataIso.slice(0, 10);
    let atual = { meta: indicador!.meta };
    for (const h of targetHistory) {
      if (h.validoDe <= d) atual = h;
      else break;
    }
    return atual.meta;
  }

  const chart = medicoes.map((m) => ({
    periodo: m.periodo,
    valor: m.valor,
    meta: targetHistory.length ? metaNaData(m.criadoEm) : indicador.meta,
  }));
  const metaMudou = new Set(targetHistory.map((h) => h.meta)).size > 1;

  const melhor = valores.length
    ? indicador.polaridade === "menor_melhor"
      ? Math.min(...valores)
      : Math.max(...valores)
    : null;
  const pior = valores.length
    ? indicador.polaridade === "menor_melhor"
      ? Math.max(...valores)
      : Math.min(...valores)
    : null;
  const media = valores.length
    ? +(valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(2)
    : null;

  function confirmarMeta() {
    const v = Number(novaMeta);
    if (Number.isNaN(v)) return toast.error("Informe um valor numérico.");
    updateTarget.mutate(
      {
        indicatorId: indicador!.id,
        meta: v,
        polaridade: indicador!.polaridade,
        faixaMin: indicador!.faixaMin ?? undefined,
        faixaMax: indicador!.faixaMax ?? undefined,
      },
      {
        onSuccess: () => {
          toast.success("Meta atualizada", {
            description: "A meta anterior foi preservada no histórico.",
          });
          setMetaDialog(false);
        },
        onError: (err) =>
          toast.error("Não foi possível atualizar a meta", { description: String(err) }),
      },
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1300px] space-y-5">
        <Link
          to="/indicadores"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-brand"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar aos indicadores
        </Link>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-5 p-5">
            <SemaforoDot valor={ultimoValor} indicador={indicador} size="lg" />
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <span className="font-mono text-[11px] font-semibold text-brand">
                {indicador.codigo}
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {indicador.nome}
              </h1>
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
                <Badge variant="outline" className="rounded-md text-[10px] text-muted-foreground">
                  {semaforoLabel[s]}
                </Badge>
                {ncsGeradas.map((nc) => (
                  <Link key={nc.id} to="/nao-conformidades/$id" params={{ id: nc.id }}>
                    <Badge
                      variant="outline"
                      className="rounded-md border-[color:var(--danger-deep)]/30 text-[10px] text-[color:var(--danger-deep)] hover:bg-[color:var(--danger-deep)]/10"
                    >
                      NC gerada: {nc.code}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-6">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Meta</p>
                <p className="text-lg font-semibold">
                  {indicador.meta}
                  {indicador.unidade}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Realizado</p>
                <p className="text-3xl font-bold" style={{ color: semaforoCor[s] }}>
                  {ultimoValor ?? "—"}
                  {ultimoValor !== null ? indicador.unidade : ""}
                </p>
              </div>
              <TendenciaIcon
                valores={valores}
                polaridade={indicador.polaridade}
                className="mb-2 h-5 w-5"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
                onClick={() => setMedOpen(true)}
                disabled={indicador.arquivado}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Lançar nova medição
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="outline" className="h-9 w-9 rounded-lg">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setNovaMeta(String(indicador.meta));
                      setMetaDialog(true);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Editar meta
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={indicador.arquivado}
                    onClick={() =>
                      archiveIndicador.mutate(indicador.id, {
                        onSuccess: () =>
                          toast.success("Indicador arquivado", {
                            description: "Continua acessível no filtro Arquivados.",
                          }),
                        onError: (err) =>
                          toast.error("Não foi possível arquivar", { description: String(err) }),
                      })
                    }
                  >
                    <Archive className="mr-2 h-3.5 w-3.5" /> Arquivar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.success("Histórico exportado em CSV")}>
                    <FileDown className="mr-2 h-3.5 w-3.5" /> Exportar histórico
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="visao" className="space-y-4">
          <TabsList className="rounded-xl">
            <TabsTrigger value="visao" className="rounded-lg text-xs">
              Visão geral
            </TabsTrigger>
            <TabsTrigger value="medicoes" className="rounded-lg text-xs">
              Medições
            </TabsTrigger>
            <TabsTrigger value="analise" className="rounded-lg text-xs">
              Análise por período
            </TabsTrigger>
            <TabsTrigger value="config" className="rounded-lg text-xs">
              Configuração
            </TabsTrigger>
            <TabsTrigger value="trilha" className="rounded-lg text-xs">
              Trilha
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visao">
            <IndicadorGrafico
              indicador={indicador}
              chart={chart}
              metaMudou={metaMudou}
              melhor={melhor}
              pior={pior}
              media={media}
              semaforoAtual={s}
            />
          </TabsContent>

          <TabsContent value="medicoes">
            <div className="overflow-hidden rounded-2xl border border-border/80">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-[11px]">Período</TableHead>
                    <TableHead className="text-[11px]">Valor</TableHead>
                    <TableHead className="text-[11px]">Responsável</TableHead>
                    <TableHead className="text-[11px]">Lançado em</TableHead>
                    <TableHead className="text-[11px]">Observação</TableHead>
                    <TableHead className="text-[11px]">Evidência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicoes.map((m) => (
                    <TableRow key={m.id} className="text-xs">
                      <TableCell>{m.periodo}</TableCell>
                      <TableCell
                        className="font-semibold"
                        style={{ color: m.foraDaMeta ? "var(--danger-deep)" : "var(--success)" }}
                      >
                        {m.valor}
                        {indicador.unidade}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.autorNome}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(m.criadoEm).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {m.observacao ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.evidencias.length ? (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {m.evidencias.length}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!medicoes.length && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        Nenhuma medição lançada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="analise" className="space-y-3">
            {medicoes
              .filter((m) => m.foraDaMeta)
              .map((m) => (
                <Card
                  key={m.id}
                  className="rounded-2xl border-[color:var(--danger-deep)]/30 bg-[color:var(--danger-deep)]/5"
                >
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">
                        {m.periodo} · {m.valor}
                        {indicador.unidade} (meta {indicador.meta}
                        {indicador.unidade})
                      </p>
                      <span className="text-[10px] text-muted-foreground">{m.autorNome}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {m.analise ?? "Análise crítica pendente de registro para este período."}
                    </p>
                    {m.aiSuggested && (
                      <Badge
                        variant="outline"
                        className="rounded-md border-brand/30 text-[10px] text-brand"
                      >
                        Redigida com apoio de IA
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            {!medicoes.some((m) => m.foraDaMeta) && (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhum período fora da meta neste indicador.
              </p>
            )}
          </TabsContent>

          <TabsContent value="config">
            <ConfigTab
              indicador={indicador}
              onSalvar={(patch) =>
                updateIndicador.mutate(
                  { id: indicador.id, ...patch },
                  {
                    onSuccess: () =>
                      toast.success("Configuração salva", {
                        description: "Alteração registrada na trilha.",
                      }),
                    onError: (err) =>
                      toast.error("Não foi possível salvar", { description: String(err) }),
                  },
                )
              }
            />
          </TabsContent>

          <TabsContent value="trilha">
            <Card className="rounded-2xl border-border/80">
              <CardContent className="p-5">
                {trilha.length ? (
                  <ol className="relative space-y-5 border-l border-border pl-5">
                    {trilha.map((t) => (
                      <li key={t.id} className="relative">
                        <span className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft">
                          <History className="h-3 w-3 text-brand" />
                        </span>
                        <p className="text-xs font-semibold text-foreground">{t.acao}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(t.data).toLocaleString("pt-BR")} · {t.autor}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Nenhum evento registrado ainda.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <LancarMedicaoDialog indicador={indicador} open={medOpen} onOpenChange={setMedOpen} />

      <AlertDialog open={metaDialog} onOpenChange={setMetaDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar meta do indicador</AlertDialogTitle>
            <AlertDialogDescription>
              A meta anterior será preservada no histórico. O gráfico mostrará a linha antiga até
              hoje e a nova a partir daqui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="number"
            value={novaMeta}
            onChange={(e) => setNovaMeta(e.target.value)}
            className="rounded-lg text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
              onClick={confirmarMeta}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
