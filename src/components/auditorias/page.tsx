import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Plus,
  Play,
  AlertTriangle,
  Target,
  LayoutList,
  Rows3,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AUDIT_EVENT_LABEL,
  AUDIT_STATUS_LABEL,
  AUDIT_TYPE_LABEL,
  useAudits,
  useAuditKpis,
  useUpdateAuditStatus,
  type AuditRow,
  type AuditStatusDb,
} from "@/lib/queries/audits";
import { cn } from "@/lib/utils";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STATUS_CLASSES: Record<AuditStatusDb, string> = {
  programada: "bg-brand-soft text-brand border-brand/20",
  em_andamento: "bg-brand text-white border-brand",
  concluida:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  cancelada: "bg-muted text-muted-foreground border-border",
};

function KPI({
  label,
  value,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "brand" | "success" | "warning" | "danger";
}) {
  const toneCls = {
    brand: "bg-brand-soft text-brand",
    success: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
    warning: "bg-[color:var(--warning)]/20 text-[color:var(--severity-high)]",
    danger: "bg-[color:var(--severity-critical)]/15 text-[color:var(--severity-critical)]",
  }[tone];
  return (
    <Card className="rounded-xl">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", toneCls)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditCard({ a }: { a: AuditRow }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {a.type === "interna" ? "Interna" : `Externa · ${a.external_certifier ?? "—"}`}
        </span>
        <Badge variant="outline" className={cn("border text-[10px]", STATUS_CLASSES[a.status])}>
          {AUDIT_STATUS_LABEL[a.status]}
        </Badge>
      </div>
      <div className="mb-1.5 flex flex-wrap gap-1">
        <span className="inline-flex items-center rounded-full border border-brand/20 bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
          ISO 9001
        </span>
      </div>
      <div className="text-sm font-medium text-foreground">
        {a.type === "externa" && a.event ? AUDIT_EVENT_LABEL[a.event] : a.code}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {new Date(a.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
        {a.lead_auditor ? ` · ${a.lead_auditor.full_name}` : ""}
      </div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{a.scope}</div>
    </div>
  );
}

export function AuditoriasPage() {
  const navigate = useNavigate();
  const { data: audits = [] } = useAudits();
  const { data: kpis } = useAuditKpis();
  const updateStatus = useUpdateAuditStatus();
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [tipo, setTipo] = useState("all");
  const [status, setStatus] = useState("all");

  const anosDisponiveis = useMemo(() => {
    const anos = new Set(audits.map((a) => new Date(a.start_date).getFullYear()));
    anos.add(new Date().getFullYear());
    return [...anos].sort((a, b) => b - a);
  }, [audits]);

  const filtered = useMemo(() => {
    return audits.filter((a) => {
      if (String(new Date(a.start_date).getFullYear()) !== ano) return false;
      if (tipo !== "all" && a.type !== tipo) return false;
      if (status !== "all" && a.status !== status) return false;
      return true;
    });
  }, [audits, ano, tipo, status]);

  const liveKpis = useMemo(() => {
    const doAno = audits.filter((a) => String(new Date(a.start_date).getFullYear()) === ano);
    return {
      totalAno: doAno.length,
      realizadas: doAno.filter((a) => a.status === "concluida").length,
      programadas: doAno.filter((a) => a.status === "programada").length,
      emAndamento: doAno.filter((a) => a.status === "em_andamento").length,
      apontamentosAbertos: kpis?.apontamentosAbertos ?? 0,
      taxaConformidade: kpis?.taxaConformidade ?? 0,
    };
  }, [audits, ano, kpis]);

  const porMes = useMemo(() => {
    const map = new Map<number, AuditRow[]>();
    for (const a of filtered) {
      const mes = new Date(a.start_date).getMonth() + 1;
      if (!map.has(mes)) map.set(mes, []);
      map.get(mes)!.push(a);
    }
    return map;
  }, [filtered]);

  function iniciar(a: AuditRow) {
    updateStatus.mutate(
      { id: a.id, status: "em_andamento" },
      { onSuccess: () => toast.success(`${a.code} iniciada.`) },
    );
  }
  function concluir(a: AuditRow) {
    updateStatus.mutate(
      { id: a.id, status: "concluida" },
      { onSuccess: () => toast.success(`${a.code} concluída.`) },
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              Auditorias
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Programa anual, execução e apontamentos das auditorias internas e externas.
            </p>
          </div>
          <Button asChild className="shrink-0 bg-brand hover:bg-brand/90">
            <Link to="/auditorias/nova">
              <Plus className="mr-1.5 h-4 w-4" />
              Programar Nova Auditoria
            </Link>
          </Button>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KPI label="Auditorias no ano" value={liveKpis.totalAno} icon={CalendarDays} />
          <KPI label="Realizadas" value={liveKpis.realizadas} icon={CheckCircle2} tone="success" />
          <KPI label="Programadas" value={liveKpis.programadas} icon={Clock} />
          <KPI label="Em andamento" value={liveKpis.emAndamento} icon={Play} tone="brand" />
          <KPI
            label="Apontamentos abertos"
            value={liveKpis.apontamentosAbertos}
            icon={AlertTriangle}
            tone="warning"
          />
          <KPI
            label="Taxa de conformidade"
            value={`${liveKpis.taxaConformidade}%`}
            icon={Target}
            tone="success"
          />
        </div>

        <Card className="rounded-xl">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="interna">Interna</SelectItem>
                <SelectItem value="externa">Externa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="programada">Programada</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Programa Anual de Auditorias · {ano}</CardTitle>
              <p className="text-xs text-muted-foreground">
                Distribuição das auditorias por mês. Cada card representa uma auditoria programada.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[1100px] grid-cols-12 gap-2">
                {MESES.map((m, i) => (
                  <div key={m} className="border-l border-dashed border-border pl-2">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {m}
                    </div>
                    <div className="flex min-h-[120px] flex-col gap-2">
                      {(porMes.get(i + 1) ?? []).map((a) => (
                        <AuditCard key={a.id} a={a} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="tabela">
          <TabsList>
            <TabsTrigger value="tabela">
              <Rows3 className="mr-1.5 h-4 w-4" />
              Tabela
            </TabsTrigger>
            <TabsTrigger value="lista">
              <LayoutList className="mr-1.5 h-4 w-4" />
              Lista compacta
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tabela">
            <Card className="rounded-xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Líder</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate({ to: "/auditorias/$id", params: { id: a.id } })}
                      >
                        <TableCell className="font-mono text-xs">{a.code}</TableCell>
                        <TableCell className="text-sm">
                          {a.type === "interna" ? (
                            "Interna"
                          ) : (
                            <span>
                              Externa
                              <span className="ml-1 text-xs text-muted-foreground">
                                · {a.external_certifier}
                              </span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.event ? AUDIT_EVENT_LABEL[a.event] : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(a.start_date).toLocaleDateString("pt-BR")} —{" "}
                          {new Date(a.end_date).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.lead_auditor?.full_name ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("border text-xs", STATUS_CLASSES[a.status])}
                          >
                            {AUDIT_STATUS_LABEL[a.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {a.status === "programada" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => iniciar(a)}
                            >
                              <Play className="mr-1 h-3 w-3" /> Iniciar
                            </Button>
                          )}
                          {a.status === "em_andamento" && a.type === "externa" && (
                            <Button
                              size="sm"
                              className="h-7 bg-[color:var(--success)] text-white text-xs hover:bg-[color:var(--success)]/90"
                              onClick={() => concluir(a)}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Concluir
                            </Button>
                          )}
                          {a.status === "em_andamento" && a.type === "interna" && (
                            <span className="text-[11px] text-muted-foreground">
                              Concluir via Relatório
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="lista">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((a) => (
                <AuditCard key={a.id} a={a} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
