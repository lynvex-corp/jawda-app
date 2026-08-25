import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Plus,
  Star,
  ChevronRight,
  ChevronLeft,
  Award,
  Check,
  AlertTriangle,
  Settings2,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  QUALIFICATION_CRITERION_OPTIONS,
  EVALUATION_PERIODICITY_OPTIONS,
  useSuppliers,
  useCreateSupplier,
  useSupplierQualificationCriteria,
  useUpsertSupplierQualificationCriterion,
  useSupplierEvaluationParameters,
  useSetSupplierEvaluationParameters,
  useCreateSupplierEvaluation,
  useSendSupplierFeedback,
  type SupplierCategory,
  type SupplierWithStatus,
  type QualificationCriterion,
  type EvaluationPeriodicity,
} from "@/lib/queries/fornecedores";

const categoriaLabel: Record<SupplierCategory, string> = {
  material: "Material",
  servico: "Serviço",
};

function Stars({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              i <= Math.round(n)
                ? "fill-[color:var(--warning)] text-[color:var(--warning)]"
                : "text-muted-foreground/40",
            )}
          />
        ))}
      </div>
      <span className="font-mono text-[11px] font-semibold text-foreground">{n.toFixed(1)}</span>
    </div>
  );
}

export function AquisicaoPage() {
  const { currentOrg } = useAuth();
  const isAuthorized = currentOrg?.role === "admin" || currentOrg?.role === "quality_manager";

  const { data: suppliers = [] } = useSuppliers();
  const [novoOpen, setNovoOpen] = useState(false);
  const [avOpen, setAvOpen] = useState<SupplierWithStatus | null>(null);
  const [criteriosOpen, setCriteriosOpen] = useState<SupplierWithStatus | null>(null);
  const [paramsOpen, setParamsOpen] = useState(false);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Aquisição / Fornecedores
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Qualificação, avaliação e monitoramento — requisito 8.4.
            </p>
          </div>
          {isAuthorized && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => setParamsOpen(true)}
              >
                <Settings2 className="mr-1.5 h-4 w-4" /> Parâmetros de avaliação
              </Button>
              <Button
                size="sm"
                onClick={() => setNovoOpen(true)}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Inserir novo fornecedor
              </Button>
            </div>
          )}
        </header>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Pendência</TableHead>
                    <TableHead>Última avaliação</TableHead>
                    <TableHead>Critérios</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((f) => (
                    <TableRow key={f.id} className="text-xs">
                      <TableCell className="font-semibold text-foreground">
                        {f.nomeFantasia}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {categoriaLabel[f.categoria]}
                      </TableCell>
                      <TableCell>
                        {f.isPending ? (
                          <Badge
                            variant="outline"
                            className="gap-1 rounded-md border-[color:var(--severity-critical)]/30 bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)]"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {f.missingCriteria.length > 0
                              ? `${f.missingCriteria.length} critério(s) faltando`
                              : "Avaliação vencida"}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-md border-[color:var(--success)]/30 bg-[color:var(--success)]/15 text-[color:var(--success)]"
                          >
                            Em dia
                          </Badge>
                        )}
                        {f.lastTwoBelowMinimum && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 rounded-md border-[color:var(--severity-critical)]/30 bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)]"
                          >
                            Alerta de decisão
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.lastEvaluation ? (
                          <Stars n={f.lastEvaluation.overallScore} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.criteriaCount}/{QUALIFICATION_CRITERION_OPTIONS.length}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAuthorized && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 rounded-md text-[11px] text-brand"
                              onClick={() => setCriteriosOpen(f)}
                            >
                              <ClipboardList className="mr-1 h-3.5 w-3.5" /> Critérios
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 rounded-md text-[11px] text-brand"
                              onClick={() => setAvOpen(f)}
                            >
                              Avaliar
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {suppliers.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        Nenhum fornecedor cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <NovoFornecedorDialog open={novoOpen} onOpenChange={setNovoOpen} />
      <CriteriosDialog supplier={criteriosOpen} onClose={() => setCriteriosOpen(null)} />
      <AvaliarDialog supplier={avOpen} onClose={() => setAvOpen(null)} />
      <ParametrosDialog open={paramsOpen} onOpenChange={setParamsOpen} />
    </AppShell>
  );
}

function NovoFornecedorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const createSupplier = useCreateSupplier();
  const upsertCriterion = useUpsertSupplierQualificationCriterion();

  const [step, setStep] = useState(0);
  const [dados, setDados] = useState({
    nomeFantasia: "",
    ramo: "",
    nomeRepresentante: "",
    contato: "",
    email: "",
    cnpj: "",
    descricaoFornecimento: "",
    categoria: "material" as SupplierCategory,
  });
  const [criterios, setCriterios] = useState<
    Record<QualificationCriterion, { checked: boolean; attachmentUrl: string; observation: string }>
  >(
    Object.fromEntries(
      QUALIFICATION_CRITERION_OPTIONS.map((o) => [
        o.value,
        { checked: false, attachmentUrl: "", observation: "" },
      ]),
    ) as Record<
      QualificationCriterion,
      { checked: boolean; attachmentUrl: string; observation: string }
    >,
  );

  const reset = () => {
    setStep(0);
    setDados({
      nomeFantasia: "",
      ramo: "",
      nomeRepresentante: "",
      contato: "",
      email: "",
      cnpj: "",
      descricaoFornecimento: "",
      categoria: "material",
    });
    setCriterios(
      Object.fromEntries(
        QUALIFICATION_CRITERION_OPTIONS.map((o) => [
          o.value,
          { checked: false, attachmentUrl: "", observation: "" },
        ]),
      ) as typeof criterios,
    );
  };

  const concluir = async () => {
    if (!dados.nomeFantasia.trim()) {
      toast.error("Informe o nome fantasia");
      return;
    }
    const selecionados = QUALIFICATION_CRITERION_OPTIONS.filter((o) => criterios[o.value].checked);
    const semEvidencia = selecionados.find(
      (o) => !criterios[o.value].attachmentUrl.trim() && !criterios[o.value].observation.trim(),
    );
    if (semEvidencia) {
      toast.error(`"${semEvidencia.label}" precisa de anexo ou observação`);
      return;
    }
    try {
      const supplier = await createSupplier.mutateAsync(dados);
      for (const o of selecionados) {
        const c = criterios[o.value];
        await upsertCriterion.mutateAsync({
          supplierId: supplier.id,
          criterion: o.value,
          attachmentUrl: c.attachmentUrl.trim() || null,
          observation: c.observation.trim() || null,
        });
      }
      toast.success("Fornecedor submetido para qualificação");
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error("Erro ao cadastrar fornecedor", { description: getErrorMessage(e) });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Novo Fornecedor</DialogTitle>
          <DialogDescription>Complete as 2 etapas para submeter à qualificação.</DialogDescription>
        </DialogHeader>
        <div className="mb-3 flex items-center gap-2">
          {["Dados", "Critérios"].map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold",
                  i === step
                    ? "bg-brand text-white"
                    : i < step
                      ? "bg-[color:var(--success)] text-white"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </div>
              <span
                className={cn(
                  "text-[11px]",
                  i === step ? "font-semibold text-brand" : "text-muted-foreground",
                )}
              >
                {s}
              </span>
              {i < 1 && <div className="flex-1 border-t border-dashed border-border/70" />}
            </div>
          ))}
        </div>
        <div className="max-h-[420px] min-h-[220px] space-y-3 overflow-y-auto py-2">
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground">Nome fantasia</label>
                  <Input
                    className="h-9 rounded-lg text-xs"
                    value={dados.nomeFantasia}
                    onChange={(e) => setDados({ ...dados, nomeFantasia: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">CNPJ</label>
                  <Input
                    className="h-9 rounded-lg text-xs"
                    placeholder="00.000.000/0000-00"
                    value={dados.cnpj}
                    onChange={(e) => setDados({ ...dados, cnpj: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground">Ramo</label>
                  <Input
                    className="h-9 rounded-lg text-xs"
                    value={dados.ramo}
                    onChange={(e) => setDados({ ...dados, ramo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Categoria</label>
                  <Select
                    value={dados.categoria}
                    onValueChange={(v) => setDados({ ...dados, categoria: v as SupplierCategory })}
                  >
                    <SelectTrigger className="h-9 rounded-lg text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="material">Material</SelectItem>
                      <SelectItem value="servico">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground">Nome do representante</label>
                  <Input
                    className="h-9 rounded-lg text-xs"
                    value={dados.nomeRepresentante}
                    onChange={(e) => setDados({ ...dados, nomeRepresentante: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Contato</label>
                  <Input
                    className="h-9 rounded-lg text-xs"
                    value={dados.contato}
                    onChange={(e) => setDados({ ...dados, contato: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">E-mail</label>
                <Input
                  className="h-9 rounded-lg text-xs"
                  value={dados.email}
                  onChange={(e) => setDados({ ...dados, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">
                  Descrição do fornecimento
                </label>
                <Textarea
                  className="rounded-lg text-xs"
                  rows={2}
                  value={dados.descricaoFornecimento}
                  onChange={(e) => setDados({ ...dados, descricaoFornecimento: e.target.value })}
                />
              </div>
            </>
          )}
          {step === 1 && (
            <div className="space-y-2">
              <div className="text-[11px] text-muted-foreground">
                Marque os critérios atendidos — cada um precisa de anexo ou observação:
              </div>
              {QUALIFICATION_CRITERION_OPTIONS.map((o) => {
                const c = criterios[o.value];
                return (
                  <div key={o.value} className="rounded-lg border border-border/60 p-2.5">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={c.checked}
                        onChange={(e) =>
                          setCriterios({
                            ...criterios,
                            [o.value]: { ...c, checked: e.target.checked },
                          })
                        }
                      />
                      <span className="text-foreground/85">{o.label}</span>
                    </label>
                    {c.checked && (
                      <div className="mt-2 grid grid-cols-2 gap-2 pl-6">
                        <Input
                          placeholder="Link do anexo"
                          className="h-8 rounded-md text-[11px]"
                          value={c.attachmentUrl}
                          onChange={(e) =>
                            setCriterios({
                              ...criterios,
                              [o.value]: { ...c, attachmentUrl: e.target.value },
                            })
                          }
                        />
                        <Input
                          placeholder="Observação"
                          className="h-8 rounded-md text-[11px]"
                          value={c.observation}
                          onChange={(e) =>
                            setCriterios({
                              ...criterios,
                              [o.value]: { ...c, observation: e.target.value },
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="rounded-lg"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          {step < 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
            >
              Continuar <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={concluir} className="rounded-lg bg-brand text-white hover:bg-brand/90">
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CriteriosDialog({
  supplier,
  onClose,
}: {
  supplier: SupplierWithStatus | null;
  onClose: () => void;
}) {
  const { data: entries = [] } = useSupplierQualificationCriteria(supplier?.id ?? null);
  const upsert = useUpsertSupplierQualificationCriterion();
  const [editing, setEditing] = useState<QualificationCriterion | null>(null);
  const [draft, setDraft] = useState({ attachmentUrl: "", observation: "" });

  if (!supplier) return null;
  const byCriterion = new Map(entries.map((e) => [e.criterion, e]));

  const salvar = (criterion: QualificationCriterion) => {
    if (!draft.attachmentUrl.trim() && !draft.observation.trim()) {
      toast.error("Informe anexo ou observação");
      return;
    }
    upsert.mutate(
      {
        supplierId: supplier.id,
        criterion,
        attachmentUrl: draft.attachmentUrl.trim() || null,
        observation: draft.observation.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Critério atualizado");
          setEditing(null);
        },
        onError: (e) => toast.error("Erro ao salvar critério", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <Dialog open={!!supplier} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Critérios de qualificação — {supplier.nomeFantasia}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {QUALIFICATION_CRITERION_OPTIONS.map((o) => {
            const entry = byCriterion.get(o.value);
            const isEditing = editing === o.value;
            return (
              <div key={o.value} className="rounded-lg border border-border/60 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(entry ? "text-foreground/85" : "text-muted-foreground")}>
                    {o.label}
                  </span>
                  {entry ? (
                    <Badge
                      variant="outline"
                      className="rounded-md border-[color:var(--success)]/30 bg-[color:var(--success)]/15 text-[color:var(--success)]"
                    >
                      <Check className="mr-1 h-3 w-3" /> OK
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 rounded-md px-2 text-[10px]"
                      onClick={() => {
                        setEditing(o.value);
                        setDraft({ attachmentUrl: "", observation: "" });
                      }}
                    >
                      Registrar
                    </Button>
                  )}
                </div>
                {entry && (entry.attachmentUrl || entry.observation) && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {entry.attachmentUrl ? `Anexo: ${entry.attachmentUrl}` : ""}
                    {entry.attachmentUrl && entry.observation ? " · " : ""}
                    {entry.observation ? `Obs: ${entry.observation}` : ""}
                  </p>
                )}
                {isEditing && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Link do anexo"
                      className="h-8 rounded-md text-[11px]"
                      value={draft.attachmentUrl}
                      onChange={(e) => setDraft({ ...draft, attachmentUrl: e.target.value })}
                    />
                    <Input
                      placeholder="Observação"
                      className="h-8 rounded-md text-[11px]"
                      value={draft.observation}
                      onChange={(e) => setDraft({ ...draft, observation: e.target.value })}
                    />
                    <Button
                      size="sm"
                      className="col-span-2 h-7 rounded-md bg-brand text-[11px] text-white hover:bg-brand/90"
                      onClick={() => salvar(o.value)}
                    >
                      Salvar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-lg">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AvaliarDialog({
  supplier,
  onClose,
}: {
  supplier: SupplierWithStatus | null;
  onClose: () => void;
}) {
  const createEvaluation = useCreateSupplierEvaluation();
  const sendFeedback = useSendSupplierFeedback();
  const [notas, setNotas] = useState({ prazo: 4, qualidade: 4, atendimento: 4, doc: 4 });
  const [feedback, setFeedback] = useState("");
  const [savedEvaluationId, setSavedEvaluationId] = useState<string | null>(null);

  useEffect(() => {
    setNotas({ prazo: 4, qualidade: 4, atendimento: 4, doc: 4 });
    setFeedback("");
    setSavedEvaluationId(null);
  }, [supplier?.id]);

  if (!supplier) return null;

  const media = (notas.prazo + notas.qualidade + notas.atendimento + notas.doc) / 4;
  const minimo = supplier.applicableParameters?.minimumApprovalScore ?? 3;
  const abaixoDaMedia = media < minimo;

  const registrar = () => {
    createEvaluation.mutate(
      {
        supplierId: supplier.id,
        qualityScore: notas.qualidade,
        deadlineScore: notas.prazo,
        serviceScore: notas.atendimento,
        legalRequirementsScore: notas.doc,
      },
      {
        onSuccess: (created) => {
          toast.success("Avaliação registrada");
          setSavedEvaluationId(created.id);
          if (!abaixoDaMedia) onClose();
        },
        onError: (e) =>
          toast.error("Erro ao registrar avaliação", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <Dialog open={!!supplier} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Avaliação de fornecedor</DialogTitle>
          <DialogDescription>{supplier.nomeFantasia}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {supplier.lastTwoBelowMinimum && (
            <div className="flex items-start gap-2 rounded-xl border border-[color:var(--severity-critical)]/40 bg-[color:var(--severity-critical)]/10 p-3 text-[11px] text-foreground/85">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--severity-critical)]" />
              As últimas 2 avaliações ficaram abaixo da média mínima ({minimo}) — considere um
              alerta de decisão sobre a continuidade deste fornecedor.
            </div>
          )}
          {(
            [
              ["prazo", "Prazo de entrega"],
              ["qualidade", "Qualidade do produto/serviço"],
              ["atendimento", "Atendimento"],
              ["doc", "Documentação"],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-foreground">{label}</span>
                <span className="font-mono font-semibold text-brand">{notas[k]}/5</span>
              </div>
              <Slider
                min={0}
                max={5}
                step={1}
                value={[notas[k]]}
                onValueChange={(v) => setNotas({ ...notas, [k]: v[0] })}
              />
            </div>
          ))}
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border p-4",
              media >= minimo
                ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10"
                : "border-[color:var(--severity-critical)]/40 bg-[color:var(--severity-critical)]/10",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-white",
                  media >= minimo
                    ? "bg-[color:var(--success)]"
                    : "bg-[color:var(--severity-critical)]",
                )}
              >
                <Award className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Média final
                </div>
                <div className="text-xl font-bold text-foreground">
                  {media.toFixed(2)} <span className="text-xs text-muted-foreground">/ 5</span>
                </div>
              </div>
            </div>
            <Badge
              className={cn(
                "rounded-md text-white",
                media >= minimo
                  ? "bg-[color:var(--success)]"
                  : "bg-[color:var(--severity-critical)]",
              )}
            >
              {media >= minimo ? "Aprovado" : "Abaixo da média mínima"}
            </Badge>
          </div>
          {abaixoDaMedia && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-foreground">
                Mensagem de tratativa (sugerida por a nota estar abaixo da média)
              </label>
              <Textarea
                className="rounded-lg text-xs"
                rows={3}
                placeholder={`Prezados ${supplier.nomeFantasia}, identificamos uma avaliação abaixo do esperado nesta reavaliação. Solicitamos um plano de ação para os pontos de melhoria.`}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              {savedEvaluationId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  disabled={!feedback.trim()}
                  onClick={() =>
                    sendFeedback.mutate(
                      {
                        evaluationId: savedEvaluationId,
                        supplierId: supplier.id,
                        feedbackMessage: feedback,
                      },
                      {
                        onSuccess: () => {
                          toast.success("Tratativa enviada ao fornecedor");
                          onClose();
                        },
                        onError: (e) =>
                          toast.error("Erro ao enviar tratativa", {
                            description: getErrorMessage(e),
                          }),
                      },
                    )
                  }
                >
                  Enviar tratativa
                </Button>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-lg">
            Cancelar
          </Button>
          {!savedEvaluationId && (
            <Button
              onClick={registrar}
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
            >
              <Check className="mr-1 h-4 w-4" /> Registrar avaliação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParametrosDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: params = [] } = useSupplierEvaluationParameters();
  const setParams = useSetSupplierEvaluationParameters();
  const orgDefault = params.find((p) => !p.supplierId) ?? null;

  const [minimo, setMinimo] = useState("3");
  const [periodicidade, setPeriodicidade] = useState<EvaluationPeriodicity>("semestral");

  useEffect(() => {
    if (orgDefault) {
      setMinimo(String(orgDefault.minimumApprovalScore));
      setPeriodicidade(orgDefault.periodicity);
    }
  }, [orgDefault?.id]);

  const salvar = () => {
    setParams.mutate(
      { supplierId: null, minimumApprovalScore: Number(minimo), periodicity: periodicidade },
      {
        onSuccess: () => {
          toast.success("Parâmetro padrão atualizado");
          onOpenChange(false);
        },
        onError: (e) =>
          toast.error("Erro ao salvar parâmetro", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Parâmetros de avaliação (padrão da organização)</DialogTitle>
          <DialogDescription>
            Usado para calcular pendência e vencimento quando o fornecedor não tem parâmetro
            próprio.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Nota mínima de aprovação</label>
            <Input
              type="number"
              min={0}
              max={5}
              step="0.1"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
              className="rounded-md"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Periodicidade de reavaliação</label>
            <Select
              value={periodicidade}
              onValueChange={(v) => setPeriodicidade(v as EvaluationPeriodicity)}
            >
              <SelectTrigger className="rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVALUATION_PERIODICITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} className="bg-brand text-white hover:bg-brand/90">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
