import { useMemo, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Link2, ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useRisksOpportunities,
  useCreateRiskOpportunity,
  useGenerateActionPlanFromRisk,
  useUpdateRiskOpportunity,
  useReassessRisk,
  RISK_AREA_OPTIONS,
  RISK_DECISION_OPTIONS,
  type RiskOpportunity,
  type RiskType,
  type RiskArea,
  type RiskDecision,
} from "@/lib/queries/estrategia";

function nivel(p: number, i: number) {
  const v = p * i;
  if (v >= 15) return { label: "Crítico", color: "bg-[color:var(--severity-critical)]" };
  if (v >= 10) return { label: "Alto", color: "bg-[color:var(--severity-high)]" };
  if (v >= 5) return { label: "Médio", color: "bg-[color:var(--warning)]" };
  return { label: "Baixo", color: "bg-[color:var(--success)]" };
}

function cellColor(p: number, i: number) {
  const v = p * i;
  if (v >= 15) return "bg-[color:var(--severity-critical)]/85";
  if (v >= 10) return "bg-[color:var(--severity-high)]/80";
  if (v >= 5) return "bg-[color:var(--warning)]/70";
  return "bg-[color:var(--success)]/70";
}

const areaLabel = Object.fromEntries(RISK_AREA_OPTIONS.map((o) => [o.value, o.label]));

export function RiscosPage() {
  const { data: rows = [], isLoading } = useRisksOpportunities();
  const createRisk = useCreateRiskOpportunity();
  const generatePlan = useGenerateActionPlanFromRisk();
  const updateRisk = useUpdateRiskOpportunity();
  const reassess = useReassessRisk();

  const [open, setOpen] = useState(false);
  const [novo, setNovo] = useState({
    descricao: "",
    tipo: "risco" as RiskType,
    area: "qualidade" as RiskArea,
    probabilidade: 3,
    impacto: 3,
    acao: "",
  });
  const [reassessOpen, setReassessOpen] = useState<RiskOpportunity | null>(null);
  const [novaProbabilidade, setNovaProbabilidade] = useState(3);
  const [novoImpacto, setNovoImpacto] = useState(3);

  const cellMap = useMemo(() => {
    const map = new Map<string, RiskOpportunity[]>();
    rows.forEach((r) => {
      const key = `${r.probability}-${r.impact}`;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    });
    return map;
  }, [rows]);

  const salvar = () => {
    createRisk.mutate(
      {
        type: novo.tipo,
        area: novo.area,
        description: novo.descricao || "Novo registro sem descrição",
        probability: novo.probabilidade,
        impact: novo.impacto,
        actionDescription: novo.acao,
      },
      {
        onSuccess: (created) => {
          setOpen(false);
          toast.success(`${created.code} registrado`, {
            description: "Nível recalculado automaticamente na matriz.",
          });
          setNovo({
            descricao: "",
            tipo: "risco",
            area: "qualidade",
            probabilidade: 3,
            impacto: 3,
            acao: "",
          });
        },
        onError: (e) => toast.error("Erro ao registrar", { description: String(e) }),
      },
    );
  };

  const gerarPlano = (r: RiskOpportunity) => {
    generatePlan.mutate(
      {
        riskId: r.id,
        description:
          r.actionDescription ||
          `Tratar ${r.type === "risco" ? "risco" : "oportunidade"}: ${r.description}`,
      },
      {
        onSuccess: (plan) =>
          toast.success("Plano de ação gerado", { description: `Vínculo criado: ${plan.code}` }),
        onError: (e) => toast.error("Erro ao gerar plano", { description: String(e) }),
      },
    );
  };

  const salvarReavaliacao = () => {
    if (!reassessOpen) return;
    reassess.mutate(
      { riskId: reassessOpen.id, probability: novaProbabilidade, impact: novoImpacto },
      {
        onSuccess: () => {
          toast.success("Reavaliação registrada", { description: "Histórico preservado." });
          setReassessOpen(null);
        },
        onError: (e) => toast.error("Erro ao reavaliar", { description: String(e) }),
      },
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Riscos e Oportunidades
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Matriz 5×5 e registro completo — requisito 6.1 da ISO 9001.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-lg bg-brand text-white hover:bg-brand/90">
                <Plus className="mr-1.5 h-4 w-4" /> Novo registro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg rounded-2xl">
              <DialogHeader>
                <DialogTitle>Novo Risco / Oportunidade</DialogTitle>
                <DialogDescription>
                  O nível é calculado automaticamente pela combinação Probabilidade × Impacto.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Descrição</label>
                  <Textarea
                    value={novo.descricao}
                    onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
                    rows={2}
                    className="rounded-lg text-xs"
                    placeholder="Ex.: Falha de fornecimento de matéria-prima crítica…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Tipo</label>
                    <Select
                      value={novo.tipo}
                      onValueChange={(v) => setNovo({ ...novo, tipo: v as RiskType })}
                    >
                      <SelectTrigger className="h-9 rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oportunidade">Oportunidade</SelectItem>
                        <SelectItem value="risco">Risco</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Área</label>
                    <Select
                      value={novo.area}
                      onValueChange={(v) => setNovo({ ...novo, area: v as RiskArea })}
                    >
                      <SelectTrigger className="h-9 rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_AREA_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-muted-foreground">Probabilidade</span>
                    <span className="font-mono font-semibold text-foreground">
                      {novo.probabilidade}/5
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={[novo.probabilidade]}
                    onValueChange={(v) => setNovo({ ...novo, probabilidade: v[0] })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-muted-foreground">Impacto</span>
                    <span className="font-mono font-semibold text-foreground">
                      {novo.impacto}/5
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={[novo.impacto]}
                    onValueChange={(v) => setNovo({ ...novo, impacto: v[0] })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
                  <span className="text-[11px] text-muted-foreground">Nível calculado</span>
                  <Badge
                    className={cn(
                      "rounded-md text-white",
                      nivel(novo.probabilidade, novo.impacto).color,
                    )}
                  >
                    {nivel(novo.probabilidade, novo.impacto).label}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Ação planejada
                  </label>
                  <Input
                    value={novo.acao}
                    onChange={(e) => setNovo({ ...novo, acao: e.target.value })}
                    className="h-9 rounded-lg text-xs"
                    placeholder="Ex.: Homologar segundo fornecedor"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} className="rounded-lg">
                  Cancelar
                </Button>
                <Button
                  onClick={salvar}
                  className="rounded-lg bg-brand text-white hover:bg-brand/90"
                >
                  Registrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          {/* Matrix */}
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Matriz 5×5</h2>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ShieldAlert className="h-3 w-3" /> Prob × Impacto
                </span>
              </div>
              <div className="flex">
                <div className="flex w-6 items-center justify-center">
                  <span className="-rotate-90 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Probabilidade →
                  </span>
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-6 gap-1">
                    <div />
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="text-center text-[10px] font-mono text-muted-foreground"
                      >
                        {i}
                      </div>
                    ))}
                    {[5, 4, 3, 2, 1].map((p) => (
                      <>
                        <div
                          key={`l-${p}`}
                          className="text-right pr-1 text-[10px] font-mono text-muted-foreground"
                        >
                          {p}
                        </div>
                        {[1, 2, 3, 4, 5].map((i) => {
                          const list = cellMap.get(`${p}-${i}`) ?? [];
                          return (
                            <div
                              key={`${p}-${i}`}
                              className={cn("relative aspect-square rounded-md", cellColor(p, i))}
                            >
                              <div className="flex h-full flex-wrap items-center justify-center gap-0.5 p-0.5">
                                {list.slice(0, 4).map((r) => (
                                  <span
                                    key={r.id}
                                    title={`${r.code} · ${r.description}`}
                                    className="rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-foreground shadow"
                                  >
                                    {r.code}
                                  </span>
                                ))}
                                {list.length > 4 && (
                                  <span className="text-[9px] font-bold text-white">
                                    +{list.length - 4}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ))}
                  </div>
                  <div className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Impacto →
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px]">
                {(["Baixo", "Médio", "Alto", "Crítico"] as const).map((l) => {
                  const c =
                    l === "Crítico"
                      ? "bg-[color:var(--severity-critical)]"
                      : l === "Alto"
                        ? "bg-[color:var(--severity-high)]"
                        : l === "Médio"
                          ? "bg-[color:var(--warning)]"
                          : "bg-[color:var(--success)]";
                  return (
                    <span key={l} className="flex items-center gap-1 text-muted-foreground">
                      <span className={cn("inline-block h-2.5 w-2.5 rounded", c)} /> {l}
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* List */}
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Registros ({rows.length})</h2>
              </div>
              <div className="max-h-[520px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead>Avaliação</TableHead>
                      <TableHead>Decisão</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isLoading && rows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-8 text-center text-xs text-muted-foreground"
                        >
                          Nenhum registro ainda.
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((r) => {
                      const n = nivel(r.probability, r.impact);
                      return (
                        <TableRow key={r.id} className="text-xs">
                          <TableCell className="font-mono text-[11px] font-semibold text-brand">
                            {r.code}
                            {r.originSwotCardId && (
                              <Badge
                                variant="outline"
                                className="ml-1 rounded-md border-border text-[9px] text-muted-foreground"
                              >
                                SWOT
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[240px] text-foreground/85">
                            {r.description}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-md text-[10px]",
                                r.type === "risco"
                                  ? "border-[color:var(--severity-critical)]/30 bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)]"
                                  : "border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]",
                              )}
                            >
                              {r.type === "risco" ? "Risco" : "Oportunidade"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {areaLabel[r.area]}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge className={cn("rounded-md text-white", n.color)}>
                                {n.label} · {r.probability}×{r.impact}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setReassessOpen(r);
                                  setNovaProbabilidade(r.probability);
                                  setNovoImpacto(r.impact);
                                }}
                                className="h-6 w-6 p-0"
                                title="Reavaliar"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={r.decision ?? undefined}
                              onValueChange={(v) =>
                                updateRisk.mutate({
                                  id: r.id,
                                  patch: { decision: v as RiskDecision },
                                })
                              }
                            >
                              <SelectTrigger className="h-7 w-[130px] rounded-md text-[11px]">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                {RISK_DECISION_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {r.generatedActionPlanCode ? (
                              <Badge
                                variant="outline"
                                className="rounded-md border-brand/30 bg-brand-soft text-[10px] text-brand"
                              >
                                <Link2 className="mr-0.5 h-3 w-3" /> {r.generatedActionPlanCode}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => gerarPlano(r)}
                                className="h-7 rounded-md px-2 text-[11px] text-brand hover:bg-brand-soft"
                              >
                                <Plus className="mr-1 h-3 w-3" /> Gerar Plano
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={reassessOpen !== null}
        onOpenChange={(o) => {
          if (!o) setReassessOpen(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reavaliar {reassessOpen?.code}</DialogTitle>
            <DialogDescription>O histórico da avaliação anterior é preservado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-muted-foreground">Probabilidade</span>
                <span className="font-mono font-semibold text-foreground">
                  {novaProbabilidade}/5
                </span>
              </div>
              <Slider
                min={1}
                max={5}
                step={1}
                value={[novaProbabilidade]}
                onValueChange={(v) => setNovaProbabilidade(v[0])}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-muted-foreground">Impacto</span>
                <span className="font-mono font-semibold text-foreground">{novoImpacto}/5</span>
              </div>
              <Slider
                min={1}
                max={5}
                step={1}
                value={[novoImpacto]}
                onValueChange={(v) => setNovoImpacto(v[0])}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassessOpen(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarReavaliacao} className="bg-brand text-white hover:bg-brand/90">
              Salvar reavaliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
