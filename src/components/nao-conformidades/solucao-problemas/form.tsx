import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { SearchableSelect } from "@/components/app/searchable-select";
import { CincoPorques } from "@/components/nao-conformidades/cinco-porques";
import { Entregas } from "@/components/nao-conformidades/solucao-problemas/entregas";
import {
  entregaEmBranco,
  entregaPreenchida,
  prazoParaData,
  type EntregaRascunho,
} from "@/components/nao-conformidades/solucao-problemas/entregas-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateActionPlan } from "@/lib/queries/action-plans";
import { useNC } from "@/lib/queries/ncs";
import {
  PROBLEM_SOLUTION_STATUS_LABEL,
  buildMilestonesPlanInput,
  useCancelProblemSolution,
  useCloseProblemSolution,
  useCreateProblemSolution,
  useIndicatorOptions,
  useProblemSolution,
  useRefreshProblemSolution,
  useUpdateProblemSolution,
  type ProblemSolutionRow,
} from "@/lib/queries/problem-solutions";
import { cn, getErrorMessage } from "@/lib/utils";

const schema = z.object({
  title: z.string().trim().min(3, "Informe um título"),
  problemDefinition: z.string().trim().min(1, "Descreva o problema"),
  currentSituation: z.string(),
  goal: z.string(),
  fiveWhys: z.array(z.string()).length(5),
  rootCauseText: z.string(),
  futureSituation: z.string(),
  indicatorId: z.string().nullable(),
});
type FormValues = z.infer<typeof schema>;

const valoresVazios: FormValues = {
  title: "",
  problemDefinition: "",
  currentSituation: "",
  goal: "",
  fiveWhys: ["", "", "", "", ""],
  rootCauseText: "",
  futureSituation: "",
  indicatorId: null,
};

function valoresDoRegistro(row: ProblemSolutionRow): FormValues {
  const porques = row.five_whys ?? [];
  return {
    title: row.title,
    problemDefinition: row.problem_definition,
    currentSituation: row.current_situation ?? "",
    goal: row.goal ?? "",
    fiveWhys: Array.from({ length: 5 }, (_, i) => porques[i] ?? ""),
    rootCauseText: row.root_cause_text ?? "",
    futureSituation: row.future_situation ?? "",
    indicatorId: row.indicator_id,
  };
}

/** Caixa numerada no estilo do formulário A3. */
function Caixa({
  n,
  titulo,
  dica,
  erro,
  children,
}: {
  n: number;
  titulo: string;
  dica?: string;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border-border/80 shadow-sm">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sp text-[11px] font-semibold text-sp-foreground">
            {n}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
            {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
          </div>
        </div>
        {children}
        {erro && <p className="text-xs text-[color:var(--severity-critical)]">{erro}</p>}
      </CardContent>
    </Card>
  );
}

interface SolucaoProblemasFormProps {
  /** Edição de um A3 existente. */
  solutionId?: string;
  /** Criação a partir de uma NC (pré-preenche a definição do problema). */
  ncId?: string;
}

export function SolucaoProblemasForm({ solutionId, ncId }: SolucaoProblemasFormProps) {
  const navigate = useNavigate();
  const { data: solution, isLoading, isError } = useProblemSolution(solutionId);
  const { data: ncOrigem } = useNC(solution?.nc_origin_id ?? ncId);
  const { data: indicadores = [] } = useIndicatorOptions();
  const createSolution = useCreateProblemSolution();
  const updateSolution = useUpdateProblemSolution();
  const closeSolution = useCloseProblemSolution();
  const cancelSolution = useCancelProblemSolution();
  const createPlan = useCreateActionPlan();
  const refresh = useRefreshProblemSolution();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresVazios,
  });
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = form;

  const problemaAtual = useWatch({ control, name: "problemDefinition" });

  const [rascunhos, setRascunhos] = useState<EntregaRascunho[]>([]);
  // Mesma regra do wizard da NC: o 5º porquê consolida a causa raiz até
  // o usuário editá-la à mão.
  const [causaEditada, setCausaEditada] = useState(false);
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [licoes, setLicoes] = useState("");
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!solution) return;
    const valores = valoresDoRegistro(solution);
    reset(valores);
    setCausaEditada(
      Boolean(valores.rootCauseText) && valores.rootCauseText !== valores.fiveWhys[4],
    );
    setLicoes(solution.lessons_learned ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solution?.id]);

  // Criação a partir de NC: "Definição do Problema" nasce com a descrição da NC.
  useEffect(() => {
    if (solutionId || !ncOrigem) return;
    if (!getValues("problemDefinition")) setValue("problemDefinition", ncOrigem.descricao);
    if (!getValues("title")) setValue("title", `Solução de Problemas — ${ncOrigem.codigo}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ncOrigem?.id, solutionId]);

  const somenteLeitura = Boolean(solution && solution.status !== "em_andamento");
  const ocupado = isSubmitting;

  async function salvar(values: FormValues) {
    const parcial = rascunhos.find((r) => !entregaEmBranco(r) && !entregaPreenchida(r));
    if (parcial) {
      toast.error("Entrega incompleta", {
        description: "Preencha ação, responsável e data — ou remova a linha.",
      });
      return;
    }
    const entregas = rascunhos.filter(entregaPreenchida);
    const input = {
      title: values.title,
      problemDefinition: values.problemDefinition,
      currentSituation: values.currentSituation,
      goal: values.goal,
      fiveWhys: values.fiveWhys,
      rootCauseText: values.rootCauseText,
      futureSituation: values.futureSituation,
      indicatorId: values.indicatorId,
    };

    let registro: ProblemSolutionRow;
    try {
      registro = solution
        ? await updateSolution.mutateAsync({ id: solution.id, ...input })
        : await createSolution.mutateAsync({ ...input, ncOriginId: ncId ?? null });
    } catch (e) {
      toast.error("Não foi possível salvar a Solução de Problemas", {
        description: getErrorMessage(e),
      });
      return;
    }

    // Entregas -> Plano de Ação real (uma vez). Se o plano já existe, as
    // novas entregas entram pelo botão "Adicionar" da própria tabela.
    if (entregas.length > 0 && !registro.milestones_plan_id) {
      try {
        await createPlan.mutateAsync(
          buildMilestonesPlanInput(
            registro,
            entregas.map((e) => ({
              oque: e.oque.trim(),
              responsavelId: e.responsavelId,
              prazo: prazoParaData(e.prazo),
            })),
          ),
        );
        setRascunhos([]);
        refresh(registro.id);
      } catch (e) {
        toast.error(`${registro.code} salva, mas as entregas não foram geradas`, {
          description: `${getErrorMessage(e)} Reabra a solução para tentar de novo.`,
        });
        navigate({ to: "/nao-conformidades/solucoes/$id", params: { id: registro.id } });
        return;
      }
    }

    toast.success(`${registro.code} salva`);
    if (!solution) {
      navigate({ to: "/nao-conformidades/solucoes/$id", params: { id: registro.id } });
    }
  }

  async function encerrar() {
    if (!solution) return;
    try {
      await closeSolution.mutateAsync({ id: solution.id, lessonsLearned: licoes });
      setEncerrarOpen(false);
      toast.success(`${solution.code} encerrada`);
    } catch (e) {
      toast.error("Não foi possível encerrar", { description: getErrorMessage(e) });
    }
  }

  async function cancelar() {
    if (!solution) return;
    try {
      await cancelSolution.mutateAsync({ id: solution.id, reason: motivo });
      setCancelarOpen(false);
      toast.success(`${solution.code} cancelada`);
    } catch (e) {
      toast.error("Não foi possível cancelar", { description: getErrorMessage(e) });
    }
  }

  if (solutionId && isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          Carregando solução de problemas…
        </div>
      </AppShell>
    );
  }
  if (solutionId && (isError || !solution)) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-sm text-[color:var(--severity-critical)]">
          Não foi possível carregar esta solução de problemas.
        </div>
      </AppShell>
    );
  }

  const ncVinculada =
    solution?.nc_origin ?? (ncOrigem ? { id: ncOrigem.id, code: ncOrigem.codigo } : null);
  const opcoesIndicador = indicadores.map((i) => ({
    value: i.id,
    label: i.name,
    sublabel: i.code,
  }));

  return (
    <AppShell>
      <form onSubmit={handleSubmit(salvar)} className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Link
              to="/nao-conformidades/solucoes"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Soluções de Problemas
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {solution ? solution.code : "Nova Solução de Problema"}
              </h1>
              {solution && (
                <Badge variant="outline" className="border-sp/30 bg-sp-soft text-sp">
                  {PROBLEM_SOLUTION_STATUS_LABEL[solution.status]}
                </Badge>
              )}
              {ncVinculada && (
                <Link to="/nao-conformidades/$id" params={{ id: ncVinculada.id }}>
                  <Badge variant="outline" className="hover:bg-muted">
                    NC de origem: {ncVinculada.code}
                  </Badge>
                </Link>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Metodologia A3 (PDCA): defina o problema, encontre a causa raiz e conduza as entregas
              até a meta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {solution && solution.status === "em_andamento" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => setCancelarOpen(true)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg border-sp/40 text-sp hover:bg-sp-soft"
                  onClick={() => setEncerrarOpen(true)}
                >
                  Encerrar A3
                </Button>
              </>
            )}
            {!somenteLeitura && (
              <Button
                type="submit"
                disabled={ocupado}
                className="gap-1.5 rounded-lg bg-sp text-sp-foreground hover:bg-sp/90"
              >
                <Save className="h-4 w-4" /> {ocupado ? "Salvando…" : "Salvar"}
              </Button>
            )}
          </div>
        </div>

        <fieldset disabled={somenteLeitura || ocupado} className="space-y-4">
          <Card className="rounded-xl border-border/80 shadow-sm">
            <CardContent className="space-y-1.5 p-5">
              <Label htmlFor="sp-title">Título</Label>
              <Input
                id="sp-title"
                {...register("title")}
                placeholder="Ex.: Retrabalho na linha 3"
                className="rounded-lg"
              />
              {errors.title && (
                <p className="text-xs text-[color:var(--severity-critical)]">
                  {errors.title.message}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Caixa
                n={1}
                titulo="Definição do Problema"
                dica="Clarifique e desdobre o problema."
                erro={errors.problemDefinition?.message}
              >
                <Textarea rows={4} {...register("problemDefinition")} className="rounded-lg" />
              </Caixa>

              <Caixa n={2} titulo="Situação Atual" dica="Onde estamos hoje? Fatos e dados.">
                <Textarea rows={4} {...register("currentSituation")} className="rounded-lg" />
              </Caixa>

              <Caixa
                n={3}
                titulo="Meta"
                dica="Simples, Mensurável, Atingível, Relevante e Temporal."
              >
                <Textarea rows={3} {...register("goal")} className="rounded-lg" />
              </Caixa>

              <Caixa n={4} titulo="Análise da Causa Raiz" dica="Teste dos 5 Porquês.">
                <Controller
                  control={control}
                  name="fiveWhys"
                  render={({ field }) => (
                    <CincoPorques
                      valores={field.value}
                      problema={problemaAtual}
                      onChange={(i, valor) => {
                        const next = [...field.value];
                        next[i] = valor;
                        field.onChange(next);
                        if (i === 4 && !causaEditada) setValue("rootCauseText", valor);
                      }}
                    />
                  )}
                />
                <div className="space-y-1.5 pt-1">
                  <Label>Causa raiz identificada</Label>
                  <Textarea
                    rows={3}
                    {...register("rootCauseText", { onChange: () => setCausaEditada(true) })}
                    placeholder="Consolide a causa raiz…"
                    className="rounded-lg"
                  />
                </div>
              </Caixa>
            </div>

            <div className="space-y-4">
              <Caixa
                n={5}
                titulo="Situação Futura / Contramedidas"
                dica="O que vamos fazer para atingir a meta?"
              >
                <Textarea rows={5} {...register("futureSituation")} className="rounded-lg" />
              </Caixa>

              <Caixa
                n={6}
                titulo="Principais Entregas (Milestones)"
                dica="Cada entrega vira uma ação no Plano de Ação."
              >
                <Entregas
                  planId={solution?.milestones_plan_id ?? null}
                  planCode={solution?.milestones_plan?.code}
                  solutionCode={solution?.code}
                  problemDefinition={solution?.problem_definition}
                  rascunhos={rascunhos}
                  onRascunhosChange={setRascunhos}
                  disabled={somenteLeitura}
                />
              </Caixa>

              <Caixa n={7} titulo="Indicador" dica="Indicador cadastrado que acompanha a meta.">
                <Controller
                  control={control}
                  name="indicatorId"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? undefined}
                      onValueChange={(v) => field.onChange(v || null)}
                      options={opcoesIndicador}
                      placeholder="Vincular a um indicador (opcional)"
                      searchPlaceholder="Buscar por código ou nome…"
                      emptyMessage="Nenhum indicador encontrado."
                    />
                  )}
                />
                {solution?.indicator && (
                  <p className="text-xs text-muted-foreground">
                    Vinculado: {solution.indicator.code} — {solution.indicator.name}
                  </p>
                )}
              </Caixa>

              {solution?.status === "encerrado" && (
                <Card className={cn("rounded-xl border-sp/30 bg-sp-soft/40 shadow-sm")}>
                  <CardContent className="space-y-1.5 p-5">
                    <h2 className="text-sm font-semibold text-foreground">
                      Lições aprendidas / Padronização
                    </h2>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {solution.lessons_learned || "Nenhuma lição registrada."}
                    </p>
                  </CardContent>
                </Card>
              )}
              {solution?.status === "cancelado" && (
                <Card className="rounded-xl border-border/80 shadow-sm">
                  <CardContent className="space-y-1.5 p-5">
                    <h2 className="text-sm font-semibold text-foreground">
                      Motivo do cancelamento
                    </h2>
                    <p className="text-sm text-muted-foreground">{solution.cancel_reason}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </fieldset>
      </form>

      <Dialog open={encerrarOpen} onOpenChange={setEncerrarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar Solução de Problemas</DialogTitle>
            <DialogDescription>
              Padronizar e replicar (passo 8): registre o que foi aprendido. Um A3 encerrado não
              reabre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Lições aprendidas / Padronização (opcional)</Label>
            <Textarea
              rows={5}
              value={licoes}
              onChange={(e) => setLicoes(e.target.value)}
              className="rounded-lg"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncerrarOpen(false)}>
              Voltar
            </Button>
            <Button
              onClick={encerrar}
              disabled={closeSolution.isPending}
              className="bg-sp text-sp-foreground hover:bg-sp/90"
            >
              Encerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelarOpen} onOpenChange={setCancelarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Solução de Problemas</DialogTitle>
            <DialogDescription>
              Nada é apagado: o registro fica como cancelado, com o motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Motivo do cancelamento</Label>
            <Textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="rounded-lg"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelarOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={cancelar}
              disabled={!motivo.trim() || cancelSolution.isPending}
            >
              Cancelar A3
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
