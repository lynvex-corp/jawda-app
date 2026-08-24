import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { Calendar, Plus, ArrowLeft, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useOrgMembers } from "@/lib/queries/action-plans";
import {
  useEmployees,
  usePerformanceCycles,
  useCreatePerformanceCycle,
  usePerformanceEvaluations,
  useCreatePerformanceEvaluation,
  usePerformanceEvaluationDetail,
  useSaveChaAnswer,
  useSaveDecisionMatrix,
  useSaveFeedback,
  useCompleteEvaluation,
  useGenerateActionPlanFromEvaluation,
  CHA_QUESTIONS,
  PERIODICITY_OPTIONS,
  type PerformancePeriodicity,
} from "@/lib/queries/pessoas";

const eixoLabel = ["Baixo", "Médio", "Alto"];

export function PerformancePage() {
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);

  if (selectedEvaluationId) {
    return (
      <EvaluationDetailPage
        id={selectedEvaluationId}
        onBack={() => setSelectedEvaluationId(null)}
      />
    );
  }

  return <EvaluationListPage onOpen={setSelectedEvaluationId} />;
}

function EvaluationListPage({ onOpen }: { onOpen: (id: string) => void }) {
  const { currentOrg } = useAuth();
  const isHrAuthorized = currentOrg?.role === "admin" || currentOrg?.role === "quality_manager";
  const { data: cycles = [] } = usePerformanceCycles();
  const { data: evaluations = [], isLoading } = usePerformanceEvaluations();
  const { data: employees = [] } = useEmployees();
  const { data: members = [] } = useOrgMembers();
  const createCycle = useCreatePerformanceCycle();
  const createEvaluation = useCreatePerformanceEvaluation();

  const [cicloOpen, setCicloOpen] = useState(false);
  const [novoCiclo, setNovoCiclo] = useState({
    periodicidade: "anual" as PerformancePeriodicity,
    metaMinima: "7",
  });

  const [avaliacaoOpen, setAvaliacaoOpen] = useState(false);
  const [novaAvaliacao, setNovaAvaliacao] = useState({
    employeeId: "",
    cycleId: "",
    avaliadorUserId: "",
    scheduledAt: "",
  });

  const salvarCiclo = () => {
    createCycle.mutate(
      { periodicidade: novoCiclo.periodicidade, metaMinima: Number(novoCiclo.metaMinima) },
      {
        onSuccess: () => {
          toast.success("Ciclo configurado");
          setCicloOpen(false);
        },
        onError: (e) => toast.error("Erro ao configurar ciclo", { description: String(e) }),
      },
    );
  };

  const salvarAvaliacao = () => {
    if (
      !novaAvaliacao.employeeId ||
      !novaAvaliacao.cycleId ||
      !novaAvaliacao.avaliadorUserId ||
      !novaAvaliacao.scheduledAt
    ) {
      toast.error("Preencha todos os campos");
      return;
    }
    createEvaluation.mutate(novaAvaliacao, {
      onSuccess: () => {
        toast.success("Avaliação programada", { description: "Avaliador notificado." });
        setAvaliacaoOpen(false);
        setNovaAvaliacao({ employeeId: "", cycleId: "", avaliadorUserId: "", scheduledAt: "" });
      },
      onError: (e) => toast.error("Erro ao programar", { description: String(e) }),
    });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Avaliação de Desempenho
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ciclos de avaliação, formulário CHA e Matriz de Apoio à Decisão.
            </p>
          </div>
          {isHrAuthorized && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCicloOpen(true)}
                className="rounded-lg"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Configurar ciclo
              </Button>
              <Button
                size="sm"
                onClick={() => setAvaliacaoOpen(true)}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Programar avaliação
              </Button>
            </div>
          )}
        </header>

        {cycles.length > 0 && (
          <div className="grid gap-3 md:grid-cols-3">
            {cycles.slice(0, 3).map((c) => (
              <Card key={c.id} className="rounded-2xl border-border/80 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <Badge variant="outline" className="ml-auto rounded-md text-[10px] capitalize">
                      {c.periodicidade}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-foreground">
                    Meta mínima: {c.metaMinima}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-2 text-sm font-semibold text-foreground">
              Avaliações — {isHrAuthorized ? "sua organização" : "as suas, como avaliador"}
            </div>
            <div className="space-y-2">
              {evaluations.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onOpen(e.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 text-left hover:border-brand/40"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{e.employeeNome}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Avaliador: {e.avaliadorNome} ·{" "}
                      {new Date(e.scheduledAt).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.mediaGeral !== null && (
                      <span className="text-sm font-bold text-brand">
                        {e.mediaGeral.toFixed(1)}
                      </span>
                    )}
                    <Badge variant="outline" className="rounded-md text-[10px] capitalize">
                      {e.status.replace("_", " ")}
                    </Badge>
                  </div>
                </button>
              ))}
              {!isLoading && evaluations.length === 0 && (
                <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                  Nenhuma avaliação visível — você só vê avaliações em que é o avaliador, ou todas
                  se for Administrador do Cliente.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={cicloOpen} onOpenChange={setCicloOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Configurar ciclo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Periodicidade</label>
              <Select
                value={novoCiclo.periodicidade}
                onValueChange={(v) =>
                  setNovoCiclo({ ...novoCiclo, periodicidade: v as PerformancePeriodicity })
                }
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
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
            <div>
              <label className="text-xs font-medium">Meta mínima</label>
              <Input
                type="number"
                value={novoCiclo.metaMinima}
                onChange={(e) => setNovoCiclo({ ...novoCiclo, metaMinima: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCicloOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarCiclo} className="bg-brand text-white hover:bg-brand/90">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={avaliacaoOpen} onOpenChange={setAvaliacaoOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Programar avaliação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Avaliado</label>
              <Select
                value={novaAvaliacao.employeeId}
                onValueChange={(v) => setNovaAvaliacao({ ...novaAvaliacao, employeeId: v })}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Ciclo</label>
              <Select
                value={novaAvaliacao.cycleId}
                onValueChange={(v) => setNovaAvaliacao({ ...novaAvaliacao, cycleId: v })}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {PERIODICITY_OPTIONS.find((o) => o.value === c.periodicidade)?.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Avaliador</label>
              <Select
                value={novaAvaliacao.avaliadorUserId}
                onValueChange={(v) => setNovaAvaliacao({ ...novaAvaliacao, avaliadorUserId: v })}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Data programada</label>
              <Input
                type="date"
                value={novaAvaliacao.scheduledAt}
                onChange={(e) =>
                  setNovaAvaliacao({ ...novaAvaliacao, scheduledAt: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvaliacaoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarAvaliacao} className="bg-brand text-white hover:bg-brand/90">
              Programar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function EvaluationDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: detail, isLoading } = usePerformanceEvaluationDetail(id);
  const saveChaAnswer = useSaveChaAnswer();
  const saveMatrix = useSaveDecisionMatrix();
  const saveFeedback = useSaveFeedback();
  const completeEvaluation = useCompleteEvaluation();
  const generatePlan = useGenerateActionPlanFromEvaluation();

  const [matrix, setMatrix] = useState({
    altoPotencial: 2,
    cultura: 2,
    tecnico: 2,
    recomendacao: "",
  });
  const [devolutiva, setDevolutiva] = useState("");

  if (isLoading || !detail) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Carregando…
        </div>
      </AppShell>
    );
  }

  const answerFor = (bloco: string, idx: number) =>
    detail.chaAnswers.find((a) => a.bloco === bloco && a.perguntaIndex === idx);

  const salvarNota = (
    bloco: "conhecimento" | "habilidades" | "atitudes",
    idx: number,
    nota: number,
    detalhamento: string,
  ) => {
    saveChaAnswer.mutate({ evaluationId: id, bloco, perguntaIndex: idx, nota, detalhamento });
  };

  const salvarMatriz = () => {
    saveMatrix.mutate(
      { evaluationId: id, ...matrix },
      {
        onSuccess: () => toast.success("Matriz de Apoio à Decisão salva"),
        onError: (e) => toast.error("Erro ao salvar", { description: String(e) }),
      },
    );
  };

  const salvarDevolutiva = () => {
    if (!devolutiva.trim()) {
      toast.error("Registre a devolutiva");
      return;
    }
    saveFeedback.mutate(
      { evaluationId: id, devolutivaRegistro: devolutiva },
      {
        onSuccess: () => toast.success("Devolutiva registrada"),
        onError: (e) => toast.error("Erro ao salvar", { description: String(e) }),
      },
    );
  };

  const concluir = () => {
    completeEvaluation.mutate(
      { id },
      {
        onSuccess: () => toast.success("Avaliação concluída"),
        onError: (e) => toast.error("Erro ao concluir", { description: String(e) }),
      },
    );
  };

  const gerarPlano = () => {
    generatePlan.mutate(
      {
        evaluationId: id,
        description: `Devolutiva de desempenho — ${detail.employeeNome}: ${devolutiva || detail.feedback?.devolutivaRegistro || ""}`,
      },
      {
        onSuccess: (plan) =>
          toast.success("Plano de ação gerado", { description: `Vínculo criado: ${plan.code}` }),
        onError: (e) => toast.error("Erro ao gerar plano", { description: String(e) }),
      },
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[900px] space-y-5">
        <header className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={onBack} className="h-8 w-8 rounded-lg p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {detail.employeeNome}
            </h1>
            <p className="text-xs text-muted-foreground">
              Avaliação de Desempenho — status: {detail.status.replace("_", " ")}
            </p>
          </div>
        </header>

        {(["conhecimento", "habilidades", "atitudes"] as const).map((bloco) => (
          <Card key={bloco} className="rounded-2xl border-border/80 shadow-sm">
            <CardContent className="space-y-3 p-5">
              <h2 className="text-sm font-semibold capitalize text-foreground">{bloco}</h2>
              {CHA_QUESTIONS[bloco].map((pergunta, idx) => {
                const existing = answerFor(bloco, idx);
                return (
                  <div key={idx} className="rounded-lg border border-border/60 p-3">
                    <div className="mb-2 text-xs text-foreground/85">{pergunta}</div>
                    <div className="flex items-center gap-2">
                      <Select
                        defaultValue={existing ? String(existing.nota) : undefined}
                        onValueChange={(v) =>
                          salvarNota(bloco, idx, Number(v), existing?.detalhamento ?? "")
                        }
                      >
                        <SelectTrigger className="h-8 w-20 text-xs">
                          <SelectValue placeholder="Nota" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        defaultValue={existing?.detalhamento ?? ""}
                        placeholder="Detalhamento (opcional)"
                        className="h-8 flex-1 text-xs"
                        onBlur={(e) =>
                          existing && salvarNota(bloco, idx, existing.nota, e.target.value)
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-foreground">
              Matriz de Apoio à Decisão — Perfil Atual
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {(["altoPotencial", "cultura", "tecnico"] as const).map((eixo) => (
                <div key={eixo} className="space-y-1.5">
                  <label className="text-[11px] font-medium capitalize text-muted-foreground">
                    {eixo === "altoPotencial" ? "Alto Potencial" : eixo}
                  </label>
                  <Select
                    value={String(matrix[eixo])}
                    onValueChange={(v) => setMatrix({ ...matrix, [eixo]: Number(v) })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {eixoLabel[n - 1]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Textarea
              value={matrix.recomendacao}
              onChange={(e) => setMatrix({ ...matrix, recomendacao: e.target.value })}
              placeholder="Recomendação"
              className="text-sm"
            />
            <Button size="sm" variant="outline" onClick={salvarMatriz} className="rounded-lg">
              Salvar matriz
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-foreground">Devolutiva</h2>
            <Textarea
              value={devolutiva || detail.feedback?.devolutivaRegistro || ""}
              onChange={(e) => setDevolutiva(e.target.value)}
              className="min-h-[100px] text-sm"
              placeholder="Registro da devolutiva ao avaliado…"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={salvarDevolutiva} className="rounded-lg">
                Salvar devolutiva
              </Button>
              {detail.feedback?.generatedActionPlanCode ? (
                <Badge
                  variant="outline"
                  className="rounded-md border-brand/30 bg-brand-soft text-[10px] text-brand"
                >
                  <Link2 className="mr-1 h-3 w-3" /> {detail.feedback.generatedActionPlanCode}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={gerarPlano}
                  className="rounded-lg text-brand hover:bg-brand-soft"
                >
                  <Plus className="mr-1 h-3 w-3" /> Gerar Plano de Ação
                </Button>
              )}
              {detail.status !== "concluida" && (
                <Button
                  size="sm"
                  onClick={concluir}
                  className="ml-auto rounded-lg bg-brand text-white hover:bg-brand/90"
                >
                  Concluir avaliação
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
