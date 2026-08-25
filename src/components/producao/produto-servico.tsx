import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Package,
  Plus,
  Search,
  User,
  CircleDot,
  FileWarning,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useCreateNC } from "@/lib/queries/ncs";
import {
  SERVICE_DEMAND_STATUS_OPTIONS,
  useServiceDemands,
  useCreateServiceDemand,
  useAdvanceServiceDemandStage,
  useRegisterServiceDemandDelivery,
  useLinkServiceDemandToNC,
  type ServiceDemand,
  type ServiceDemandStatus,
  type StageStatus,
} from "@/lib/queries/produto-servico";

const statusLabel = Object.fromEntries(
  SERVICE_DEMAND_STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ServiceDemandStatus, string>;

const statusColor: Record<ServiceDemandStatus, string> = {
  requisitos_em_analise:
    "bg-[color:var(--warning)]/20 text-[color:var(--severity-high)] border-[color:var(--warning)]/40",
  em_producao: "bg-brand-soft text-brand border-brand/25",
  em_verificacao:
    "bg-[color:var(--severity-high)]/12 text-[color:var(--severity-high)] border-[color:var(--severity-high)]/30",
  entregue:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
};

const etapaIcon = (s: StageStatus) =>
  s === "concluida" ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--success)]" />
  ) : s === "em_andamento" ? (
    <Clock className="h-3.5 w-3.5 text-[color:var(--warning)]" />
  ) : (
    <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
  );

export function ProdutoServicoPage() {
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const isAuthorized = currentOrg?.role === "admin" || currentOrg?.role === "quality_manager";

  const { data: items = [] } = useServiceDemands();
  const createDemand = useCreateServiceDemand();
  const advanceStage = useAdvanceServiceDemandStage();
  const registerDelivery = useRegisterServiceDemandDelivery();
  const createNC = useCreateNC();
  const linkNC = useLinkServiceDemandToNC();

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<ServiceDemandStatus | "todas">("todas");
  const [openNova, setOpenNova] = useState(false);
  const [nova, setNova] = useState({ clientOrOrigin: "", requirements: "", expectedDate: "" });
  const [comparar, setComparar] = useState<{ id: string; texto: string } | null>(null);

  const contagem = useMemo(
    () =>
      SERVICE_DEMAND_STATUS_OPTIONS.map((o) => ({
        status: o.value,
        label: o.label,
        total: items.filter((d) => d.status === o.value).length,
      })),
    [items],
  );

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return items.filter((d) => {
      const okStatus = filtro === "todas" || d.status === filtro;
      const okBusca =
        !q || [d.code, d.clientOrOrigin, d.requirements].some((v) => v.toLowerCase().includes(q));
      return okStatus && okBusca;
    });
  }, [items, busca, filtro]);

  const salvarNova = () => {
    if (!nova.clientOrOrigin.trim() || !nova.requirements.trim()) {
      toast.error("Informe cliente/origem e os requisitos");
      return;
    }
    createDemand.mutate(
      {
        clientOrOrigin: nova.clientOrOrigin.trim(),
        requirements: nova.requirements.trim(),
        expectedDate: nova.expectedDate || null,
      },
      {
        onSuccess: () => {
          toast.success("Demanda adicionada", { description: "Acompanhe as etapas no card." });
          setNova({ clientOrOrigin: "", requirements: "", expectedDate: "" });
          setOpenNova(false);
        },
        onError: (e) =>
          toast.error("Erro ao adicionar demanda", { description: getErrorMessage(e) }),
      },
    );
  };

  const registrarNC = async (d: ServiceDemand) => {
    try {
      const nc = await createNC.mutateAsync({
        origem: "Rotina do Processo",
        descricao: `Não conformidade identificada na demanda ${d.code} (${d.clientOrOrigin}): ${d.requirements}`,
        gravidade: "Média",
      });
      await linkNC.mutateAsync({ demandId: d.id, ncId: nc.id });
      toast.success(`NC criada e vinculada a ${d.code}`);
      navigate({ to: "/nao-conformidades/$id", params: { id: nc.id } });
    } catch (e) {
      toast.error("Erro ao registrar Não Conformidade", { description: getErrorMessage(e) });
    }
  };

  const salvarComparacao = () => {
    if (!comparar) return;
    registerDelivery.mutate(
      { demandId: comparar.id, comparison: comparar.texto },
      {
        onSuccess: () => {
          toast.success("Comparação registrada", { description: "Demanda marcada como entregue." });
          setComparar(null);
        },
        onError: (e) =>
          toast.error("Erro ao registrar entrega", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Produto ou Serviço
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cada demanda acompanhada do requisito do cliente até a entrega, com etapas e
              responsáveis.
            </p>
          </div>
          {isAuthorized && (
            <Button
              size="sm"
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
              onClick={() => setOpenNova(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Adicionar Demanda
            </Button>
          )}
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, código ou requisito…"
              className="h-9 rounded-lg pl-8 text-xs"
            />
          </div>
          <Select
            value={filtro}
            onValueChange={(v) => setFiltro(v as ServiceDemandStatus | "todas")}
          >
            <SelectTrigger className="h-9 w-[210px] rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os status</SelectItem>
              {SERVICE_DEMAND_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <button
            onClick={() => setFiltro("todas")}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              filtro === "todas"
                ? "border-brand/40 bg-brand-soft/50"
                : "border-border/70 bg-card hover:border-brand/25",
            )}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Todas as demandas
            </div>
            <div className="mt-0.5 text-xl font-semibold text-foreground">{items.length}</div>
          </button>
          {contagem.map((c) => (
            <button
              key={c.status}
              onClick={() => setFiltro(filtro === c.status ? "todas" : c.status)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                filtro === c.status
                  ? "border-brand/40 bg-brand-soft/50"
                  : "border-border/70 bg-card hover:border-brand/25",
              )}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {c.label}
              </div>
              <div className="mt-0.5 text-xl font-semibold text-foreground">{c.total}</div>
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {lista.map((d) => {
            const concluidas = d.stages.filter((e) => e.status === "concluida").length;
            const pct = d.stages.length > 0 ? Math.round((concluidas / d.stages.length) * 100) : 0;
            const todasConcluidas = d.stages.length > 0 && concluidas === d.stages.length;
            return (
              <Card key={d.id} className="rounded-2xl border-border/80 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-mono text-[10px] font-semibold text-brand">
                          {d.code}
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          {d.clientOrOrigin}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("rounded-md border text-[10px]", statusColor[d.status])}
                    >
                      {statusLabel[d.status]}
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <ClipboardList className="h-3 w-3" /> Requisitos do pedido
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-foreground/85">
                      {d.requirements}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      Entrega prevista:{" "}
                      <span className="font-medium text-foreground">
                        {d.expectedDate
                          ? new Date(d.expectedDate).toLocaleDateString("pt-BR")
                          : "—"}
                      </span>
                    </span>
                    <span className="font-semibold text-brand">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />

                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Etapas do processo
                    </div>
                    <div className="space-y-1">
                      {d.stages.map((e) => (
                        <button
                          key={e.id}
                          disabled={!isAuthorized}
                          onClick={() => advanceStage.mutate({ stageId: e.id, current: e.status })}
                          className="flex w-full items-center gap-2 rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-left text-[11px] transition-colors hover:border-brand/30 hover:bg-brand-soft/30 disabled:cursor-default disabled:hover:border-border/50 disabled:hover:bg-background"
                        >
                          {etapaIcon(e.status)}
                          <span className="flex-1 truncate font-medium text-foreground">
                            {e.stageName}
                          </span>
                          {e.responsibleName && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <User className="h-3 w-3" /> {e.responsibleName.split(" ")[0]}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {d.comparisonDeliveredVsRequested ? (
                    <div className="rounded-lg border border-[color:var(--success)]/30 bg-[color:var(--success)]/5 p-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--success)]">
                        Pedido × Entregue
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-foreground/85">
                        {d.comparisonDeliveredVsRequested}
                      </p>
                    </div>
                  ) : todasConcluidas && isAuthorized ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full rounded-lg border-brand/40 text-xs text-brand hover:bg-brand-soft/50"
                      onClick={() =>
                        setComparar({
                          id: d.id,
                          texto: `Solicitado: ${d.requirements}\nEntregue: `,
                        })
                      }
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Concluir e comparar pedido ×
                      entrega
                    </Button>
                  ) : !todasConcluidas ? (
                    <p className="text-[10px] text-muted-foreground">
                      A comparação entre o que foi pedido e o que foi entregue é liberada quando
                      todas as etapas estiverem concluídas.
                    </p>
                  ) : null}

                  {isAuthorized && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-lg border-[color:var(--severity-critical)]/40 text-xs text-[color:var(--severity-critical)] hover:bg-[color:var(--severity-critical)]/10"
                      disabled={!!d.generatedNcId}
                      onClick={() => registrarNC(d)}
                    >
                      {d.generatedNcId ? (
                        <>
                          <FileWarning className="mr-1.5 h-3.5 w-3.5" /> NC já registrada
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Registrar Não
                          Conformidade
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {lista.length === 0 && (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma demanda encontrada para esse filtro.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={openNova} onOpenChange={setOpenNova}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Demanda</DialogTitle>
            <DialogDescription>
              As etapas padrão do processo são criadas automaticamente e podem ser acompanhadas no
              card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Cliente / origem da demanda
              </label>
              <Input
                value={nova.clientOrOrigin}
                onChange={(e) => setNova({ ...nova, clientOrOrigin: e.target.value })}
                className="h-9 rounded-lg text-xs"
                placeholder="Ex.: Cliente Alpha S/A — Pedido comercial nº 4471"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Requisitos do pedido
              </label>
              <Textarea
                value={nova.requirements}
                onChange={(e) => setNova({ ...nova, requirements: e.target.value })}
                rows={3}
                className="rounded-lg text-xs"
                placeholder="O que o cliente solicitou, com critérios de aceitação…"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Data prevista de entrega
              </label>
              <Input
                type="date"
                value={nova.expectedDate}
                onChange={(e) => setNova({ ...nova, expectedDate: e.target.value })}
                className="h-9 rounded-lg text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setOpenNova(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
              disabled={!nova.clientOrOrigin.trim() || !nova.requirements.trim()}
              onClick={salvarNova}
            >
              Adicionar demanda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!comparar} onOpenChange={(v) => !v && setComparar(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Comparação entre pedido e entrega</DialogTitle>
            <DialogDescription>
              Registre o que foi solicitado, o que foi efetivamente entregue e eventuais
              divergências.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={comparar?.texto ?? ""}
            onChange={(e) => setComparar((p) => (p ? { ...p, texto: e.target.value } : p))}
            rows={7}
            className="rounded-lg text-xs"
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setComparar(null)}>
              Cancelar
            </Button>
            <Button
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
              onClick={salvarComparacao}
            >
              Concluir demanda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
