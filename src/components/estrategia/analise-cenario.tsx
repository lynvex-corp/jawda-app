import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Plus,
  Link2,
  GripVertical,
  Pencil,
  Wand2,
  History,
  FilePlus2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useSwotCurrent,
  useSwotHistory,
  useStartFirstSwotDraft,
  useStartNewSwotVersion,
  useFormalizeSwotAnalysis,
  useUpdateSwotContext,
  useCreateSwotCard,
  useUpdateSwotCard,
  useMoveSwotCard,
  useGenerateActionPlanFromSwotCard,
  useCreateStrategyActionPlan,
  useRisksOpportunities,
  useCreateRiskOpportunity,
  type SwotQuadrant,
  type SwotCard,
} from "@/lib/queries/estrategia";
import { LockedDocumentBanner, VersionHistoryList } from "@/components/estrategia/formal-document";

const QUADRANTS: SwotQuadrant[] = ["forca", "fraqueza", "oportunidade", "ameaca"];

const quadrantMeta: Record<
  SwotQuadrant,
  { label: string; sub: string; ring: string; head: string; chip: string }
> = {
  forca: {
    label: "Forças",
    sub: "Internas · Positivas",
    ring: "border-[color:var(--success)]/40",
    head: "bg-[color:var(--success)]/10 text-[color:var(--success)]",
    chip: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  },
  fraqueza: {
    label: "Fraquezas",
    sub: "Internas · Negativas",
    ring: "border-[color:var(--warning)]/50",
    head: "bg-[color:var(--warning)]/15 text-[color:var(--severity-high)]",
    chip: "bg-[color:var(--warning)]/20 text-[color:var(--severity-high)] border-[color:var(--warning)]/40",
  },
  oportunidade: {
    label: "Oportunidades",
    sub: "Externas · Positivas",
    ring: "border-brand/30",
    head: "bg-brand-soft text-brand",
    chip: "bg-brand-soft text-brand border-brand/20",
  },
  ameaca: {
    label: "Ameaças",
    sub: "Externas · Negativas",
    ring: "border-[color:var(--severity-critical)]/40",
    head: "bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)]",
    chip: "bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)] border-[color:var(--severity-critical)]/30",
  },
  nao_classificado: {
    label: "A classificar",
    sub: "Vindos de NC · aguardando arrasto",
    ring: "border-border",
    head: "bg-muted text-foreground",
    chip: "bg-muted text-foreground border-border",
  },
};

interface IARec {
  id: string;
  titulo: string;
  descricao: string;
  origem: string;
}

export function AnaliseCenarioPage() {
  const { data, isLoading } = useSwotCurrent();
  const { data: history } = useSwotHistory();
  const startFirstDraft = useStartFirstSwotDraft();
  const startNewVersion = useStartNewSwotVersion();
  const formalize = useFormalizeSwotAnalysis();
  const updateContext = useUpdateSwotContext();
  const createCard = useCreateSwotCard();
  const updateCard = useUpdateSwotCard();
  const moveCard = useMoveSwotCard();
  const generatePlan = useGenerateActionPlanFromSwotCard();
  const createStandalonePlan = useCreateStrategyActionPlan();
  const { data: risks = [] } = useRisksOpportunities();
  const createRisk = useCreateRiskOpportunity();

  const [dragId, setDragId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SwotCard | null>(null);
  const [adding, setAdding] = useState<SwotQuadrant | null>(null);
  const [formText, setFormText] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiRecs, setAiRecs] = useState<IARec[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [formalizeOpen, setFormalizeOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [contextoInterno, setContextoInterno] = useState("");
  const [contextoExterno, setContextoExterno] = useState("");

  const analysis = data?.analysis ?? null;
  const cards = data?.cards ?? [];
  const isDraft = data?.isDraft ?? false;

  useEffect(() => {
    if (analysis) {
      setContextoInterno(analysis.contextoInterno);
      setContextoExterno(analysis.contextoExterno);
    }
  }, [analysis?.id]);

  const onDrop = (q: SwotQuadrant) => {
    if (!dragId || !isDraft) return;
    moveCard.mutate(
      { id: dragId, quadrant: q },
      {
        onSuccess: () => toast.success("Card reclassificado"),
        onError: (e) => toast.error("Não foi possível reclassificar", { description: String(e) }),
      },
    );
    setDragId(null);
  };

  const gerarPlano = (card: SwotCard) => {
    generatePlan.mutate(
      {
        cardId: card.id,
        description: `Tratar ${card.quadrant === "fraqueza" ? "fraqueza" : "ameaça"}: ${card.description}`,
      },
      {
        onSuccess: (plan) =>
          toast.success("Plano de ação gerado", { description: `Vínculo criado: ${plan.code}` }),
        onError: (e) => toast.error("Não foi possível gerar o plano", { description: String(e) }),
      },
    );
  };

  const gerarRisco = (card: SwotCard) => {
    createRisk.mutate(
      {
        type: card.quadrant === "ameaca" ? "risco" : "oportunidade",
        area: "qualidade",
        description: card.description,
        probability: 3,
        impact: 3,
        originSwotCardId: card.id,
      },
      {
        onSuccess: (created) =>
          toast.success(`${created.code} registrado`, {
            description: "Ajuste área, probabilidade e impacto na tela de Riscos e Oportunidades.",
          }),
        onError: (e) =>
          toast.error("Não foi possível gerar o registro", { description: String(e) }),
      },
    );
  };

  const salvar = () => {
    const texto = formText.trim();
    if (!texto || !analysis) return;
    if (editing) {
      updateCard.mutate(
        { id: editing.id, description: texto },
        {
          onSuccess: () => toast.success("Card atualizado"),
          onError: (e) => toast.error("Erro ao salvar", { description: String(e) }),
        },
      );
    } else if (adding) {
      createCard.mutate(
        { analysisId: analysis.id, quadrant: adding, description: texto },
        {
          onSuccess: () => toast.success("Card adicionado"),
          onError: (e) => toast.error("Erro ao adicionar", { description: String(e) }),
        },
      );
    }
    setEditing(null);
    setAdding(null);
    setFormText("");
  };

  const salvarContexto = () => {
    if (!analysis) return;
    updateContext.mutate(
      { analysisId: analysis.id, contextoInterno, contextoExterno },
      { onError: (e) => toast.error("Erro ao salvar contexto", { description: String(e) }) },
    );
  };

  const confirmarFormalizacao = () => {
    if (!analysis || !versionLabel.trim()) {
      toast.error("Informe o rótulo da versão");
      return;
    }
    formalize.mutate(
      { analysisId: analysis.id, versionLabel: versionLabel.trim() },
      {
        onSuccess: () => {
          toast.success("Análise formalizada", { description: versionLabel.trim() });
          setFormalizeOpen(false);
          setVersionLabel("");
        },
        onError: (e) => toast.error("Não foi possível formalizar", { description: String(e) }),
      },
    );
  };

  const iniciarNovaVersao = () => {
    startNewVersion.mutate(undefined, {
      onSuccess: () => toast.success("Nova versão criada a partir da última formalizada"),
      onError: (e) =>
        toast.error("Não foi possível iniciar nova versão", { description: String(e) }),
    });
  };

  const rodarIA = () => {
    setAiLoading(true);
    setAiOpen(true);
    setAiRecs([]);
    setTimeout(() => {
      const forcas = cards.filter((c) => c.quadrant === "forca");
      const ameacas = cards.filter((c) => c.quadrant === "ameaca");
      const fraq = cards.filter((c) => c.quadrant === "fraqueza");
      const oport = cards.filter((c) => c.quadrant === "oportunidade");
      const recs: IARec[] = [];
      if (forcas[0] && ameacas[0])
        recs.push({
          id: "r1",
          titulo: `Usar "${forcas[0].description.slice(0, 40)}..." para mitigar "${ameacas[0].description.slice(0, 40)}..."`,
          descricao:
            "Estratégia defensiva (Máxi-Míni): capitalize sua força interna para neutralizar a ameaça externa mais aguda.",
          origem: "Força × Ameaça",
        });
      if (fraq[0] && oport[0])
        recs.push({
          id: "r2",
          titulo: `Corrigir "${fraq[0].description.slice(0, 40)}..." aproveitando "${oport[0].description.slice(0, 40)}..."`,
          descricao:
            "Estratégia de reforço (Míni-Máxi): use a oportunidade externa como alavanca para reduzir a fraqueza interna.",
          origem: "Fraqueza × Oportunidade",
        });
      if (forcas[1] && oport[1])
        recs.push({
          id: "r3",
          titulo: `Combinar "${forcas[1].description.slice(0, 40)}..." com "${oport[1].description.slice(0, 40)}..."`,
          descricao:
            "Estratégia ofensiva (Máxi-Máxi): use a força interna para capturar valor máximo da oportunidade.",
          origem: "Força × Oportunidade",
        });
      setAiRecs(recs);
      setAiLoading(false);
    }, 900);
  };

  const aplicarRec = (rec: IARec) => {
    createStandalonePlan.mutate(
      { description: rec.titulo },
      {
        onSuccess: (plan) => {
          toast.success("Plano criado a partir da IA", { description: plan.code });
          setAiRecs((prev) => prev.filter((r) => r.id !== rec.id));
        },
        onError: (e) => toast.error("Erro ao gerar plano", { description: String(e) }),
      },
    );
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Carregando…
        </div>
      </AppShell>
    );
  }

  if (!analysis) {
    return (
      <AppShell>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <FilePlus2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Nenhuma Análise de Cenário ainda
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Inicie o primeiro rascunho para começar a montar a matriz SWOT.
            </p>
          </div>
          <Button
            onClick={() => startFirstDraft.mutate()}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Iniciar Análise de Cenário
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Análise de Cenário
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Matriz SWOT do sistema de gestão — arraste os cards entre quadrantes, gere planos de
              ação a partir de fraquezas e ameaças ou peça uma análise cruzada à IA Jáwda.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={rodarIA} className="rounded-lg">
              <Sparkles className="mr-1.5 h-4 w-4" /> Analisar SWOT com IA
            </Button>
            {isDraft ? (
              <Button
                size="sm"
                onClick={() => setFormalizeOpen(true)}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                Formalizar análise
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={iniciarNovaVersao}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                <History className="mr-1.5 h-4 w-4" /> Nova versão
              </Button>
            )}
          </div>
        </header>

        {!isDraft && (
          <div className="mb-4">
            <LockedDocumentBanner>
              Esta é a última versão formalizada ({analysis.versionLabel}) — somente leitura. Clique
              em "Nova versão" para editar.
            </LockedDocumentBanner>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {cards.some((c) => c.quadrant === "nao_classificado") && (
              <div className="md:col-span-2">
                {(() => {
                  const meta = quadrantMeta.nao_classificado;
                  const list = cards.filter((c) => c.quadrant === "nao_classificado");
                  return (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop("nao_classificado")}
                      className={cn(
                        "rounded-2xl border-2 border-dashed bg-card p-3 shadow-sm",
                        meta.ring,
                      )}
                    >
                      <div
                        className={cn(
                          "mb-3 flex items-center justify-between rounded-xl px-3 py-2",
                          meta.head,
                        )}
                      >
                        <div>
                          <div className="text-sm font-semibold">{meta.label}</div>
                          <div className="text-[10px] uppercase tracking-wide opacity-80">
                            {meta.sub}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("rounded-md border text-[10px]", meta.chip)}
                        >
                          {list.length}
                        </Badge>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {list.map((c) => (
                          <SwotCardItem
                            key={c.id}
                            card={c}
                            isDraft={isDraft}
                            onDragStart={() => setDragId(c.id)}
                            onEdit={() => {
                              setEditing(c);
                              setFormText(c.description);
                            }}
                            onGeneratePlan={() => gerarPlano(c)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {QUADRANTS.map((q) => {
              const meta = quadrantMeta[q];
              const list = cards.filter((c) => c.quadrant === q);
              const showAction = q === "fraqueza" || q === "ameaca";
              const showRiskAction = q === "ameaca" || q === "oportunidade";
              return (
                <div
                  key={q}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(q)}
                  className={cn(
                    "flex min-h-[360px] flex-col rounded-2xl border-2 bg-card p-3 shadow-sm",
                    meta.ring,
                  )}
                >
                  <div
                    className={cn(
                      "mb-3 flex items-center justify-between rounded-xl px-3 py-2",
                      meta.head,
                    )}
                  >
                    <div>
                      <div className="text-sm font-semibold">{meta.label}</div>
                      <div className="text-[10px] uppercase tracking-wide opacity-80">
                        {meta.sub}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("rounded-md border text-[10px]", meta.chip)}
                    >
                      {list.length}
                    </Badge>
                  </div>
                  <div className="flex-1 space-y-2">
                    {list.map((c) => (
                      <SwotCardItem
                        key={c.id}
                        card={c}
                        isDraft={isDraft}
                        onDragStart={() => setDragId(c.id)}
                        onEdit={() => {
                          setEditing(c);
                          setFormText(c.description);
                        }}
                        onGeneratePlan={showAction ? () => gerarPlano(c) : undefined}
                        onGenerateRisk={showRiskAction ? () => gerarRisco(c) : undefined}
                        linkedRiskCode={
                          risks.find((r) => r.originSwotCardId === c.id)?.code ?? null
                        }
                      />
                    ))}
                    {isDraft && (
                      <button
                        onClick={() => {
                          setAdding(q);
                          setFormText("");
                        }}
                        className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border/60 py-2 text-[11px] text-muted-foreground hover:border-brand/40 hover:text-brand"
                      >
                        <Plus className="h-3 w-3" /> Adicionar item
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="space-y-4">
            <Card className="rounded-2xl border-border/80 shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Contexto</h2>
                  {analysis.versionLabel && (
                    <Badge variant="outline" className="rounded-md text-[10px]">
                      {analysis.versionLabel}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Contexto interno
                  </label>
                  <Textarea
                    value={contextoInterno}
                    disabled={!isDraft}
                    onChange={(e) => setContextoInterno(e.target.value)}
                    onBlur={salvarContexto}
                    className="min-h-[110px] rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Contexto externo
                  </label>
                  <Textarea
                    value={contextoExterno}
                    disabled={!isDraft}
                    onChange={(e) => setContextoExterno(e.target.value)}
                    onBlur={salvarContexto}
                    className="min-h-[110px] rounded-lg text-xs"
                  />
                </div>
                {history && history.length > 0 && (
                  <>
                    <Separator />
                    <VersionHistoryList
                      compact
                      entries={history.slice(0, 4).map((h) => ({
                        id: h.id,
                        label: h.versionLabel ?? "",
                        date: h.formalizedAt,
                      }))}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/80 bg-brand-soft/40 shadow-sm">
              <CardContent className="p-4 text-[11px] leading-relaxed text-foreground/80">
                <div className="mb-1 flex items-center gap-1.5 text-brand">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">Dica</span>
                </div>
                Fraquezas e Ameaças devem virar plano de ação. Use "Analisar com IA" para cruzar os
                quadrantes e receber recomendações estratégicas prontas.
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {/* Modal add/edit */}
      <Dialog
        open={editing !== null || adding !== null}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setAdding(null);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar item" : `Novo item — ${adding ? quadrantMeta[adding].label : ""}`}
            </DialogTitle>
            <DialogDescription>Descreva de forma clara e objetiva.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={formText}
            onChange={(e) => setFormText(e.target.value)}
            className="min-h-[120px] rounded-lg text-sm"
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setAdding(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={salvar} className="bg-brand text-white hover:bg-brand/90">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Formalizar */}
      <Dialog open={formalizeOpen} onOpenChange={setFormalizeOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Formalizar Análise de Cenário</DialogTitle>
            <DialogDescription>
              A análise vira somente leitura. Para editar de novo, crie uma nova versão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Rótulo da versão</label>
            <Input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="Ex.: Análise de Contexto_01.2026"
              className="rounded-md"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormalizeOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarFormalizacao}
              className="bg-brand text-white hover:bg-brand/90"
            >
              Formalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal IA */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-brand" /> Análise cruzada por IA
            </DialogTitle>
            <DialogDescription>
              A IA Jáwda combina os quadrantes e propõe estratégias acionáveis.
            </DialogDescription>
          </DialogHeader>
          {aiLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              Cruzando quadrantes…
            </div>
          ) : (
            <div className="space-y-3">
              {aiRecs.length === 0 && (
                <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                  Sem cards suficientes nos quadrantes para cruzar, ou todas as recomendações já
                  foram aplicadas.
                </p>
              )}
              {aiRecs.map((r) => (
                <div key={r.id} className="rounded-xl border border-border/70 bg-brand-soft/30 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-brand">
                    {r.origem}
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">{r.titulo}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.descricao}</p>
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => aplicarRec(r)}
                      className="rounded-md bg-brand text-white hover:bg-brand/90"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Gerar plano de ação
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SwotCardItem({
  card,
  isDraft,
  onDragStart,
  onEdit,
  onGeneratePlan,
  onGenerateRisk,
  linkedRiskCode,
}: {
  card: SwotCard;
  isDraft: boolean;
  onDragStart: () => void;
  onEdit: () => void;
  onGeneratePlan?: () => void;
  onGenerateRisk?: () => void;
  linkedRiskCode?: string | null;
}) {
  return (
    <div
      draggable={isDraft}
      onDragStart={isDraft ? onDragStart : undefined}
      className={cn(
        "group rounded-xl border border-border/70 bg-card p-3 shadow-sm transition",
        isDraft && "cursor-grab hover:border-brand/40 hover:shadow-md active:cursor-grabbing",
      )}
    >
      <div className="flex items-start gap-2">
        {isDraft && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{card.description}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {card.sourceNcCode && (
              <Badge
                variant="outline"
                className="rounded-md border-border text-[10px] text-muted-foreground"
              >
                <Link2 className="mr-1 h-3 w-3" /> {card.sourceNcCode}
              </Badge>
            )}
            {card.generatedActionPlanCode ? (
              <Badge
                variant="outline"
                className="rounded-md border-brand/30 bg-brand-soft text-[10px] text-brand"
              >
                <Link2 className="mr-1 h-3 w-3" /> {card.generatedActionPlanCode}
              </Badge>
            ) : onGeneratePlan && isDraft ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={onGeneratePlan}
                className="h-7 rounded-md px-2 text-[11px] text-brand hover:bg-brand-soft"
              >
                <Plus className="mr-1 h-3 w-3" /> Gerar Plano de Ação
              </Button>
            ) : null}
            {linkedRiskCode ? (
              <Badge
                variant="outline"
                className="rounded-md border-[color:var(--severity-high)]/30 bg-[color:var(--severity-high)]/10 text-[10px] text-[color:var(--severity-high)]"
              >
                <ShieldAlert className="mr-1 h-3 w-3" /> {linkedRiskCode}
              </Badge>
            ) : onGenerateRisk && isDraft ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={onGenerateRisk}
                className="h-7 rounded-md px-2 text-[11px] text-[color:var(--severity-high)] hover:bg-[color:var(--severity-high)]/10"
              >
                <ShieldAlert className="mr-1 h-3 w-3" /> Gerar Risco/Oportunidade
              </Button>
            ) : null}
            {isDraft && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                className="ml-auto h-7 w-7 rounded-md p-0 opacity-0 group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
