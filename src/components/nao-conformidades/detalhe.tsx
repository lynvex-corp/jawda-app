import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Clock,
  Edit3,
  FileDown,
  MoreVertical,
  Paperclip,
  RefreshCcw,
  ShieldAlert,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  BadgeCheck,
  Sparkles,
} from "lucide-react";
import { ListChecks, ChevronRight } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Textarea } from "@/components/ui/textarea";
import { severityClasses, statusClasses, usuariosMock } from "@/lib/mock-data";
import { mockPlanos, planoStatusClasses } from "@/lib/mock-data";
import { useCancelNC, useNC, useNCs } from "@/lib/queries/ncs";
import { cn } from "@/lib/utils";

type StepStatus = "done" | "current" | "pending";

interface TimelineStep {
  key: string;
  title: string;
  status: StepStatus;
  date?: string;
  responsavel?: { nome: string; iniciais: string };
  resumo?: React.ReactNode;
}

export function NCDetailPage() {
  const { id } = useParams({ from: "/nao-conformidades/$id" });
  const { data: nc, isLoading, isError } = useNC(id);
  const { data: allNCs = [] } = useNCs();
  const cancelNC = useCancelNC();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          Carregando não conformidade…
        </div>
      </AppShell>
    );
  }

  if (isError || !nc) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-sm text-[color:var(--severity-critical)]">
          Não foi possível carregar esta não conformidade.
        </div>
      </AppShell>
    );
  }

  function handleConfirmCancel() {
    if (!nc || !cancelReason.trim()) return;
    cancelNC.mutate(
      { id: nc.id, reason: cancelReason.trim() },
      {
        onSuccess: () => {
          toast.success(`${nc.codigo} cancelada`, { description: cancelReason.trim() });
          setCancelOpen(false);
          setCancelReason("");
        },
        onError: () =>
          toast.error("Não foi possível cancelar a NC", {
            description: "Tente novamente em instantes.",
          }),
      },
    );
  }

  const criadoEm = new Date(nc.criadoEm);
  const prazo = new Date(nc.prazoSLA);
  const totalMs = prazo.getTime() - criadoEm.getTime();
  const elapsed = Date.now() - criadoEm.getTime();
  const progresso = Math.max(0, Math.min(100, (elapsed / Math.max(totalMs, 1)) * 100));
  const slaColor =
    nc.slaStatus === "vencido"
      ? "bg-[color:var(--severity-critical)]"
      : nc.slaStatus === "proximo"
        ? "bg-[color:var(--warning)]"
        : "bg-[color:var(--success)]";
  const slaLabel =
    nc.slaStatus === "vencido"
      ? `Vencido há ${formatDistanceToNowStrict(prazo, { locale: ptBR })}`
      : `Vence em ${formatDistanceToNowStrict(prazo, { locale: ptBR })}`;

  const responsavelExt = usuariosMock.find((u) => u.nome === nc.responsavel.nome) ?? {
    id: "u0",
    nome: nc.responsavel.nome,
    iniciais: nc.responsavel.iniciais,
    cargo: "Responsável pela tratativa",
  };

  const steps: TimelineStep[] = [
    {
      key: "id",
      title: "Identificação",
      status: "done",
      date: format(criadoEm, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
      responsavel: { nome: "Ana Ribeiro", iniciais: "AR" },
      resumo: (
        <>
          Registrada via <strong>{nc.origem}</strong> no setor <strong>{nc.local}</strong>. Tipo: real, ação corretiva. 3 evidências anexadas.
        </>
      ),
    },
    {
      key: "class",
      title: "Classificação",
      status: "done",
      date: format(new Date(criadoEm.getTime() + 3600_000 * 4), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
      responsavel: { nome: "Beatriz Souza", iniciais: "BS" },
      resumo: (
        <>
          Gravidade <strong>{nc.gravidade}</strong>, categoria Qualidade. SLA definido conforme matriz corporativa.
        </>
      ),
    },
    {
      key: "causa",
      title: "Análise de Causa",
      status: nc.status === "Em Análise" ? "current" : "done",
      date: format(new Date(criadoEm.getTime() + 86400_000), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
      responsavel: { nome: "Carlos Mendes", iniciais: "CM" },
      resumo: (
        <>
          Ferramenta: 5 Porquês. Causa raiz: <em>"Falha no processo de gestão da calibração de equipamentos de medição."</em>
        </>
      ),
    },
    {
      key: "plano",
      title: "Plano de Ação",
      status:
        nc.status === "Plano em Execução"
          ? "current"
          : ["Em Avaliação", "Encerrada"].includes(nc.status)
            ? "done"
            : "pending",
      date: format(new Date(criadoEm.getTime() + 86400_000 * 2), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
      responsavel: { nome: "Diego Almeida", iniciais: "DA" },
      resumo: (
        <>
          Contenção imediata + detalhamento da ação aprovados. Prazo: {format(prazo, "dd/MM/yyyy", { locale: ptBR })}.
        </>
      ),
    },
    {
      key: "eficacia",
      title: "Avaliação de Eficácia",
      status:
        nc.status === "Encerrada" ? "done" : nc.status === "Em Avaliação" ? "current" : "pending",
      responsavel: { nome: "Fernanda Lima", iniciais: "FL" },
      resumo:
        nc.status === "Encerrada"
          ? "Resultado: Aprovado — ação eficaz confirmada por reinspeção."
          : nc.status === "Em Avaliação"
            ? "Aguardando parecer do avaliador designado."
            : "Etapa pendente.",
    },
  ];

  const evidencias = [
    { name: "foto-linha-envase.jpg", kind: "image" as const },
    { name: "relatorio-inspecao.pdf", kind: "file" as const },
    { name: "checklist-turno.pdf", kind: "file" as const },
    { name: "amostra-lote-4821.jpg", kind: "image" as const },
  ];

  const ncsRelacionadas = nc.reincidente
    ? allNCs.filter((n) => n.id !== nc.id && n.gravidade === nc.gravidade).slice(0, 3)
    : [];

  const planoVinculado = mockPlanos.find((p) => p.vinculadoLink === nc.id);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2 text-muted-foreground">
              <Link to="/nao-conformidades">
                <ArrowLeft className="h-4 w-4" /> Voltar para lista
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-base font-semibold text-brand">{nc.codigo}</span>
              <Badge variant="outline" className={cn("rounded-md border text-xs", statusClasses(nc.status))}>
                {nc.status}
              </Badge>
              <Badge variant="outline" className={cn("rounded-md border text-xs", severityClasses(nc.gravidade))}>
                Gravidade {nc.gravidade}
              </Badge>
              {nc.reincidente && (
                <Badge variant="outline" className="gap-1 rounded-md border-[color:var(--severity-high)]/30 bg-[color:var(--severity-high)]/10 text-[color:var(--severity-high)]">
                  <RefreshCcw className="h-3 w-3" /> Reincidente
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-1.5 rounded-lg">
              <Edit3 className="h-4 w-4" /> Editar
            </Button>
            <Button variant="outline" className="gap-1.5 rounded-lg">
              <FileDown className="h-4 w-4" /> Exportar RNC (PDF)
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-lg">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Duplicar NC</DropdownMenuItem>
                <DropdownMenuItem>Reatribuir responsável</DropdownMenuItem>
                <DropdownMenuItem>Vincular a plano de ação</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={nc.status === "Cancelada" || nc.status === "Encerrada"}
                  onSelect={() => setCancelOpen(true)}
                  className="text-[color:var(--severity-critical)]"
                >
                  Cancelar NC
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Coluna principal */}
          <div className="space-y-6">
            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div>
                  <h1 className="text-lg font-semibold text-foreground">Descrição da Não Conformidade</h1>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">{nc.descricao}</p>
                </div>
                <Separator />
                <div className="flex items-start gap-3 rounded-lg border border-brand/20 bg-brand-soft/40 p-3">
                  <Sparkles className="mt-0.5 h-4 w-4 text-brand" />
                  <div className="text-xs text-foreground/80">
                    <span className="font-semibold text-brand">Insight da IA:</span> padrão de reincidência identificado em NCs relacionadas a calibração — considere revisar o cronograma preventivo.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardContent className="space-y-1 p-6">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-foreground">Trilha de Auditoria</h2>
                  <p className="text-xs text-muted-foreground">Histórico completo das etapas do fluxo.</p>
                </div>
                <div className="relative pl-8">
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-6">
                    {steps.map((s) => {
                      const isDone = s.status === "done";
                      const isCurrent = s.status === "current";
                      return (
                        <div key={s.key} className="relative">
                          <div
                            className={cn(
                              "absolute -left-8 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2",
                              isDone && "border-[color:var(--success)] bg-[color:var(--success)] text-white",
                              isCurrent && "border-brand bg-brand-soft text-brand animate-pulse",
                              !isDone && !isCurrent && "border-border bg-muted text-muted-foreground",
                            )}
                          >
                            {isDone ? (
                              <Check className="h-3 w-3" />
                            ) : isCurrent ? (
                              <Clock className="h-3 w-3" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn("text-sm font-semibold", !isDone && !isCurrent && "text-muted-foreground")}>
                                {s.title}
                              </span>
                              {isCurrent && (
                                <Badge variant="outline" className="rounded-md border-brand/30 bg-brand-soft text-[10px] text-brand">
                                  Em andamento
                                </Badge>
                              )}
                              {s.date && (
                                <span className="text-xs text-muted-foreground">· {s.date}</span>
                              )}
                            </div>
                            {s.resumo && (
                              <p className={cn("text-xs leading-relaxed", isDone || isCurrent ? "text-foreground/80" : "text-muted-foreground")}>
                                {s.resumo}
                              </p>
                            )}
                            {s.responsavel && (isDone || isCurrent) && (
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="bg-brand-soft text-[9px] font-semibold text-brand">
                                    {s.responsavel.iniciais}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{s.responsavel.nome}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna lateral */}
          <div className="space-y-6">
            {planoVinculado && (
              <Card className="rounded-xl border-brand/20 bg-brand-soft/20 shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-brand" />
                    <h3 className="text-sm font-semibold text-foreground">Plano de Ação Vinculado</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-brand">{planoVinculado.codigo}</span>
                    <Badge variant="outline" className={cn("rounded-md border text-[10px]", planoStatusClasses[planoVinculado.status].badge)}>
                      {planoVinculado.status}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-xs text-foreground/80">{planoVinculado.descricao}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Progresso</span>
                      <span className="font-medium text-foreground">{planoVinculado.percentual}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-brand transition-all" style={{ width: `${planoVinculado.percentual}%` }} />
                    </div>
                  </div>
                  <Button asChild size="sm" className="w-full gap-1 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90">
                    <Link to="/planos-de-acao/$id" params={{ id: planoVinculado.id }}>
                      Ver Plano Completo <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
            {!planoVinculado && (
              <Card className="rounded-xl border-brand/20 bg-brand-soft/20 shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-brand" />
                    <h3 className="text-sm font-semibold text-foreground">Plano de Ação</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Nenhum plano vinculado. Ao criar, a origem e a causa raiz desta NC já vão preenchidas
                    direto na etapa de detalhamento da ação.
                  </p>
                  <Button asChild size="sm" className="w-full gap-1 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90">
                    <Link
                      to="/planos-de-acao/novo"
                      search={{
                        origem: "Não Conformidade",
                        vinculado: nc.codigo,
                        problema: nc.descricao,
                      }}
                    >
                      Criar plano de ação <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold text-foreground">Informações</h3>
                <dl className="space-y-3 text-xs">
                  <InfoRow label="Origem" value={nc.origem} />
                  <InfoRow label="Local" value={nc.local} />
                  <InfoRow label="Requisito normativo" value="ISO 9001:2015 — 10.2" />
                  <div>
                    <dt className="text-muted-foreground">Responsável</dt>
                    <dd className="mt-1 flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-brand-soft text-[10px] font-semibold text-brand">
                          {responsavelExt.iniciais}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium text-foreground">{responsavelExt.nome}</div>
                        <div className="text-[10px] text-muted-foreground">{responsavelExt.cargo}</div>
                      </div>
                    </dd>
                  </div>
                </dl>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Prazo SLA</span>
                    <span className="font-medium text-foreground">{format(prazo, "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full transition-all", slaColor)} style={{ width: `${Math.min(progresso, 100)}%` }} />
                  </div>
                  <div className={cn(
                    "text-[11px] font-medium",
                    nc.slaStatus === "vencido" && "text-[color:var(--severity-critical)]",
                    nc.slaStatus === "proximo" && "text-[color:var(--severity-high)]",
                    nc.slaStatus === "ok" && "text-[color:var(--success)]",
                  )}>
                    {slaLabel}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Evidências</h3>
                  <span className="text-[10px] text-muted-foreground">{evidencias.length} arquivos</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {evidencias.map((ev, i) => (
                    <div key={i} className="aspect-square overflow-hidden rounded-lg border border-border/70 bg-muted">
                      {ev.kind === "image" ? (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-soft to-brand/20 text-brand">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-muted-foreground">
                          <FileText className="h-7 w-7" />
                          <span className="line-clamp-2 text-center text-[9px]">{ev.name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full gap-1 rounded-lg">
                  <Paperclip className="h-3.5 w-3.5" /> Ver todas
                </Button>
              </CardContent>
            </Card>

            {ncsRelacionadas.length > 0 && (
              <Card className="rounded-xl border-[color:var(--severity-high)]/20 bg-[color:var(--severity-high)]/5 shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[color:var(--severity-high)]" />
                    <h3 className="text-sm font-semibold text-foreground">NCs relacionadas</h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Esta NC foi marcada como reincidente. Ocorrências vinculadas:
                  </p>
                  <div className="space-y-2">
                    {ncsRelacionadas.map((r) => (
                      <Link
                        key={r.id}
                        to="/nao-conformidades/$id"
                        params={{ id: r.id }}
                        className="block rounded-lg border border-border/70 bg-card p-2.5 transition-colors hover:border-brand/40 hover:bg-brand-soft/30"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-semibold text-brand">{r.codigo}</span>
                          <Badge variant="outline" className={cn("rounded-md border text-[9px]", severityClasses(r.gravidade))}>
                            {r.gravidade}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-foreground/80">{r.descricao}</p>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-brand" />
                  <h3 className="text-sm font-semibold text-foreground">Aprovações</h3>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Classificação</span>
                  <span className="font-medium text-[color:var(--success)]">Aprovada</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Plano de ação</span>
                  <span className="font-medium text-[color:var(--success)]">Aprovado</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Eficácia</span>
                  <span className="font-medium text-muted-foreground">Pendente</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar {nc.codigo}?</AlertDialogTitle>
            <AlertDialogDescription>
              Nada é apagado — a NC fica marcada como cancelada e permanece no histórico. O
              motivo é obrigatório e fica registrado na trilha de auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Descreva o motivo do cancelamento…"
            rows={3}
            className="rounded-lg"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason("")}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!cancelReason.trim() || cancelNC.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCancel();
              }}
              className="bg-[color:var(--severity-critical)] text-white hover:bg-[color:var(--severity-critical)]/90"
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}