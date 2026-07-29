import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Plus,
  FilePlus2,
  ListChecks,
  Activity,
  CheckCircle2,
  AlertOctagon,
  Target,
  DollarSign,
  Search,
  Calendar,
  ListFilter,
  Table as TableIcon,
  LayoutGrid,
  GanttChart,
  AlertTriangle,
  ClipboardCheck,
  Shield,
  Sparkles,
  MessageSquare,
  Users as UsersIcon,
  Eye,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  planoStatusClasses,
  pdcaClasses,
  planosPorMes,
  eficaciaTrimestral,
  type PlanoStatus,
  type PlanoOrigemTipo,
} from "@/lib/mock-data";
import { useAuth } from "@/hooks/use-auth";
import {
  useCorrectiveActions,
  useOrgMembers,
  useUpdateCorrectiveActionStatus,
  useApproveNextAttempt,
  mapCorrectiveActionToView,
  VERIFICATION_REASON_LABEL,
  REQUIRED_APPROVAL_ROLE_LABEL,
  type CorrectiveActionView,
} from "@/lib/queries/action-plans";
import { EffectivenessDialog } from "@/components/planos-de-acao/effectiveness-dialog";

const STATUSES: PlanoStatus[] = [
  "Planejado",
  "Em Execução",
  "Em Avaliação",
  "Concluído",
  "Atrasado",
  "Cancelado",
];

const ORIGENS: PlanoOrigemTipo[] = [
  "Não Conformidade",
  "Auditoria Interna",
  "Auditoria Externa",
  "Risco/Oportunidade",
  "Análise Crítica",
  "Reclamação de Cliente",
  "Melhoria Contínua",
];

const PERIODOS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Últimos 12 meses" },
  { value: "all", label: "Todo o período" },
];

const KANBAN_STATUSES: PlanoStatus[] = ["Planejado", "Em Execução", "Em Avaliação", "Concluído"];

const origemIcon: Record<PlanoOrigemTipo, typeof AlertTriangle> = {
  "Não Conformidade": AlertTriangle,
  "Auditoria Interna": ClipboardCheck,
  "Auditoria Externa": ClipboardCheck,
  "Risco/Oportunidade": Shield,
  "Análise Crítica": Target,
  "Reclamação de Cliente": MessageSquare,
  "Melhoria Contínua": Sparkles,
  Estratégia: Target,
};

const origemBadge: Record<PlanoOrigemTipo, string> = {
  "Não Conformidade":
    "bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)] border-[color:var(--severity-critical)]/30",
  "Auditoria Interna": "bg-brand-soft text-brand border-brand/20",
  "Auditoria Externa":
    "bg-[color:var(--chart-2)]/15 text-[color:var(--chart-2)] border-[color:var(--chart-2)]/30",
  "Risco/Oportunidade":
    "bg-[color:var(--severity-high)]/15 text-[color:var(--severity-high)] border-[color:var(--severity-high)]/30",
  "Análise Crítica":
    "bg-[color:var(--warning)]/20 text-[color:var(--severity-high)] border-[color:var(--warning)]/40",
  "Reclamação de Cliente":
    "bg-[color:var(--chart-3)]/15 text-[color:var(--chart-3)] border-[color:var(--chart-3)]/30",
  "Melhoria Contínua":
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  Estratégia: "bg-brand-soft text-brand border-brand/20",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  hint?: string;
  tone: "default" | "info" | "warning" | "success" | "danger";
}) {
  const toneMap = {
    default: "text-muted-foreground bg-muted",
    info: "text-brand bg-brand-soft",
    warning: "text-[color:var(--severity-high)] bg-[color:var(--severity-high)]/10",
    success: "text-[color:var(--success)] bg-[color:var(--success)]/10",
    danger: "text-[color:var(--severity-critical)] bg-[color:var(--severity-critical)]/10",
  } as const;
  return (
    <Card className="rounded-xl border-border/80 shadow-sm">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function OrigemBadge({ tipo }: { tipo: PlanoOrigemTipo }) {
  const Icon = origemIcon[tipo];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 rounded-md border font-normal", origemBadge[tipo])}
    >
      <Icon className="h-3 w-3" />
      {tipo}
    </Badge>
  );
}

function KanbanCard({
  p,
  onDragStart,
  atrasado,
  canApprove,
  onApprove,
  onVerify,
}: {
  p: CorrectiveActionView;
  onDragStart: (id: string) => void;
  atrasado: boolean;
  canApprove: boolean;
  onApprove: () => void;
  onVerify: () => void;
}) {
  const aguardandoAprovacao = p.statusDb === "aguardando_aprovacao";
  const aguardandoVerificacao = p.statusDb === "aguardando_verificacao";
  return (
    <div
      draggable={!aguardandoAprovacao}
      onDragStart={(e) => {
        if (aguardandoAprovacao) return;
        onDragStart(p.actionId);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-brand/40 hover:shadow-md",
        aguardandoAprovacao ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        atrasado
          ? "border-[color:var(--severity-critical)]/60 ring-1 ring-[color:var(--severity-critical)]/30"
          : "border-border/80",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold text-brand">{p.codigo}</span>
        <Badge
          variant="outline"
          className={cn("rounded-md border px-1.5 text-[10px]", pdcaClasses[p.pdca])}
        >
          {p.pdca}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-foreground">{p.descricao}</p>
      {atrasado && (
        <div className="mt-1 text-[10px] font-semibold text-[color:var(--severity-critical)]">
          Prazo vencido
        </div>
      )}
      {p.restartReason && (
        <div className="mt-1 inline-flex rounded border border-[color:var(--severity-critical)]/40 bg-[color:var(--severity-critical)]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[color:var(--severity-critical)]">
          Nova tentativa · {VERIFICATION_REASON_LABEL[p.restartReason].slice(0, 40)}
        </div>
      )}
      {aguardandoAprovacao && p.requiredApprovalRole && (
        <div className="mt-2 rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-2">
          <div className="text-[10px] font-semibold text-[color:var(--severity-high)]">
            Aguardando aprovação de {REQUIRED_APPROVAL_ROLE_LABEL[p.requiredApprovalRole]}
          </div>
          {canApprove && (
            <Button
              size="sm"
              className="mt-1.5 h-6 w-full rounded-md bg-brand text-[10px] text-brand-foreground hover:bg-brand/90"
              onClick={onApprove}
            >
              Aprovar próxima tentativa
            </Button>
          )}
        </div>
      )}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Progresso</span>
          <span className="font-medium text-foreground">{p.percentual}%</span>
        </div>
        <Progress value={p.percentual} className="h-1.5 bg-muted [&>div]:bg-brand" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <OrigemBadge tipo={p.origemTipo} />
        <Avatar className="h-6 w-6">
          <AvatarFallback className="bg-brand-soft text-brand text-[10px] font-semibold">
            {p.responsavel.iniciais}
          </AvatarFallback>
        </Avatar>
      </div>
      {aguardandoVerificacao && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 w-full rounded-md border-brand/40 text-[11px] text-brand hover:bg-brand-soft"
          onClick={onVerify}
        >
          Verificar eficácia
        </Button>
      )}
    </div>
  );
}

export function PlanosDeAcaoPage() {
  const { data: rows = [], isLoading } = useCorrectiveActions();
  const { data: orgMembers = [] } = useOrgMembers();
  const { user, currentOrg } = useAuth();
  const updateStatus = useUpdateCorrectiveActionStatus();
  const approveNext = useApproveNextAttempt();

  const roleByUserId = useMemo(
    () => Object.fromEntries(orgMembers.map((m) => [m.id, m.role])),
    [orgMembers],
  );
  const items = useMemo(
    () => rows.map((r) => mapCorrectiveActionToView(r, roleByUserId)),
    [rows, roleByUserId],
  );

  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState("all");
  const [status, setStatus] = useState("all");
  const [responsavel, setResponsavel] = useState("all");
  const [departamento, setDepartamento] = useState("all");
  const [periodo, setPeriodo] = useState("all");
  const [somenteAtrasados, setSomenteAtrasados] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Ação alvo do modal de verificação de eficácia (componente compartilhado
  // — ver src/components/planos-de-acao/effectiveness-dialog.tsx).
  const [evalTarget, setEvalTarget] = useState<CorrectiveActionView | null>(null);

  const hoje = new Date();

  const isAtrasado = (p: CorrectiveActionView) =>
    p.status !== "Concluído" &&
    p.status !== "Cancelado" &&
    new Date(p.prazo).getTime() < hoje.getTime();

  function openEfficacyDialog(action: CorrectiveActionView) {
    setEvalTarget(action);
  }

  function closeEfficacyDialog() {
    setEvalTarget(null);
  }

  const handleDrop = (target: PlanoStatus) => {
    if (!draggingId) return;
    const action = items.find((p) => p.actionId === draggingId);
    setDraggingId(null);
    if (!action || action.status === target) return;

    if (action.statusDb === "aguardando_aprovacao") {
      toast.error(
        "Esta ação está aguardando aprovação da tentativa anterior — aprove antes de mover.",
      );
      return;
    }

    if (target === "Em Avaliação") {
      if (action.statusDb !== "em_execucao" && action.statusDb !== "planejada") {
        toast.error(
          "Só é possível solicitar verificação de eficácia a partir de uma ação planejada ou em execução.",
        );
        return;
      }
      updateStatus.mutate(
        { id: action.actionId, status: "aguardando_verificacao" },
        {
          onSuccess: (row) => openEfficacyDialog(mapCorrectiveActionToView(row, roleByUserId)),
          onError: (err) =>
            toast.error("Não foi possível mover a ação.", {
              description: err instanceof Error ? err.message : undefined,
            }),
        },
      );
      return;
    }

    if (target === "Em Execução" && action.statusDb === "planejada") {
      updateStatus.mutate(
        { id: action.actionId, status: "em_execucao" },
        { onSuccess: () => toast.success(`${action.codigo} movido para Em Execução.`) },
      );
      return;
    }

    if (target === "Concluído") {
      toast.error(
        'Conclusão só acontece pela verificação de eficácia — arraste para "Em Avaliação".',
      );
      return;
    }

    toast.error("Movimento não permitido neste fluxo.");
  };

  function canApprove(action: CorrectiveActionView) {
    if (!action.requiredApprovalRole || !currentOrg) return false;
    if (currentOrg.role === "admin") return true;
    return currentOrg.role === action.requiredApprovalRole;
  }

  function handleApprove(action: CorrectiveActionView) {
    if (!user) return;
    approveNext.mutate(
      { id: action.actionId, approvedBy: user.id },
      {
        onSuccess: () => toast.success(`${action.codigo} aprovada — pode seguir para execução.`),
        onError: (err) =>
          toast.error("Não foi possível aprovar.", {
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
  }

  const responsaveis = useMemo(
    () => Array.from(new Set(items.map((i) => i.responsavel.nome))).sort(),
    [items],
  );
  const departamentos = useMemo(
    () => Array.from(new Set(items.map((i) => i.responsavel.departamento))).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const now = hoje.getTime();
    const maxAge = periodo === "all" ? Infinity : Number(periodo) * 86_400_000;
    const q = busca.trim().toLowerCase();
    return items.filter((p) => {
      if (origem !== "all" && p.origemTipo !== origem) return false;
      if (status !== "all" && p.status !== status) return false;
      if (responsavel !== "all" && p.responsavel.nome !== responsavel) return false;
      if (departamento !== "all" && p.responsavel.departamento !== departamento) return false;
      if (somenteAtrasados && p.status !== "Atrasado") return false;
      if (now - new Date(p.inicio).getTime() > maxAge) return false;
      if (q && !`${p.codigo} ${p.descricao}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, origem, status, responsavel, departamento, periodo, somenteAtrasados, busca]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filtered.length;
    const emExecucao = filtered.filter((p) => p.status === "Em Execução").length;
    const concluidosNoPrazo = filtered.filter(
      (p) => p.status === "Concluído" && p.concluidoNoPrazo,
    ).length;
    const atrasados = filtered.filter((p) => p.status === "Atrasado").length;
    const avaliados = filtered.filter((p) => p.eficaciaAprovadaPrimeira !== null);
    const aprovados = avaliados.filter((p) => p.eficaciaAprovadaPrimeira === true).length;
    const taxaEficacia =
      avaliados.length === 0 ? 0 : Math.round((aprovados / avaliados.length) * 100);
    const custo = filtered.reduce((s, p) => s + p.custo, 0);
    return { total, emExecucao, concluidosNoPrazo, atrasados, taxaEficacia, custo };
  }, [filtered]);

  // Distribuição por status (donut)
  const porStatus = useMemo(
    () =>
      STATUSES.map((s) => ({
        status: s,
        total: filtered.filter((p) => p.status === s).length,
        fill: planoStatusClasses[s].fill,
      })).filter((s) => s.total > 0),
    [filtered],
  );

  // Por origem
  const porOrigem = useMemo(
    () =>
      ORIGENS.map((o) => ({
        origem: o,
        total: filtered.filter((p) => p.origemTipo === o).length,
      })),
    [filtered],
  );

  // Ranking por responsável (ativos = não concluídos e não cancelados)
  const ranking = useMemo(() => {
    const map = new Map<string, { nome: string; iniciais: string; ativos: number }>();
    filtered.forEach((p) => {
      if (p.status === "Concluído" || p.status === "Cancelado") return;
      const cur = map.get(p.responsavel.nome) ?? {
        nome: p.responsavel.nome,
        iniciais: p.responsavel.iniciais,
        ativos: 0,
      };
      cur.ativos += 1;
      map.set(p.responsavel.nome, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.ativos - a.ativos);
  }, [filtered]);

  // Aging de atrasados
  const aging = useMemo(() => {
    const now = hoje;
    const buckets = [
      { faixa: "1–7 dias", min: 1, max: 7, fill: "oklch(0.75 0.18 45)" },
      { faixa: "8–15 dias", min: 8, max: 15, fill: "oklch(0.68 0.20 35)" },
      { faixa: "16–30 dias", min: 16, max: 30, fill: "oklch(0.60 0.22 27)" },
      { faixa: "> 30 dias", min: 31, max: Infinity, fill: "oklch(0.48 0.20 27)" },
    ];
    return buckets.map((b) => ({
      faixa: b.faixa,
      total: filtered.filter((p) => {
        if (p.status !== "Atrasado") return false;
        const d = Math.max(0, Math.round((now.getTime() - new Date(p.prazo).getTime()) / 86400000));
        return d >= b.min && d <= b.max;
      }).length,
      fill: b.fill,
    }));
  }, [filtered]);

  const activeFilters =
    (origem !== "all" ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (responsavel !== "all" ? 1 : 0) +
    (departamento !== "all" ? 1 : 0) +
    (periodo !== "all" ? 1 : 0) +
    (somenteAtrasados ? 1 : 0) +
    (busca ? 1 : 0);

  // Gantt bounds
  const ganttBounds = useMemo(() => {
    if (filtered.length === 0) {
      const now = hoje.getTime();
      return { min: now - 30 * 86400000, max: now + 30 * 86400000 };
    }
    const mins = filtered.map((p) => new Date(p.inicio).getTime());
    const maxs = filtered.map((p) => new Date(p.prazo).getTime());
    return { min: Math.min(...mins) - 3 * 86400000, max: Math.max(...maxs) + 3 * 86400000 };
  }, [filtered]);

  function posPct(iso: string) {
    const t = new Date(iso).getTime();
    return ((t - ganttBounds.min) / (ganttBounds.max - ganttBounds.min)) * 100;
  }
  const hojePct = ((hoje.getTime() - ganttBounds.min) / (ganttBounds.max - ganttBounds.min)) * 100;

  const donutConfig: ChartConfig = Object.fromEntries(
    STATUSES.map((s) => [s, { label: s, color: planoStatusClasses[s].fill }]),
  ) as ChartConfig;

  const barOrigemConfig: ChartConfig = { total: { label: "Planos", color: "var(--brand)" } };
  const comboConfig: ChartConfig = {
    abertos: { label: "Abertos", color: "var(--brand)" },
    concluidos: { label: "Concluídos", color: "var(--success)" },
    tempoMedio: { label: "Tempo médio (dias)", color: "var(--severity-high)" },
  };
  const eficaciaConfig: ChartConfig = { taxa: { label: "Eficácia %", color: "var(--brand)" } };
  const rankingConfig: ChartConfig = { ativos: { label: "Planos ativos", color: "var(--brand)" } };
  const agingConfig: ChartConfig = {
    total: { label: "Planos", color: "var(--severity-critical)" },
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          Carregando planos de ação…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TooltipProvider delayDuration={200}>
        <div className="mx-auto max-w-[1400px] space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Planos de Ação
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Acompanhe a execução, o prazo e a eficácia de todas as ações corretivas, preventivas
                e de melhoria da organização.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                asChild
                variant="outline"
                className="rounded-lg border-brand/30 text-brand hover:bg-brand-soft"
              >
                <Link to="/planos-de-acao/novo">
                  <FilePlus2 className="mr-1 h-4 w-4" /> Plano em branco (avulso)
                </Link>
              </Button>
              <Button
                asChild
                className="rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
              >
                <Link to="/planos-de-acao/novo">
                  <Plus className="mr-1 h-4 w-4" /> Novo Plano de Ação
                </Link>
              </Button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard icon={ListChecks} label="Total no período" value={kpis.total} tone="default" />
            <KpiCard icon={Activity} label="Em execução" value={kpis.emExecucao} tone="info" />
            <KpiCard
              icon={CheckCircle2}
              label="Concluídos no prazo"
              value={kpis.concluidosNoPrazo}
              tone="success"
            />
            <KpiCard
              icon={AlertOctagon}
              label="Atrasados"
              value={kpis.atrasados}
              hint="Requer ação imediata"
              tone="danger"
            />
            <KpiCard
              icon={Target}
              label="Taxa de eficácia"
              value={`${kpis.taxaEficacia}%`}
              hint="Aprovados na 1ª avaliação"
              tone="info"
            />
            <KpiCard
              icon={DollarSign}
              label="Custo estimado"
              value={formatBRL(kpis.custo)}
              tone="warning"
            />
          </div>

          {/* Gráficos — 2x3 */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Donut status */}
            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Planos por status</CardTitle>
                <CardDescription>Distribuição no período filtrado</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={donutConfig} className="h-[280px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
                    <Pie
                      data={porStatus}
                      dataKey="total"
                      nameKey="status"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      stroke="var(--card)"
                    >
                      {porStatus.map((s) => (
                        <Cell key={s.status} fill={s.fill} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Por origem */}
            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Planos por origem</CardTitle>
                <CardDescription>De onde vêm mais as ações</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={barOrigemConfig} className="h-[280px] w-full">
                  <BarChart data={porOrigem} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid
                      horizontal={false}
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="origem"
                      tickLine={false}
                      axisLine={false}
                      width={140}
                      style={{ fontSize: 11 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" fill="var(--color-total)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Combined bars + line */}
            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Abertos x concluídos — 12 meses
                </CardTitle>
                <CardDescription>Com tendência de tempo médio de conclusão (dias)</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={comboConfig} className="h-[280px] w-full">
                  <ComposedChart data={planosPorMes} barGap={4}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={6} />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false} width={30} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      yAxisId="left"
                      dataKey="abertos"
                      fill="var(--color-abertos)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="concluidos"
                      fill="var(--color-concluidos)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="tempoMedio"
                      stroke="var(--color-tempoMedio)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Eficácia trimestral */}
            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Evolução da taxa de eficácia
                </CardTitle>
                <CardDescription>
                  % de planos aprovados na 1ª avaliação — trimestral
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={eficaciaConfig} className="h-[280px] w-full">
                  <LineChart data={eficaciaTrimestral}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="trimestre" tickLine={false} axisLine={false} tickMargin={6} />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      width={35}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="taxa"
                      stroke="var(--color-taxa)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "var(--brand)" }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Ranking */}
            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-brand" /> Ranking por responsável
                </CardTitle>
                <CardDescription>Planos ativos por pessoa — identifica sobrecarga</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={rankingConfig} className="h-[280px] w-full">
                  <BarChart data={ranking} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid
                      horizontal={false}
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="nome"
                      tickLine={false}
                      axisLine={false}
                      width={120}
                      style={{ fontSize: 11 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="ativos" fill="var(--color-ativos)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Aging */}
            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertOctagon className="h-4 w-4 text-[color:var(--severity-critical)]" /> Aging
                  de atrasos
                </CardTitle>
                <CardDescription>Planos atrasados por faixa de dias em atraso</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={agingConfig} className="h-[280px] w-full">
                  <BarChart data={aging}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="faixa"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={6}
                      style={{ fontSize: 11 }}
                    />
                    <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {aging.map((a) => (
                        <Cell key={a.faixa} fill={a.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card className="rounded-xl border-border/80 shadow-sm">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <ListFilter className="h-3.5 w-3.5" />
                Filtros
                {activeFilters > 0 && (
                  <Badge
                    variant="outline"
                    className="ml-1 rounded-md border-brand/30 bg-brand-soft text-brand"
                  >
                    {activeFilters} ativo{activeFilters > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <div className="grid gap-3 lg:grid-cols-12">
                <div className="relative lg:col-span-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por código ou descrição…"
                    className="h-9 rounded-lg pl-9"
                  />
                </div>
                <Select value={origem} onValueChange={setOrigem}>
                  <SelectTrigger className="h-9 rounded-lg lg:col-span-2">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as origens</SelectItem>
                    {ORIGENS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 rounded-lg lg:col-span-2">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={responsavel} onValueChange={setResponsavel}>
                  <SelectTrigger className="h-9 rounded-lg lg:col-span-2">
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {responsaveis.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={departamento} onValueChange={setDepartamento}>
                  <SelectTrigger className="h-9 rounded-lg lg:col-span-2">
                    <SelectValue placeholder="Departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {departamentos.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger className="h-9 rounded-lg lg:col-span-1">
                    <Calendar className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODOS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 lg:col-span-12">
                  <Switch
                    id="atrasados"
                    checked={somenteAtrasados}
                    onCheckedChange={setSomenteAtrasados}
                  />
                  <Label htmlFor="atrasados" className="cursor-pointer text-sm">
                    Somente atrasados
                  </Label>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Mostrando {filtered.length} de {items.length} planos
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs de visualização */}
          <Tabs defaultValue="tabela" className="space-y-4">
            <TabsList className="rounded-lg bg-muted p-1">
              <TabsTrigger value="tabela" className="gap-1.5 rounded-md">
                <TableIcon className="h-4 w-4" /> Tabela
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1.5 rounded-md">
                <LayoutGrid className="h-4 w-4" /> Kanban
              </TabsTrigger>
              <TabsTrigger value="gantt" className="gap-1.5 rounded-md">
                <GanttChart className="h-4 w-4" /> Linha do tempo
              </TabsTrigger>
            </TabsList>

            {/* Tabela */}
            <TabsContent value="tabela" className="mt-0">
              <Card className="rounded-xl border-border/80 shadow-sm">
                <CardContent className="px-0 py-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="pl-6">Código</TableHead>
                        <TableHead>Motivo do Plano de Ação</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Vinculado a</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>PDCA</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead className="min-w-[140px]">Progresso</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="pr-6 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p) => (
                        <TableRow
                          key={p.id}
                          className={cn(
                            "border-border/60 transition-colors hover:bg-brand-soft/30",
                            isAtrasado(p) &&
                              "border-l-2 border-l-[color:var(--severity-critical)] bg-[color:var(--severity-critical)]/5",
                          )}
                        >
                          <TableCell className="pl-6 font-mono text-xs font-semibold text-brand">
                            {p.codigo}
                          </TableCell>
                          <TableCell className="max-w-[320px] truncate text-sm">
                            {p.motivo?.trim() || p.descricao}
                          </TableCell>
                          <TableCell>
                            <OrigemBadge tipo={p.origemTipo} />
                          </TableCell>
                          <TableCell>
                            {p.vinculadoCodigo ? (
                              p.vinculadoLink ? (
                                <Link
                                  to="/nao-conformidades/$id"
                                  params={{ id: p.vinculadoLink }}
                                  className="font-mono text-xs font-medium text-brand hover:underline"
                                >
                                  {p.vinculadoCodigo}
                                </Link>
                              ) : (
                                <span className="font-mono text-xs font-medium text-brand">
                                  {p.vinculadoCodigo}
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="bg-brand-soft text-brand text-[10px] font-semibold">
                                  {p.responsavel.iniciais}
                                </AvatarFallback>
                              </Avatar>
                              <div className="leading-tight">
                                <div className="text-sm">{p.responsavel.nome}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {p.responsavel.departamento}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn("rounded-md border font-normal", pdcaClasses[p.pdca])}
                            >
                              {p.pdca}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(p.prazo)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={p.percentual}
                                className="h-1.5 w-24 bg-muted [&>div]:bg-brand"
                              />
                              <span className="text-xs font-medium text-foreground">
                                {p.percentual}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-md border font-normal",
                                planoStatusClasses[p.status].badge,
                              )}
                            >
                              {p.status}
                            </Badge>
                            {p.statusDb === "aguardando_aprovacao" && p.requiredApprovalRole && (
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                aguarda {REQUIRED_APPROVAL_ROLE_LABEL[p.requiredApprovalRole]}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {p.statusDb === "aguardando_aprovacao" && canApprove(p) && (
                                <Button
                                  size="sm"
                                  className="h-8 gap-1 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
                                  onClick={() => handleApprove(p)}
                                >
                                  Aprovar
                                </Button>
                              )}
                              {p.statusDb === "aguardando_verificacao" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 rounded-lg border-brand/40 text-brand hover:bg-brand-soft"
                                  onClick={() => openEfficacyDialog(p)}
                                >
                                  Verificar eficácia
                                </Button>
                              )}
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-brand hover:bg-brand-soft"
                              >
                                <Link to="/planos-de-acao/$id" params={{ id: p.planId }}>
                                  <Eye className="h-4 w-4" /> Ver
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={10}
                            className="py-10 text-center text-sm text-muted-foreground"
                          >
                            Nenhum plano encontrado com os filtros atuais.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Kanban */}
            <TabsContent value="kanban" className="mt-0">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {KANBAN_STATUSES.map((s) => {
                  const cards = filtered.filter((p) => p.status === s);
                  return (
                    <div
                      key={s}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={() => handleDrop(s)}
                      className="rounded-xl border border-border/70 bg-muted/40 p-3 transition-colors hover:bg-brand-soft/40"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", planoStatusClasses[s].dot)} />
                          <span className="text-sm font-semibold text-foreground">{s}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-md border-border bg-background text-[10px] text-muted-foreground"
                        >
                          {cards.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {cards.map((p) => (
                          <KanbanCard
                            key={p.id}
                            p={p}
                            atrasado={isAtrasado(p)}
                            onDragStart={setDraggingId}
                            canApprove={canApprove(p)}
                            onApprove={() => handleApprove(p)}
                            onVerify={() => openEfficacyDialog(p)}
                          />
                        ))}
                        {cards.length === 0 && (
                          <div className="rounded-lg border border-dashed border-border/70 py-6 text-center text-xs text-muted-foreground">
                            Sem planos nesta coluna
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Gantt */}
            <TabsContent value="gantt" className="mt-0">
              <Card className="rounded-xl border-border/80 shadow-sm">
                <CardContent className="p-0">
                  <div className="grid grid-cols-[280px_1fr] border-b border-border/60 bg-muted/40 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <div className="px-4">Plano</div>
                    <div className="relative px-4">
                      <div className="flex justify-between">
                        <span>{formatDate(new Date(ganttBounds.min).toISOString())}</span>
                        <span>Hoje: {formatDate(hoje.toISOString())}</span>
                        <span>{formatDate(new Date(ganttBounds.max).toISOString())}</span>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-border/60">
                    {filtered.map((p) => {
                      const left = Math.max(0, posPct(p.inicio));
                      const right = Math.min(100, posPct(p.prazo));
                      const width = Math.max(1, right - left);
                      return (
                        <div
                          key={p.id}
                          className="grid grid-cols-[280px_1fr] items-center py-3 hover:bg-brand-soft/20"
                        >
                          <div className="flex items-center gap-2 px-4">
                            <span className="font-mono text-[11px] font-semibold text-brand">
                              {p.codigo}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate text-xs text-foreground">
                                  {p.descricao}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                {p.descricao}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="relative h-8 px-4">
                            {/* Track */}
                            <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-border/60" />
                            {/* Bar */}
                            <div
                              className="absolute top-1/2 h-4 -translate-y-1/2 rounded-md border shadow-sm"
                              style={{
                                left: `calc(${left}% + 16px)`,
                                width: `calc(${width}% - 0px)`,
                                background: planoStatusClasses[p.status].fill,
                                borderColor: planoStatusClasses[p.status].fill,
                                opacity: 0.9,
                              }}
                              title={`${formatDate(p.inicio)} → ${formatDate(p.prazo)} · ${p.percentual}%`}
                            >
                              <div
                                className="h-full rounded-md bg-white/30"
                                style={{
                                  width: `${100 - p.percentual}%`,
                                  marginLeft: `${p.percentual}%`,
                                }}
                              />
                            </div>
                            {/* Marcos */}
                            {p.marcos.map((m, idx) => (
                              <div
                                key={idx}
                                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-brand bg-card"
                                style={{ left: `calc(${posPct(m)}% + 16px)` }}
                                title={`Marco: ${formatDate(m)}`}
                              />
                            ))}
                            {/* Linha hoje */}
                            <div
                              className="absolute top-0 h-full w-px bg-[color:var(--severity-critical)]"
                              style={{ left: `calc(${hojePct}% + 16px)` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 border-t border-border/60 px-4 py-3 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rotate-45 border border-brand bg-card" /> Marco /
                      milestone
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-px bg-[color:var(--severity-critical)]" /> Hoje
                    </div>
                    <div className="flex items-center gap-1.5">
                      Barras coloridas pelo status · área clara = restante do plano
                    </div>
                    <span className="ml-auto flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Duração:{" "}
                      {daysBetween(
                        new Date(ganttBounds.max).toISOString(),
                        new Date(ganttBounds.min).toISOString(),
                      )}{" "}
                      dias no eixo
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <EffectivenessDialog action={evalTarget} onClose={closeEfficacyDialog} />
      </TooltipProvider>
    </AppShell>
  );
}
