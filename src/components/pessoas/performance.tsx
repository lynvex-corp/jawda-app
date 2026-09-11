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
import { cn, getErrorMessage } from "@/lib/utils";
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
  calcularMediaCha,
  quadranteDaAvaliacao,
  evaluationPendencies,
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
  // Item 9 do Bloco 4: quem avalia desempenho é o Gestor de Área e o
  // Administrador — não o Gestor da Qualidade, que antes controlava esta
  // tela por engano (mesmo `isHrAuthorized` usado em Cargos e Perfis,
  // mas Avaliação de Desempenho não é módulo de RH/qualidade, é liderança
  // de pessoas). A RLS de INSERT em performance_evaluations
  // (20260912090200) já reforça isso no banco — aqui é só a UI acompanhar.
  const canEvaluate = currentOrg?.role === "admin" || currentOrg?.role === "area_manager";
  const { data: cycles = [] } = usePerformanceCycles();
  const { data: evaluations = [], isLoading } = usePerformanceEvaluations();
  const { data: employees = [] } = useEmployees();
  const { data: members = [] } = useOrgMembers();
  const createCycle = useCreatePerformanceCycle();
  const createEvaluation = useCreatePerformanceEvaluation();
  const avaliadoresElegiveis = members.filter(
    (m) => m.role === "admin" || m.role === "area_manager",
  );

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
        onError: (e) =>
          toast.error("Erro ao configurar ciclo", { description: getErrorMessage(e) }),
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
      onError: (e) => toast.error("Erro ao programar", { description: getErrorMessage(e) }),
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
              Abra o ciclo de avaliação, preencha o formulário CHA e use a Matriz de Apoio à Decisão
              para concluir sobre cada pessoa.
            </p>
          </div>
          {canEvaluate && (
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
              Avaliações — {canEvaluate ? "sua organização" : "as suas, como avaliador"}
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
                  {/* Item 9: só Gestor de Área e Administrador avaliam — a
                      RLS de INSERT (20260912090200) recusaria qualquer
                      outro nome aqui, então nem oferecer é mais claro que
                      deixar escolher e falhar ao salvar. */}
                  {avaliadoresElegiveis.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {avaliadoresElegiveis.length === 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Nenhum Gestor de Área ou Administrador cadastrado ainda.
                </p>
              )}
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
  const [recomendacaoEditadaAMao, setRecomendacaoEditadaAMao] = useState(false);
  const [devolutiva, setDevolutiva] = useState("");
  const [devolutivaData, setDevolutivaData] = useState("");
  const [compartilhar, setCompartilhar] = useState(false);

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

  // Item 7 do Bloco 4: média geral e por bloco — não existia nenhum cálculo
  // visível nesta tela antes.
  const { geral: mediaGeral, porBloco: mediaPorBloco } = calcularMediaCha(detail.chaAnswers);
  const abaixoDaMeta = mediaGeral !== null && mediaGeral < detail.metaMinima;

  // Nome do quadrante e recomendação sugerida (item 7) — calculados a
  // partir dos 3 eixos que o avaliador está ajustando agora (não só o que
  // já está salvo), pra a sugestão acompanhar o select em tempo real.
  const quadrante = quadranteDaAvaliacao(matrix, mediaGeral, detail.metaMinima);

  const pendencias = evaluationPendencies(detail);

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
        onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }),
      },
    );
  };

  const salvarDevolutiva = () => {
    const texto = devolutiva || detail.feedback?.devolutivaRegistro || "";
    if (!texto.trim()) {
      toast.error("Registre a devolutiva");
      return;
    }
    saveFeedback.mutate(
      {
        evaluationId: id,
        devolutivaRegistro: texto,
        devolutivaData: devolutivaData || undefined,
        compartilhadoComAvaliado: compartilhar,
      },
      {
        onSuccess: () => toast.success("Devolutiva registrada"),
        onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }),
      },
    );
  };

  const concluir = () => {
    if (pendencias.length > 0) {
      toast.error("Ainda falta preencher", { description: pendencias.join(" · ") });
      return;
    }
    completeEvaluation.mutate(
      { id },
      {
        onSuccess: () => toast.success("Avaliação concluída"),
        onError: (e) => toast.error("Erro ao concluir", { description: getErrorMessage(e) }),
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
        onError: (e) => toast.error("Erro ao gerar plano", { description: getErrorMessage(e) }),
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

        {/* Item 7: média geral + por bloco — nova. */}
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Média geral
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-3xl font-bold",
                      mediaGeral === null
                        ? "text-muted-foreground"
                        : abaixoDaMeta
                          ? "text-[color:var(--severity-critical)]"
                          : "text-[color:var(--success)]",
                    )}
                  >
                    {mediaGeral !== null ? mediaGeral.toFixed(1) : "—"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {mediaGeral === null
                      ? "sem notas ainda"
                      : abaixoDaMeta
                        ? `Abaixo da meta mínima (${detail.metaMinima}).`
                        : `Meta mínima (${detail.metaMinima}) atingida.`}
                  </span>
                </div>
              </div>
              <div className="flex gap-4 text-right">
                {(["conhecimento", "habilidades", "atitudes"] as const).map((bloco) => {
                  const v = mediaPorBloco[bloco];
                  const abaixo = v !== null && v < detail.metaMinima;
                  return (
                    <div key={bloco}>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {bloco}
                      </div>
                      <div
                        className={cn(
                          "text-lg font-semibold",
                          v === null
                            ? "text-muted-foreground"
                            : abaixo
                              ? "text-[color:var(--severity-critical)]"
                              : "text-[color:var(--success)]",
                        )}
                      >
                        {v !== null ? v.toFixed(1) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

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
              Matriz de Apoio à Decisão — Perfil Atual: {quadrante.nome}
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
            {/* Item 7: nome do quadrante + recomendação sugerida a partir da
                posição — antes era um Textarea em branco, o avaliador tinha
                que redigir tudo do zero. Continua editável: a sugestão só
                preenche quando o campo ainda está vazio ou não foi tocado à
                mão. */}
            <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-3 text-xs text-foreground/80">
              <span className="font-semibold text-brand">Recomendação sugerida: </span>
              {quadrante.recomendacaoSugerida}
            </div>
            <Textarea
              value={
                recomendacaoEditadaAMao
                  ? matrix.recomendacao
                  : matrix.recomendacao || quadrante.recomendacaoSugerida
              }
              onChange={(e) => {
                setRecomendacaoEditadaAMao(true);
                setMatrix({ ...matrix, recomendacao: e.target.value });
              }}
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
            <p className="text-xs text-muted-foreground">
              O plano de ação é elaborado em comum acordo entre avaliador e avaliado, após a
              devolutiva.
            </p>
            <Textarea
              value={devolutiva || detail.feedback?.devolutivaRegistro || ""}
              onChange={(e) => setDevolutiva(e.target.value)}
              className="min-h-[100px] text-sm"
              placeholder="Registro da devolutiva ao avaliado…"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Data da devolutiva
                </label>
                <Input
                  type="date"
                  value={devolutivaData || detail.feedback?.devolutivaData || ""}
                  onChange={(e) => setDevolutivaData(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <label className="flex items-end gap-2 pb-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={compartilhar || detail.feedback?.compartilhadoComAvaliado || false}
                  onChange={(e) => setCompartilhar(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Compartilhar com o avaliado
              </label>
            </div>
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
                <div className="ml-auto flex flex-col items-end gap-1">
                  {pendencias.length > 0 && (
                    <span className="text-[10px] text-[color:var(--severity-high)]">
                      Falta: {pendencias.join(" · ")}
                    </span>
                  )}
                  <Button
                    size="sm"
                    onClick={concluir}
                    disabled={pendencias.length > 0}
                    title={pendencias.length > 0 ? pendencias.join(" · ") : undefined}
                    className="rounded-lg bg-brand text-white hover:bg-brand/90"
                  >
                    Concluir avaliação
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
