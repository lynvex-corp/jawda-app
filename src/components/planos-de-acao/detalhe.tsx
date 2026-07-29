import { useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  ChevronRight,
  AlertTriangle,
  ShieldAlert,
  History,
  DollarSign,
  Check,
  Clock,
  MoreVertical,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  useActionPlan,
  useCorrectiveActionsByPlan,
  useOrgMembers,
  useApproveNextAttempt,
  useUpdateCorrectiveActionStatus,
  useCancelActionPlan,
  useVerifications,
  useActionPlanActivityLog,
  mapCorrectiveActionToView,
  VERIFICATION_REASON_LABEL,
  REQUIRED_APPROVAL_ROLE_LABEL,
  ACTION_PLAN_STATUS_LABEL,
  ORIGIN_DB_TO_UI,
  type CorrectiveActionView,
} from "@/lib/queries/action-plans";
import { EffectivenessDialog } from "@/components/planos-de-acao/effectiveness-dialog";
import { planoStatusClasses } from "@/lib/mock-data";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function fmtDate(iso: string | null) {
  return iso ? format(new Date(iso), "dd/MM/yyyy", { locale: ptBR }) : "—";
}

function fmtDateTime(iso: string | null) {
  return iso ? format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—";
}

export function PlanoDetailPage() {
  const { id } = useParams({ from: "/planos-de-acao/$id" });
  const { data: plan, isLoading: planLoading, isError: planError } = useActionPlan(id);
  const { data: actionRows = [], isLoading: actionsLoading } = useCorrectiveActionsByPlan(id);
  const { data: orgMembers = [] } = useOrgMembers();
  const { user, currentOrg } = useAuth();
  const approveNext = useApproveNextAttempt();
  const cancelPlan = useCancelActionPlan();
  const { data: activity = [] } = useActionPlanActivityLog(plan?.code);

  const [evalTarget, setEvalTarget] = useState<CorrectiveActionView | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const roleByUserId = useMemo(
    () => Object.fromEntries(orgMembers.map((m) => [m.id, m.role])),
    [orgMembers],
  );
  const actions = useMemo(
    () => actionRows.map((r) => mapCorrectiveActionToView(r, roleByUserId)),
    [actionRows, roleByUserId],
  );
  const actionById = useMemo(
    () => Object.fromEntries(actions.map((a) => [a.actionId, a])),
    [actions],
  );

  if (planLoading || actionsLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          Carregando plano de ação…
        </div>
      </AppShell>
    );
  }

  if (planError || !plan) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-sm text-[color:var(--severity-critical)]">
          Não foi possível carregar este plano de ação.
        </div>
      </AppShell>
    );
  }

  function canApprove(a: CorrectiveActionView) {
    if (!a.requiredApprovalRole || !currentOrg) return false;
    if (currentOrg.role === "admin") return true;
    return currentOrg.role === a.requiredApprovalRole;
  }

  function handleApprove(a: CorrectiveActionView) {
    if (!user) return;
    approveNext.mutate(
      { id: a.actionId, approvedBy: user.id },
      {
        onSuccess: () => toast.success(`${a.codigo} aprovada — pode seguir para execução.`),
        onError: (err) =>
          toast.error("Não foi possível aprovar.", {
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
  }

  function handleCancelPlan() {
    if (!plan || !cancelReason.trim()) return;
    cancelPlan.mutate(
      { id: plan.id, reason: cancelReason.trim() },
      {
        onSuccess: () => {
          toast.success(`${plan.code} cancelado`, { description: cancelReason.trim() });
          setCancelOpen(false);
          setCancelReason("");
        },
        onError: (err) =>
          toast.error("Não foi possível cancelar o plano.", {
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
  }

  const custoTotal = actions.reduce((s, a) => s + a.custo, 0);
  const acoesAtivas = actions.filter((a) => a.statusDb !== "encerrada");
  const statusUi = ACTION_PLAN_STATUS_LABEL[plan.status];

  return (
    <AppShell>
      <div className="mx-auto max-w-[1300px] space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2 text-muted-foreground">
              <Link to="/planos-de-acao">
                <ArrowLeft className="h-4 w-4" /> Voltar para lista
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-base font-semibold text-brand">{plan.code}</span>
              <Badge
                variant="outline"
                className={cn("rounded-md border text-xs", planoStatusClasses[statusUi].badge)}
              >
                {statusUi}
              </Badge>
              {plan.nc && (
                <Link
                  to="/nao-conformidades/$id"
                  params={{ id: plan.nc.id }}
                  className="inline-flex items-center gap-1 rounded-md border border-[color:var(--severity-critical)]/30 bg-[color:var(--severity-critical)]/10 px-2 py-0.5 text-xs text-[color:var(--severity-critical)] hover:bg-[color:var(--severity-critical)]/20"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Originado de {plan.nc.code}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
            <p className="max-w-3xl text-sm text-foreground/80">{plan.problem_description}</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-lg">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-[color:var(--severity-critical)]"
                  disabled={plan.status === "cancelado"}
                  onSelect={() => setCancelOpen(true)}
                >
                  Cancelar plano
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Coluna principal */}
          <div className="space-y-6">
            {/* Contenção Imediata */}
            {plan.contingency_description && (
              <Card className="rounded-xl border-[color:var(--severity-high)]/30 bg-[color:var(--severity-high)]/5 shadow-sm">
                <CardContent className="space-y-3 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <ShieldAlert className="h-4 w-4 text-[color:var(--severity-high)]" />
                      Contenção Imediata
                    </h2>
                    <Badge
                      variant="outline"
                      className="rounded-md border-border text-[10px] text-muted-foreground"
                    >
                      {plan.contingency_executed_at ? "Executada" : "Pendente"}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground/80">{plan.contingency_description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    {plan.contingency_responsible && (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="bg-brand-soft text-[9px] font-semibold text-brand">
                            {plan.contingency_responsible.full_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {plan.contingency_responsible.full_name}
                      </div>
                    )}
                    <span>· Prazo {fmtDate(plan.contingency_deadline)}</span>
                    {plan.contingency_executed_at && (
                      <span>· Executada em {fmtDate(plan.contingency_executed_at)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ações corretivas */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-foreground">
                Ações Corretivas{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({acoesAtivas.length} ativa(s) de {actions.length})
                </span>
              </h2>
              {actions.map((a) => (
                <CorrectiveActionCard
                  key={a.actionId}
                  action={a}
                  parent={a.parentActionId ? actionById[a.parentActionId] : undefined}
                  canApprove={canApprove(a)}
                  onApprove={() => handleApprove(a)}
                  onVerify={() => setEvalTarget(a)}
                />
              ))}
            </div>
          </div>

          {/* Coluna lateral */}
          <div className="space-y-6">
            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold text-foreground">Resumo</h3>
                <dl className="space-y-3 text-xs">
                  <InfoRow label="Origem" value={ORIGIN_DB_TO_UI[plan.origin_type]} />
                  {plan.nc && <InfoRow label="NC de origem" value={plan.nc.code} />}
                  <InfoRow label="Criado em" value={fmtDate(plan.created_at)} />
                </dl>
                <Separator />
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" /> Custo total das ações
                  </div>
                  <div className="text-lg font-semibold text-foreground">
                    {formatBRL(custoTotal)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {plan.nc && (
              <Card className="rounded-xl border-border/80 shadow-sm">
                <CardContent className="space-y-2 p-5">
                  <h3 className="text-sm font-semibold text-foreground">Módulos relacionados</h3>
                  <Link
                    to="/nao-conformidades/$id"
                    params={{ id: plan.nc.id }}
                    className="flex items-center justify-between rounded-lg border border-border/70 p-2.5 transition-colors hover:border-brand/40 hover:bg-brand-soft/30"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)]">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          Não Conformidade
                        </div>
                        <div className="text-[10px] text-muted-foreground">{plan.nc.code}</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Histórico / trilha */}
            <Card className="rounded-xl border-border/80 shadow-sm">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Histórico</h3>
                </div>
                <div className="space-y-2.5">
                  {activity.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>
                  )}
                  {activity.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 text-xs">
                      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-brand" />
                      <div className="flex-1">
                        <div className="text-foreground">{h.action}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {h.actor?.full_name ?? "Sistema"} · {fmtDateTime(h.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <EffectivenessDialog action={evalTarget} onClose={() => setEvalTarget(null)} />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar plano de ação</AlertDialogTitle>
            <AlertDialogDescription>
              O plano {plan.code} vai para o histórico como cancelado — nada é apagado. Informe o
              motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Motivo do cancelamento…"
            className="min-h-[80px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!cancelReason.trim() || cancelPlan.isPending}
              onClick={handleCancelPlan}
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

function CorrectiveActionCard({
  action,
  parent,
  canApprove,
  onApprove,
  onVerify,
}: {
  action: CorrectiveActionView;
  parent?: CorrectiveActionView;
  canApprove: boolean;
  onApprove: () => void;
  onVerify: () => void;
}) {
  const { data: verifications = [] } = useVerifications(action.actionId);
  const updateStatus = useUpdateCorrectiveActionStatus();
  const encerrada = action.statusDb === "encerrada";

  function handleStart() {
    updateStatus.mutate(
      { id: action.actionId, status: "em_execucao" },
      {
        onSuccess: () => toast.success(`${action.codigo} em execução.`),
        onError: (err) =>
          toast.error("Não foi possível iniciar a execução.", {
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
  }

  function handleRequestVerification() {
    updateStatus.mutate(
      { id: action.actionId, status: "aguardando_verificacao" },
      {
        onSuccess: () => toast.success(`${action.codigo} pronta para verificação de eficácia.`),
        onError: (err) =>
          toast.error("Não foi possível solicitar a verificação.", {
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
  }

  return (
    <Card className={cn("rounded-xl border-border/80 shadow-sm", encerrada && "opacity-70")}>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-brand">Ação {action.seq}</span>
            <Badge
              variant="outline"
              className={cn("rounded-md border text-xs", planoStatusClasses[action.status].badge)}
            >
              {encerrada ? "Superada" : action.status}
            </Badge>
            {action.closureReason && (
              <Badge
                variant="outline"
                className="rounded-md border-border text-[10px] text-muted-foreground"
              >
                {action.closureReason === "eficaz"
                  ? "Aprovada na eficácia"
                  : action.closureReason === "causa_errada"
                    ? "Encerrada — causa raiz corrigida"
                    : action.closureReason === "acao_fraca"
                      ? "Encerrada — ação fraca"
                      : "Encerrada — reprovada em definitivo"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-brand-soft text-[10px] font-semibold text-brand">
                {action.responsavel.iniciais}
              </AvatarFallback>
            </Avatar>
            {action.responsavel.nome}
          </div>
        </div>

        {parent && action.restartReason && (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground">
            Nasceu da reprovação da <strong>Ação {parent.seq}</strong> — motivo:{" "}
            {VERIFICATION_REASON_LABEL[action.restartReason]}
          </div>
        )}

        {action.statusDb === "aguardando_aprovacao" && action.requiredApprovalRole && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-3">
            <span className="text-xs font-semibold text-[color:var(--severity-high)]">
              Aguardando aprovação de {REQUIRED_APPROVAL_ROLE_LABEL[action.requiredApprovalRole]}{" "}
              para seguir
            </span>
            {canApprove && (
              <Button
                size="sm"
                className="h-7 rounded-md bg-brand text-xs text-brand-foreground hover:bg-brand/90"
                onClick={onApprove}
              >
                Aprovar próxima tentativa
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <FiveW label="O quê" en="descrição da ação" value={action.descricao} />
          <FiveW label="Por quê" en="justificativa (causa raiz)" value={action.why} />
          <FiveW label="Onde" en="local de aplicação" value={action.onde} />
          <FiveW label="Quem" en="responsável" value={action.responsavel.nome} />
          <FiveW
            label="Quando"
            en="prazo"
            value={`${fmtDate(action.inicio)} → ${fmtDate(action.prazo)}`}
          />
          <FiveW label="Como" en="método de execução" value={action.como} />
          <FiveW
            label="Quanto custa"
            en="custo estimado"
            value={formatBRL(action.custo)}
            className="sm:col-span-2"
          />
        </div>

        {!encerrada && action.statusDb !== "aprovada" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progresso</span>
              <span className="font-medium text-foreground">{action.percentual}%</span>
            </div>
            <Progress value={action.percentual} className="h-1.5 bg-muted [&>div]:bg-brand" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {action.statusDb === "planejada" && (
            <Button size="sm" variant="outline" className="rounded-lg" onClick={handleStart}>
              Iniciar execução
            </Button>
          )}
          {(action.statusDb === "planejada" || action.statusDb === "em_execucao") && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg border-brand/40 text-brand hover:bg-brand-soft"
              onClick={handleRequestVerification}
            >
              Solicitar verificação de eficácia
            </Button>
          )}
          {action.statusDb === "aguardando_verificacao" && (
            <Button
              size="sm"
              className="rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={onVerify}
            >
              Verificar eficácia
            </Button>
          )}
        </div>

        {verifications.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Tentativas de verificação
              </div>
              {verifications.map((v) => (
                <div key={v.id} className="rounded-lg border border-border/60 p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      Tentativa {v.attempt_number} ·{" "}
                      {v.result === "eficaz" ? "Eficaz" : "Não eficaz"}
                    </span>
                    <span className="text-muted-foreground">
                      {v.verified_by_profile?.full_name ?? "—"} · {fmtDateTime(v.verified_at)}
                    </span>
                  </div>
                  {v.reason && (
                    <div className="mt-1 flex items-center gap-1 text-[color:var(--severity-critical)]">
                      <AlertTriangle className="h-3 w-3" /> {VERIFICATION_REASON_LABEL[v.reason]}
                    </div>
                  )}
                  {v.new_root_cause && (
                    <div className="mt-1 text-muted-foreground">
                      Nova causa raiz: {v.new_root_cause}
                    </div>
                  )}
                  {v.notes && <div className="mt-1 text-muted-foreground">{v.notes}</div>}
                  {v.next_attempt_approved_by_profile && (
                    <div className="mt-1 flex items-center gap-1 text-[color:var(--success)]">
                      <Check className="h-3 w-3" /> Próxima tentativa aprovada por{" "}
                      {v.next_attempt_approved_by_profile.full_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FiveW({
  label,
  en,
  value,
  className,
}: {
  label: string;
  en: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border/60 bg-muted/30 p-3", className)}>
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand">{label}</span>
        <span className="text-[10px] text-muted-foreground">{en}</span>
      </div>
      <div className="mt-1 text-sm text-foreground/90">{value}</div>
    </div>
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
