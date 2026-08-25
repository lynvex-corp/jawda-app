import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  ArrowLeft,
  Play,
  Send,
  Check,
  ShieldAlert,
  Plus,
  Link2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCriticalAnalysisMeetingDetail,
  useStartCriticalAnalysisExecution,
  useUpdateCriticalAnalysisAgendaItem,
  useUpdateCriticalAnalysisMeetingFields,
  useUpdateCriticalAnalysisAttendance,
  useSubmitCriticalAnalysisForApproval,
  useApproveCriticalAnalysisParticipation,
  useAnnulCriticalAnalysis,
  useCreateCriticalAnalysisActionItem,
  useGenerateActionPlanFromCriticalAnalysisItem,
  ACTION_ITEM_TYPE_OPTIONS,
  type CriticalAnalysisActionItemType,
} from "@/lib/queries/estrategia";
import { LockedDocumentBanner } from "@/components/estrategia/formal-document";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/utils";

export function AnaliseCriticaDetailPage() {
  const { id } = useParams({ from: "/analise-critica/$id" });
  const navigate = useNavigate();
  const { data: meeting, isLoading } = useCriticalAnalysisMeetingDetail(id);
  const startExecution = useStartCriticalAnalysisExecution();
  const updateAgendaItem = useUpdateCriticalAnalysisAgendaItem();
  const updateFields = useUpdateCriticalAnalysisMeetingFields();
  const updateAttendance = useUpdateCriticalAnalysisAttendance();
  const submitForApproval = useSubmitCriticalAnalysisForApproval();
  const approveParticipation = useApproveCriticalAnalysisParticipation();
  const annul = useAnnulCriticalAnalysis();
  const createActionItem = useCreateCriticalAnalysisActionItem();
  const generatePlan = useGenerateActionPlanFromCriticalAnalysisItem();
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [deliberations, setDeliberations] = useState("");
  const [previousMeetingReference, setPreviousMeetingReference] = useState("");
  const [annulOpen, setAnnulOpen] = useState(false);
  const [annulReason, setAnnulReason] = useState("");
  const [newActionOpen, setNewActionOpen] = useState(false);
  const [newAction, setNewAction] = useState<{
    type: CriticalAnalysisActionItemType;
    description: string;
  }>({
    type: "oportunidade_melhoria",
    description: "",
  });

  useEffect(() => {
    if (meeting) {
      setDeliberations(meeting.deliberations);
      setPreviousMeetingReference(meeting.previousMeetingReference);
    }
  }, [meeting?.id]);

  if (isLoading || !meeting) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Carregando…
        </div>
      </AppShell>
    );
  }

  const isExecuting = meeting.status === "em_andamento";
  const isLocked = meeting.status === "concluida" || meeting.status === "anulada";
  const pendingTopics = meeting.agendaItems.filter((a) => !a.analyzedContent.trim());
  const myParticipant = meeting.participants.find((p) => p.userId === currentUserId);
  const allApproved =
    meeting.participants.length > 0 && meeting.participants.every((p) => p.approved);

  const iniciarExecucao = () => {
    startExecution.mutate(
      { meetingId: meeting.id },
      {
        onSuccess: () => toast.success("Execução iniciada"),
        onError: (e) => toast.error("Erro ao iniciar", { description: getErrorMessage(e) }),
      },
    );
  };

  const salvarCampos = () => {
    updateFields.mutate(
      { meetingId: meeting.id, deliberations, previousMeetingReference },
      { onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }) },
    );
  };

  const enviarParaAprovacao = () => {
    submitForApproval.mutate(
      { meetingId: meeting.id },
      {
        onSuccess: () => toast.success("Enviada para aprovação dos participantes"),
        onError: (e) => toast.error("Não foi possível enviar", { description: getErrorMessage(e) }),
      },
    );
  };

  const aprovarMinhaParticipacao = () => {
    approveParticipation.mutate(
      { meetingId: meeting.id },
      {
        onSuccess: () => toast.success("Aprovação registrada"),
        onError: (e) => toast.error("Erro ao aprovar", { description: getErrorMessage(e) }),
      },
    );
  };

  const confirmarAnulacao = () => {
    if (!annulReason.trim()) {
      toast.error("Informe o motivo da anulação");
      return;
    }
    annul.mutate(
      { meetingId: meeting.id, reason: annulReason },
      {
        onSuccess: () => {
          toast.success("Ata anulada");
          setAnnulOpen(false);
          setAnnulReason("");
        },
        onError: (e) => toast.error("Não foi possível anular", { description: getErrorMessage(e) }),
      },
    );
  };

  const salvarAcao = () => {
    if (!newAction.description.trim()) {
      toast.error("Descreva a ação de saída");
      return;
    }
    createActionItem.mutate(
      { meetingId: meeting.id, ...newAction },
      {
        onSuccess: () => {
          toast.success("Ação de saída registrada");
          setNewActionOpen(false);
          setNewAction({ type: "oportunidade_melhoria", description: "" });
        },
        onError: (e) => toast.error("Erro ao registrar", { description: getErrorMessage(e) }),
      },
    );
  };

  const gerarPlano = (actionItemId: string, description: string) => {
    generatePlan.mutate(
      { actionItemId, meetingId: meeting.id, description },
      {
        onSuccess: ({ plan }) =>
          toast.success("Plano de ação gerado", { description: `Vínculo criado: ${plan.code}` }),
        onError: (e) => toast.error("Erro ao gerar plano", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate({ to: "/analise-critica" })}
              className="h-8 w-8 rounded-lg p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Análise Crítica —{" "}
                {new Date(meeting.scheduledDate + "T00:00:00").toLocaleDateString("pt-BR")}
              </h1>
              <p className="text-xs text-muted-foreground">Requisito 9.3 da ISO 9001</p>
            </div>
          </div>
          <div className="flex gap-2">
            {meeting.status === "programada" && (
              <Button
                size="sm"
                onClick={iniciarExecucao}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                <Play className="mr-1.5 h-4 w-4" /> Iniciar execução
              </Button>
            )}
            {isExecuting && (
              <Button
                size="sm"
                onClick={enviarParaAprovacao}
                disabled={pendingTopics.length > 0}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                <Send className="mr-1.5 h-4 w-4" /> Enviar para aprovação
              </Button>
            )}
            {meeting.status === "concluida" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAnnulOpen(true)}
                className="rounded-lg text-[color:var(--severity-critical)]"
              >
                Anular ata
              </Button>
            )}
          </div>
        </header>

        {isExecuting && pendingTopics.length > 0 && (
          <Alert className="rounded-xl border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {pendingTopics.length} pauta(s) sem conteúdo analisado — preencha todas para poder
              enviar para aprovação
            </AlertTitle>
          </Alert>
        )}

        {meeting.status === "aguardando_aprovacao" && (
          <LockedDocumentBanner>
            Ata aguardando aprovação de todos os participantes. Conteúdo travado até a conclusão.
          </LockedDocumentBanner>
        )}
        {meeting.status === "concluida" && (
          <LockedDocumentBanner>
            Ata concluída — travada. Nenhum campo é editável a partir daqui, exceto anulação pela
            Alta Direção.
          </LockedDocumentBanner>
        )}
        {meeting.status === "anulada" && (
          <Alert
            variant="destructive"
            className="rounded-xl border-[color:var(--severity-critical)]/40 bg-[color:var(--severity-critical)]/10"
          >
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Ata anulada</AlertTitle>
            <AlertDescription className="text-xs">{meeting.annulmentReason}</AlertDescription>
          </Alert>
        )}

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Referência à ata anterior
                </label>
                <Input
                  value={previousMeetingReference}
                  disabled={!isExecuting}
                  onChange={(e) => setPreviousMeetingReference(e.target.value)}
                  onBlur={salvarCampos}
                  className="rounded-md text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Início / Fim
                </label>
                <div className="flex h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-xs text-muted-foreground">
                  {meeting.startDatetime
                    ? new Date(meeting.startDatetime).toLocaleString("pt-BR")
                    : "—"}
                  {" · "}
                  {meeting.endDatetime
                    ? new Date(meeting.endDatetime).toLocaleString("pt-BR")
                    : "—"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-sm font-semibold text-foreground">Pautas</h2>
            {meeting.agendaItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{item.topic}</span>
                  {!item.analyzedContent.trim() && isExecuting && (
                    <Badge
                      variant="outline"
                      className="rounded-md border-[color:var(--warning)]/40 text-[10px] text-[color:var(--severity-high)]"
                    >
                      Pendente
                    </Badge>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Conteúdo analisado
                    </label>
                    <Textarea
                      defaultValue={item.analyzedContent}
                      disabled={!isExecuting}
                      onBlur={(e) =>
                        updateAgendaItem.mutate({
                          id: item.id,
                          meetingId: meeting.id,
                          analyzedContent: e.target.value,
                          comments: item.comments,
                        })
                      }
                      className="min-h-[70px] rounded-md text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Comentários
                    </label>
                    <Textarea
                      defaultValue={item.comments}
                      disabled={!isExecuting}
                      onBlur={(e) =>
                        updateAgendaItem.mutate({
                          id: item.id,
                          meetingId: meeting.id,
                          analyzedContent: item.analyzedContent,
                          comments: e.target.value,
                        })
                      }
                      className="min-h-[70px] rounded-md text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-sm font-semibold text-foreground">Deliberações</h2>
            <Textarea
              value={deliberations}
              disabled={!isExecuting}
              onChange={(e) => setDeliberations(e.target.value)}
              onBlur={salvarCampos}
              className="min-h-[120px] rounded-md text-sm"
              placeholder="Decisões tomadas pela Alta Direção nesta reunião…"
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Participantes</h2>
            </div>
            <div className="divide-y divide-border/60">
              {meeting.participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="text-foreground">{p.fullName}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Checkbox
                        checked={p.attended}
                        disabled={!isExecuting}
                        onCheckedChange={(checked) =>
                          updateAttendance.mutate({
                            id: p.id,
                            meetingId: meeting.id,
                            attended: checked === true,
                          })
                        }
                      />
                      Presente
                    </label>
                    {p.approved ? (
                      <Badge
                        variant="outline"
                        className="rounded-md border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[10px] text-[color:var(--success)]"
                      >
                        <Check className="mr-1 h-3 w-3" /> Aprovou
                      </Badge>
                    ) : meeting.status === "aguardando_aprovacao" && p.userId === currentUserId ? (
                      <Button
                        size="sm"
                        onClick={aprovarMinhaParticipacao}
                        className="h-7 rounded-md bg-brand text-[11px] text-white hover:bg-brand/90"
                      >
                        Aprovar
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Aguardando</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {meeting.status === "aguardando_aprovacao" && !allApproved && !myParticipant && (
              <div className="border-t border-border/60 px-5 py-3 text-[11px] text-muted-foreground">
                Você não está na lista de participantes desta ata.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Ações de Saída</h2>
              {!isLocked && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNewActionOpen(true)}
                  className="rounded-lg"
                >
                  <Plus className="mr-1 h-3 w-3" /> Nova ação
                </Button>
              )}
            </div>
            <div className="divide-y divide-border/60">
              {meeting.actionItems.length === 0 && (
                <div className="px-5 py-6 text-center text-xs text-muted-foreground">
                  Nenhuma ação de saída registrada.
                </div>
              )}
              {meeting.actionItems.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Badge variant="outline" className="mb-1 rounded-md text-[10px]">
                      {ACTION_ITEM_TYPE_OPTIONS.find((o) => o.value === a.type)?.label ?? a.type}
                    </Badge>
                    <p className="text-sm text-foreground/90">{a.description}</p>
                  </div>
                  {a.generatedActionPlanCode ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-md border-brand/30 bg-brand-soft text-[10px] text-brand"
                    >
                      <Link2 className="mr-1 h-3 w-3" /> {a.generatedActionPlanCode}
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => gerarPlano(a.id, a.description)}
                      className="h-7 shrink-0 rounded-md px-2 text-[11px] text-brand hover:bg-brand-soft"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Gerar Plano
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nova ação de saída */}
      <Dialog open={newActionOpen} onOpenChange={setNewActionOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova ação de saída</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Tipo</label>
              <Select
                value={newAction.type}
                onValueChange={(v) =>
                  setNewAction({ ...newAction, type: v as CriticalAnalysisActionItemType })
                }
              >
                <SelectTrigger className="mt-1 h-9 rounded-md text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_ITEM_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Descrição</label>
              <Textarea
                value={newAction.description}
                onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewActionOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarAcao} className="bg-brand text-white hover:bg-brand/90">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anular */}
      <Dialog open={annulOpen} onOpenChange={setAnnulOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[color:var(--severity-critical)]">
              <Lock className="h-4 w-4" /> Anular esta ata?
            </DialogTitle>
            <DialogDescription>
              Ação irreversível e restrita à Alta Direção. A ata permanece no histórico marcada como
              anulada — nada é apagado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Motivo da anulação (obrigatório)</label>
            <Textarea
              value={annulReason}
              onChange={(e) => setAnnulReason(e.target.value)}
              className="min-h-[100px] rounded-md text-sm"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnulOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarAnulacao}
              className="bg-[color:var(--severity-critical)] text-white hover:bg-[color:var(--severity-critical)]/90"
            >
              Anular ata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
