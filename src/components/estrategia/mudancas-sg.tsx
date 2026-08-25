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
  Check,
  Circle,
  Plus,
  Shuffle,
  Users,
  Package,
  Scale,
  Send,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import {
  useChangesImprovements,
  useCreateChangeImprovement,
  useSubmitChangeForEvaluation,
  useEvaluateChangeImprovement,
  useDecideChangeImprovement,
  type ChangeImprovement,
  type ChangeImprovementTipo,
  type ChangeImprovementStatus,
} from "@/lib/queries/estrategia";

const statusColor: Record<ChangeImprovementStatus, string> = {
  rascunho: "bg-muted text-foreground border-border",
  aguardando_avaliacao:
    "bg-[color:var(--warning)]/20 text-[color:var(--severity-high)] border-[color:var(--warning)]/40",
  aguardando_aprovacao: "bg-brand-soft text-brand border-brand/20",
  aprovada:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  rejeitada:
    "bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)] border-[color:var(--severity-critical)]/30",
};

const statusLabel: Record<ChangeImprovementStatus, string> = {
  rascunho: "Rascunho",
  aguardando_avaliacao: "Aguardando avaliação",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

const checks: {
  key: "consequencias" | "integridade" | "recurso" | "responsabilidades";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "consequencias", label: "Consequências potenciais avaliadas", icon: Shuffle },
  { key: "integridade", label: "Impacto na integridade do SG", icon: Package },
  { key: "recurso", label: "Recursos necessários identificados", icon: Users },
  { key: "responsabilidades", label: "Responsabilidades realocadas", icon: Scale },
];

export function MudancasSGPage() {
  const { data: items = [], isLoading } = useChangesImprovements();
  const createChange = useCreateChangeImprovement();
  const submitForEvaluation = useSubmitChangeForEvaluation();
  const evaluate = useEvaluateChangeImprovement();
  const decide = useDecideChangeImprovement();

  const [novaOpen, setNovaOpen] = useState(false);
  const [nova, setNova] = useState({
    tipo: "melhoria" as ChangeImprovementTipo,
    descricao: "",
    proposito: "",
    dataInicio: "",
  });

  const [evaluating, setEvaluating] = useState<ChangeImprovement | null>(null);
  const [checklist, setChecklist] = useState({
    consequencias: undefined as boolean | undefined,
    consequenciasDetalhe: "",
    integridade: undefined as boolean | undefined,
    integridadeDetalhe: "",
    recurso: undefined as boolean | undefined,
    recursoDetalhe: "",
    responsabilidades: undefined as boolean | undefined,
    responsabilidadesDetalhe: "",
  });

  const salvarNova = () => {
    if (!nova.descricao.trim() || !nova.proposito.trim()) {
      toast.error("Descreva a mudança e o propósito");
      return;
    }
    createChange.mutate(
      {
        tipo: nova.tipo,
        descricao: nova.descricao,
        proposito: nova.proposito,
        dataInicio: nova.dataInicio,
      },
      {
        onSuccess: () => {
          toast.success(nova.tipo === "mudanca" ? "Mudança registrada" : "Melhoria registrada");
          setNova({ tipo: "melhoria", descricao: "", proposito: "", dataInicio: "" });
          setNovaOpen(false);
        },
        onError: (e) => toast.error("Erro ao registrar", { description: getErrorMessage(e) }),
      },
    );
  };

  const enviarParaAvaliacao = (m: ChangeImprovement) => {
    submitForEvaluation.mutate(
      { id: m.id },
      {
        onSuccess: () => toast.success("Enviada para avaliação"),
        onError: (e) => toast.error("Não foi possível enviar", { description: getErrorMessage(e) }),
      },
    );
  };

  const abrirAvaliacao = (m: ChangeImprovement) => {
    setEvaluating(m);
    setChecklist({
      consequencias: m.consequenciasBool ?? undefined,
      consequenciasDetalhe: m.consequenciasDetalhe,
      integridade: m.integridadeBool ?? undefined,
      integridadeDetalhe: m.integridadeDetalhe,
      recurso: m.recursoBool ?? undefined,
      recursoDetalhe: m.recursoDetalhe,
      responsabilidades: m.responsabilidadesBool ?? undefined,
      responsabilidadesDetalhe: m.responsabilidadesDetalhe,
    });
  };

  const respondidas = [
    checklist.consequencias,
    checklist.integridade,
    checklist.recurso,
    checklist.responsabilidades,
  ].every((v) => v !== undefined);

  const marcarAvaliada = () => {
    if (!evaluating || !respondidas) return;
    evaluate.mutate(
      {
        id: evaluating.id,
        consequenciasBool: checklist.consequencias!,
        consequenciasDetalhe: checklist.consequenciasDetalhe,
        integridadeBool: checklist.integridade!,
        integridadeDetalhe: checklist.integridadeDetalhe,
        recursoBool: checklist.recurso!,
        recursoDetalhe: checklist.recursoDetalhe,
        responsabilidadesBool: checklist.responsabilidades!,
        responsabilidadesDetalhe: checklist.responsabilidadesDetalhe,
      },
      {
        onSuccess: () => {
          toast.success("Marcada como Avaliada — aguardando aprovação");
          setEvaluating(null);
        },
        onError: (e) => toast.error("Erro ao avaliar", { description: getErrorMessage(e) }),
      },
    );
  };

  const decidir = (m: ChangeImprovement, approve: boolean) => {
    decide.mutate(
      { id: m.id, approve },
      {
        onSuccess: () => toast.success(approve ? "Aprovada" : "Rejeitada"),
        onError: (e) => toast.error("Erro ao decidir", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Mudanças e Melhoria
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Requisito 6.3 da ISO 9001 — controle de mudanças planejadas.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setNovaOpen(true)}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nova mudança ou melhoria
          </Button>
        </header>

        {!isLoading && items.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            Nenhuma mudança ou melhoria registrada ainda.
          </p>
        )}

        <div className="relative">
          <div className="absolute left-4 top-0 h-full w-0.5 bg-border md:left-6" />
          <ol className="space-y-5">
            {items.map((m) => (
              <li key={m.id} className="relative pl-12 md:pl-16">
                <span className="absolute left-0 top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-brand bg-card text-brand shadow-sm md:left-2">
                  <Shuffle className="h-3.5 w-3.5" />
                </span>
                <Card className="rounded-2xl border-border/80 shadow-sm">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {new Date(m.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                          {m.tipo === "mudanca" ? "Mudança" : "Melhoria"}
                        </div>
                        <h3 className="mt-0.5 text-base font-semibold text-foreground">
                          {m.descricao}
                        </h3>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("rounded-md border text-[10px]", statusColor[m.status])}
                      >
                        {statusLabel[m.status]}
                      </Badge>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-brand">
                        Propósito
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/85">
                        {m.proposito}
                      </p>
                    </div>

                    {(m.status === "aguardando_aprovacao" ||
                      m.status === "aprovada" ||
                      m.status === "rejeitada") && (
                      <div className="rounded-lg border border-border/60 p-3">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Checklist de avaliação (6.3.a-d)
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {checks.map((c) => {
                            const done = m[`${c.key}Bool` as const];
                            const Icon = c.icon;
                            return (
                              <div
                                key={c.key}
                                className={cn(
                                  "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px]",
                                  done
                                    ? "border-[color:var(--success)]/30 bg-[color:var(--success)]/5 text-foreground"
                                    : "border-border bg-background text-muted-foreground",
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-5 w-5 items-center justify-center rounded-full",
                                    done
                                      ? "bg-[color:var(--success)] text-white"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {done ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Circle className="h-2 w-2" />
                                  )}
                                </span>
                                <Icon className="h-3.5 w-3.5 opacity-70" />
                                <span className="flex-1">{c.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      {m.status === "rascunho" && (
                        <Button
                          size="sm"
                          onClick={() => enviarParaAvaliacao(m)}
                          className="rounded-lg bg-brand text-white hover:bg-brand/90"
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar para avaliação
                        </Button>
                      )}
                      {m.status === "aguardando_avaliacao" && (
                        <Button
                          size="sm"
                          onClick={() => abrirAvaliacao(m)}
                          variant="outline"
                          className="rounded-lg"
                        >
                          Responder checklist
                        </Button>
                      )}
                      {m.status === "aguardando_aprovacao" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => decidir(m, false)}
                            className="rounded-lg text-[color:var(--severity-critical)]"
                          >
                            <ThumbsDown className="mr-1.5 h-3.5 w-3.5" /> Rejeitar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => decidir(m, true)}
                            className="rounded-lg bg-brand text-white hover:bg-brand/90"
                          >
                            <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Aprovar
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Nova mudança/melhoria */}
      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova mudança ou melhoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Tipo</label>
              <Select
                value={nova.tipo}
                onValueChange={(v) => setNova({ ...nova, tipo: v as ChangeImprovementTipo })}
              >
                <SelectTrigger className="mt-1 h-9 rounded-md text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="melhoria">Melhoria</SelectItem>
                  <SelectItem value="mudanca">Mudança</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Descrição</label>
              <Textarea
                value={nova.descricao}
                onChange={(e) => setNova({ ...nova, descricao: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Propósito</label>
              <Textarea
                value={nova.proposito}
                onChange={(e) => setNova({ ...nova, proposito: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Data de início prevista</label>
              <Input
                type="date"
                value={nova.dataInicio}
                onChange={(e) => setNova({ ...nova, dataInicio: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarNova} className="bg-brand text-white hover:bg-brand/90">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklist de avaliação */}
      <Dialog
        open={evaluating !== null}
        onOpenChange={(o) => {
          if (!o) setEvaluating(null);
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Checklist de avaliação (6.3.a-d)</DialogTitle>
            <DialogDescription>
              Responda as 4 perguntas para poder marcar como Avaliada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {checks.map((c) => {
              const value = checklist[c.key];
              const detalheKey = `${c.key}Detalhe` as const;
              return (
                <div key={c.key} className="space-y-1.5 rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">{c.label}</label>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={value === true ? "default" : "outline"}
                        onClick={() => setChecklist({ ...checklist, [c.key]: true })}
                        className={cn(
                          "h-7 rounded-md px-2 text-[11px]",
                          value === true && "bg-brand text-white hover:bg-brand/90",
                        )}
                      >
                        Sim
                      </Button>
                      <Button
                        size="sm"
                        variant={value === false ? "default" : "outline"}
                        onClick={() =>
                          setChecklist({ ...checklist, [c.key]: false, [detalheKey]: "" })
                        }
                        className={cn(
                          "h-7 rounded-md px-2 text-[11px]",
                          value === false && "bg-brand text-white hover:bg-brand/90",
                        )}
                      >
                        Não
                      </Button>
                    </div>
                  </div>
                  {value === true && (
                    <Textarea
                      placeholder="Detalhe obrigatório quando a resposta é Sim"
                      value={checklist[detalheKey]}
                      onChange={(e) => setChecklist({ ...checklist, [detalheKey]: e.target.value })}
                      className="min-h-[60px] rounded-md text-xs"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvaluating(null)}>
              Cancelar
            </Button>
            <Button
              onClick={marcarAvaliada}
              disabled={
                !respondidas ||
                checks.some(
                  (c) => checklist[c.key] === true && !checklist[`${c.key}Detalhe` as const].trim(),
                )
              }
              className="bg-brand text-white hover:bg-brand/90"
            >
              Marcar como Avaliada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
