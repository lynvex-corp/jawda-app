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
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  useChangesImprovements,
  useCreateAndEvaluateChangeImprovement,
  useUpdateChangeImprovement,
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

/** Item 2: mesma Lista de Verificação usada tanto no cadastro (fluxo novo,
 * combinado) quanto no fluxo legado (1 registro real já parado em
 * "aguardando_avaliacao" de antes desta entrega — ver migration
 * 20260920100000). Extraída aqui pra não duplicar a UI nos dois lugares. */
interface ChecklistState {
  consequencias: boolean | undefined;
  consequenciasDetalhe: string;
  integridade: boolean | undefined;
  integridadeDetalhe: string;
  recurso: boolean | undefined;
  recursoDetalhe: string;
  responsabilidades: boolean | undefined;
  responsabilidadesDetalhe: string;
}

const CHECKLIST_VAZIO: ChecklistState = {
  consequencias: undefined,
  consequenciasDetalhe: "",
  integridade: undefined,
  integridadeDetalhe: "",
  recurso: undefined,
  recursoDetalhe: "",
  responsabilidades: undefined,
  responsabilidadesDetalhe: "",
};

function checklistRespondida(v: ChecklistState) {
  return [v.consequencias, v.integridade, v.recurso, v.responsabilidades].every(
    (x) => x !== undefined,
  );
}

function checklistDetalhesOk(v: ChecklistState) {
  return checks.every((c) => v[c.key] !== true || v[`${c.key}Detalhe` as const].trim());
}

function ListaVerificacaoFields({
  value,
  onChange,
}: {
  value: ChecklistState;
  onChange: (next: ChecklistState) => void;
}) {
  return (
    <div className="space-y-4">
      {checks.map((c) => {
        const val = value[c.key];
        const detalheKey = `${c.key}Detalhe` as const;
        return (
          <div key={c.key} className="space-y-1.5 rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">{c.label}</label>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={val === true ? "default" : "outline"}
                  onClick={() => onChange({ ...value, [c.key]: true })}
                  className={cn(
                    "h-7 rounded-md px-2 text-[11px]",
                    val === true && "bg-brand text-white hover:bg-brand/90",
                  )}
                >
                  Sim
                </Button>
                <Button
                  size="sm"
                  variant={val === false ? "default" : "outline"}
                  onClick={() => onChange({ ...value, [c.key]: false, [detalheKey]: "" })}
                  className={cn(
                    "h-7 rounded-md px-2 text-[11px]",
                    val === false && "bg-brand text-white hover:bg-brand/90",
                  )}
                >
                  Não
                </Button>
              </div>
            </div>
            {val === true && (
              <Textarea
                placeholder="Detalhe obrigatório quando a resposta é Sim"
                value={value[detalheKey]}
                onChange={(e) => onChange({ ...value, [detalheKey]: e.target.value })}
                className="min-h-[60px] rounded-md text-xs"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MudancasSGPage() {
  const { currentOrg } = useAuth();
  const role = currentOrg?.role;
  // Item 2: mesmo trio autorizado a cadastrar/editar na RLS
  // (20260913090000). Item 2 (achado): decidir fica mais restrito —
  // só quem vai efetivamente aprovar em nome da Direção.
  const podeCadastrar = role === "admin" || role === "quality_manager" || role === "area_manager";
  const podeDecidir = role === "admin" || role === "quality_manager";

  const { data: items = [], isLoading } = useChangesImprovements();
  const createAndEvaluate = useCreateAndEvaluateChangeImprovement();
  const updateChange = useUpdateChangeImprovement();
  const decide = useDecideChangeImprovement();
  // Legado: só serve pro(s) registro(s) que já estava(m) em
  // "aguardando_avaliacao" antes desta entrega (ver migration 20260920100000).
  const submitForEvaluationLegado = useSubmitChangeForEvaluation();
  const evaluateLegado = useEvaluateChangeImprovement();

  const [novaOpen, setNovaOpen] = useState(false);
  const [nova, setNova] = useState({
    tipo: "melhoria" as ChangeImprovementTipo,
    descricao: "",
    proposito: "",
    dataInicio: "",
  });
  const [novaChecklist, setNovaChecklist] = useState<ChecklistState>(CHECKLIST_VAZIO);

  const [editing, setEditing] = useState<ChangeImprovement | null>(null);
  const [editForm, setEditForm] = useState({ descricao: "", proposito: "", dataInicio: "" });

  const [evaluatingLegado, setEvaluatingLegado] = useState<ChangeImprovement | null>(null);
  const [checklistLegado, setChecklistLegado] = useState<ChecklistState>(CHECKLIST_VAZIO);

  const salvarNova = () => {
    if (!nova.descricao.trim() || !nova.proposito.trim()) {
      toast.error("Descreva a mudança e o propósito");
      return;
    }
    if (!checklistRespondida(novaChecklist)) {
      toast.error("Responda as 4 perguntas da Lista de Verificação");
      return;
    }
    if (!checklistDetalhesOk(novaChecklist)) {
      toast.error("Detalhe obrigatório quando a resposta é Sim");
      return;
    }
    createAndEvaluate.mutate(
      {
        tipo: nova.tipo,
        descricao: nova.descricao,
        proposito: nova.proposito,
        dataInicio: nova.dataInicio,
        consequenciasBool: novaChecklist.consequencias!,
        consequenciasDetalhe: novaChecklist.consequenciasDetalhe,
        integridadeBool: novaChecklist.integridade!,
        integridadeDetalhe: novaChecklist.integridadeDetalhe,
        recursoBool: novaChecklist.recurso!,
        recursoDetalhe: novaChecklist.recursoDetalhe,
        responsabilidadesBool: novaChecklist.responsabilidades!,
        responsabilidadesDetalhe: novaChecklist.responsabilidadesDetalhe,
      },
      {
        onSuccess: () => {
          toast.success(
            (nova.tipo === "mudanca" ? "Mudança" : "Melhoria") +
              " registrada e enviada para aprovação",
          );
          setNova({ tipo: "melhoria", descricao: "", proposito: "", dataInicio: "" });
          setNovaChecklist(CHECKLIST_VAZIO);
          setNovaOpen(false);
        },
        onError: (e) => toast.error("Erro ao registrar", { description: getErrorMessage(e) }),
      },
    );
  };

  const abrirEdicao = (m: ChangeImprovement) => {
    setEditing(m);
    setEditForm({ descricao: m.descricao, proposito: m.proposito, dataInicio: m.dataInicio ?? "" });
  };

  const salvarEdicao = () => {
    if (!editing || !editForm.descricao.trim() || !editForm.proposito.trim()) {
      toast.error("Descreva a mudança e o propósito");
      return;
    }
    updateChange.mutate(
      { id: editing.id, ...editForm },
      {
        onSuccess: () => {
          toast.success("Registro atualizado");
          setEditing(null);
        },
        onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }),
      },
    );
  };

  const enviarParaAvaliacaoLegado = (m: ChangeImprovement) => {
    submitForEvaluationLegado.mutate(
      { id: m.id },
      {
        onSuccess: () => toast.success("Enviada para avaliação"),
        onError: (e) => toast.error("Não foi possível enviar", { description: getErrorMessage(e) }),
      },
    );
  };

  const abrirAvaliacaoLegado = (m: ChangeImprovement) => {
    setEvaluatingLegado(m);
    setChecklistLegado({
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

  const marcarAvaliadaLegado = () => {
    if (!evaluatingLegado || !checklistRespondida(checklistLegado)) return;
    evaluateLegado.mutate(
      {
        id: evaluatingLegado.id,
        consequenciasBool: checklistLegado.consequencias!,
        consequenciasDetalhe: checklistLegado.consequenciasDetalhe,
        integridadeBool: checklistLegado.integridade!,
        integridadeDetalhe: checklistLegado.integridadeDetalhe,
        recursoBool: checklistLegado.recurso!,
        recursoDetalhe: checklistLegado.recursoDetalhe,
        responsabilidadesBool: checklistLegado.responsabilidades!,
        responsabilidadesDetalhe: checklistLegado.responsabilidadesDetalhe,
      },
      {
        onSuccess: () => {
          toast.success("Avaliada — aguardando aprovação");
          setEvaluatingLegado(null);
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
              Registre as mudanças planejadas no sistema de gestão, com motivo, impacto e
              responsável pela implementação.
            </p>
          </div>
          {podeCadastrar && (
            <Button
              size="sm"
              onClick={() => setNovaOpen(true)}
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Nova mudança ou melhoria
            </Button>
          )}
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
                          Lista de Verificação da avaliação
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {checks.map((c) => {
                            const done = m[`${c.key}Bool` as const];
                            const detalhe = m[`${c.key}Detalhe` as const];
                            const Icon = c.icon;
                            return (
                              <div
                                key={c.key}
                                className={cn(
                                  "space-y-1 rounded-md border px-2.5 py-1.5 text-[11px]",
                                  done
                                    ? "border-[color:var(--success)]/30 bg-[color:var(--success)]/5 text-foreground"
                                    : "border-border bg-background text-muted-foreground",
                                )}
                              >
                                <div className="flex items-center gap-2">
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
                                {done && detalhe && (
                                  <p className="pl-7 text-[11px] leading-relaxed text-foreground/80">
                                    {detalhe}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {(m.avaliadoPorName || m.aprovadoPorName) && (
                          <div className="mt-2.5 space-y-0.5 text-[10px] text-muted-foreground">
                            {m.avaliadoPorName && <div>Avaliado por {m.avaliadoPorName}</div>}
                            {m.aprovadoPorName && (
                              <div>
                                {m.status === "rejeitada" ? "Rejeitado" : "Aprovado"} por{" "}
                                {m.aprovadoPorName}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      {podeCadastrar && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => abrirEdicao(m)}
                          className="rounded-lg"
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                        </Button>
                      )}
                      {m.status === "rascunho" && podeCadastrar && (
                        <Button
                          size="sm"
                          onClick={() => enviarParaAvaliacaoLegado(m)}
                          className="rounded-lg bg-brand text-white hover:bg-brand/90"
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar para avaliação
                        </Button>
                      )}
                      {m.status === "aguardando_avaliacao" && podeCadastrar && (
                        <Button
                          size="sm"
                          onClick={() => abrirAvaliacaoLegado(m)}
                          variant="outline"
                          className="rounded-lg"
                        >
                          Responder Lista de Verificação
                        </Button>
                      )}
                      {m.status === "aguardando_aprovacao" && podeDecidir && (
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

          {/* Item 2: avaliação (Lista de Verificação) já dentro do próprio
              cadastro — sem passo de "enviar" separado. */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium">Lista de Verificação</div>
            <p className="text-[11px] text-muted-foreground">
              Responda as 4 perguntas para enviar direto para aprovação.
            </p>
            <ListaVerificacaoFields value={novaChecklist} onChange={setNovaChecklist} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={salvarNova}
              disabled={createAndEvaluate.isPending}
              className="bg-brand text-white hover:bg-brand/90"
            >
              Registrar e enviar para aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar (item 3) — descrição/propósito/data, disponível em
          qualquer status, inclusive aprovada. Não reabre a Lista de
          Verificação nem a decisão já tomada. */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar mudança ou melhoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Descrição</label>
              <Textarea
                value={editForm.descricao}
                onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Propósito</label>
              <Textarea
                value={editForm.proposito}
                onChange={(e) => setEditForm({ ...editForm, proposito: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Data de início prevista</label>
              <Input
                type="date"
                value={editForm.dataInicio}
                onChange={(e) => setEditForm({ ...editForm, dataInicio: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={salvarEdicao}
              disabled={updateChange.isPending}
              className="bg-brand text-white hover:bg-brand/90"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fluxo legado — só existe pra registro que já estava parado em
          "aguardando_avaliacao" antes desta entrega (ver migration
          20260920100000). O cadastro novo não passa mais por aqui. */}
      <Dialog
        open={evaluatingLegado !== null}
        onOpenChange={(o) => {
          if (!o) setEvaluatingLegado(null);
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Lista de Verificação da avaliação</DialogTitle>
            <DialogDescription>
              Responda as 4 perguntas para poder marcar como Avaliada.
            </DialogDescription>
          </DialogHeader>
          <ListaVerificacaoFields value={checklistLegado} onChange={setChecklistLegado} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvaluatingLegado(null)}>
              Cancelar
            </Button>
            <Button
              onClick={marcarAvaliadaLegado}
              disabled={
                !checklistRespondida(checklistLegado) || !checklistDetalhesOk(checklistLegado)
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
