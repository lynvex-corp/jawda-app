import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Users, Gavel } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrgMembers } from "@/lib/queries/action-plans";
import {
  useCriticalAnalysisMeetings,
  useScheduleCriticalAnalysis,
  DEFAULT_AGENDA_TOPICS,
  PERIODICITY_OPTIONS,
  type CriticalAnalysisMeetingStatus,
  type CriticalAnalysisPeriodicity,
} from "@/lib/queries/estrategia";

const statusLabel: Record<CriticalAnalysisMeetingStatus, string> = {
  programada: "Programada",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Concluída",
  anulada: "Anulada",
};

const statusColor: Record<CriticalAnalysisMeetingStatus, string> = {
  programada: "bg-muted text-foreground border-border",
  em_andamento: "bg-brand-soft text-brand border-brand/20",
  aguardando_aprovacao:
    "bg-[color:var(--warning)]/20 text-[color:var(--severity-high)] border-[color:var(--warning)]/40",
  concluida:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  anulada:
    "bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)] border-[color:var(--severity-critical)]/30",
};

export function AnaliseCriticaPage() {
  const navigate = useNavigate();
  const { data: meetings = [], isLoading } = useCriticalAnalysisMeetings();
  const { data: members = [] } = useOrgMembers();
  const schedule = useScheduleCriticalAnalysis();

  const [open, setOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [periodicity, setPeriodicity] = useState<CriticalAnalysisPeriodicity>("semestral");
  const [previousMeetingReference, setPreviousMeetingReference] = useState("");
  const [topics, setTopics] = useState<string[]>([...DEFAULT_AGENDA_TOPICS]);
  const [customTopic, setCustomTopic] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  const toggleTopic = (topic: string) => {
    setTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  };

  const addCustomTopic = () => {
    if (!customTopic.trim()) return;
    setTopics((prev) => [...prev, customTopic.trim()]);
    setCustomTopic("");
  };

  const toggleParticipant = (id: string) => {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const salvar = () => {
    if (!scheduledDate) {
      toast.error("Informe a data proposta");
      return;
    }
    schedule.mutate(
      {
        scheduledDate,
        periodicity,
        previousMeetingReference,
        topics,
        participantUserIds: participantIds,
      },
      {
        onSuccess: (meeting) => {
          toast.success("Análise crítica programada");
          setOpen(false);
          setScheduledDate("");
          setPreviousMeetingReference("");
          setTopics([...DEFAULT_AGENDA_TOPICS]);
          setParticipantIds([]);
          navigate({ to: "/analise-critica/$id", params: { id: meeting.id } });
        },
        onError: (e) => toast.error("Erro ao programar", { description: String(e) }),
      },
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Análise Crítica pela Direção
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Requisito 9.3 da ISO 9001 — reunião formal periódica, vira ata quando concluída.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Programar Análise Crítica
          </Button>
        </header>

        {!isLoading && meetings.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            Nenhuma análise crítica programada ainda.
          </p>
        )}

        <div className="space-y-3">
          {meetings.map((m) => (
            <Card
              key={m.id}
              className="cursor-pointer rounded-2xl border-border/80 shadow-sm transition hover:border-brand/40"
              onClick={() => navigate({ to: "/analise-critica/$id", params: { id: m.id } })}
            >
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Gavel className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {new Date(m.scheduledDate + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Periodicidade:{" "}
                      {PERIODICITY_OPTIONS.find((o) => o.value === m.periodicity)?.label ??
                        m.periodicity}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {m.participantCount}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("rounded-md border text-[10px]", statusColor[m.status])}
                  >
                    {statusLabel[m.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Programar Análise Crítica</DialogTitle>
            <DialogDescription>
              Selecione as pautas que serão tratadas e quem vai participar. Você poderá ajustar tudo
              antes de iniciar a execução.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Data proposta</label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Periodicidade</label>
                <Select
                  value={periodicity}
                  onValueChange={(v) => setPeriodicity(v as CriticalAnalysisPeriodicity)}
                >
                  <SelectTrigger className="h-9 rounded-md text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODICITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Referência à ata anterior (opcional)</label>
              <Input
                value={previousMeetingReference}
                onChange={(e) => setPreviousMeetingReference(e.target.value)}
                placeholder="Ex.: ACD-2026-01, realizada em 15/02/2026"
                className="rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Pautas</label>
              <div className="max-h-[220px] space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
                {[
                  ...DEFAULT_AGENDA_TOPICS,
                  ...topics.filter((t) => !DEFAULT_AGENDA_TOPICS.includes(t)),
                ].map((topic) => (
                  <label
                    key={topic}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={topics.includes(topic)}
                      onCheckedChange={() => toggleTopic(topic)}
                    />
                    {topic}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="Adicionar pauta personalizada"
                  className="h-8 rounded-md text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addCustomTopic}
                  className="h-8 rounded-md text-xs"
                >
                  Adicionar
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                Participantes (Alta Direção presente é obrigatória)
              </label>
              <div className="max-h-[160px] space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
                {members.map((mem) => (
                  <label
                    key={mem.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={participantIds.includes(mem.id)}
                      onCheckedChange={() => toggleParticipant(mem.id)}
                    />
                    {mem.fullName}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} className="bg-brand text-white hover:bg-brand/90">
              Programar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
