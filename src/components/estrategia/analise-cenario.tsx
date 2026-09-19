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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
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
  Trash2,
  Eye,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import {
  useSwotCurrent,
  useSwotHistory,
  useStartFirstSwotDraft,
  useStartNewSwotVersion,
  useDeleteSwotCard,
  useSwotAnalysisDetail,
  formatarVersaoSwot,
  useFormalizeSwotAnalysis,
  useUpdateSwotContext,
  useCreateSwotCard,
  useUpdateSwotCard,
  useMoveSwotCard,
  useLinkSwotCardsToActionPlan,
  useRisksOpportunities,
  useCreateRiskOpportunity,
  type SwotQuadrant,
  type SwotCard,
} from "@/lib/queries/estrategia";
import { LockedDocumentBanner, InfoHint } from "@/components/estrategia/formal-document";
import { GerarPlanoAcaoDialog } from "@/components/estrategia/gerar-plano-dialog";

const QUADRANTS: SwotQuadrant[] = ["forca", "fraqueza", "oportunidade", "ameaca"];

const CONTEXTO_INFO_TEXT = `Ao analisar o contexto da organização, considere:

Contexto externo: ambiente legal, tecnológico, competitivo, de mercado, cultural, social e econômico, seja em nível internacional, nacional, regional ou local.

Contexto interno: valores, cultura, conhecimento organizacional e desempenho da empresa.

Nota: o objetivo é identificar questões que afetam a capacidade da organização de atingir os resultados pretendidos pelo sistema de gestão da qualidade.`;

/** Bloco 8, item 5: enquadramento do texto por quadrante — pontos negativos
 * (fraqueza/ameaça) "tratam", pontos positivos (força/oportunidade)
 * "potencializam". É só rótulo de texto sobre a mesma estrutura de plano de
 * ação (corretiva) — a seção 10 do Guia trava a v1 em corretiva e
 * contingência, sem tipo novo de plano. */
function prefixoQuadrante(q: SwotQuadrant): string {
  switch (q) {
    case "fraqueza":
      return "Tratar fraqueza";
    case "ameaca":
      return "Tratar ameaça";
    case "forca":
      return "Potencializar força";
    case "oportunidade":
      return "Potencializar oportunidade";
    default:
      return "Tratar";
  }
}

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
  const deleteCard = useDeleteSwotCard();
  const formalize = useFormalizeSwotAnalysis();
  const updateContext = useUpdateSwotContext();
  const createCard = useCreateSwotCard();
  const updateCard = useUpdateSwotCard();
  const moveCard = useMoveSwotCard();
  const linkCardsToPlan = useLinkSwotCardsToActionPlan();
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
  // Itens 4 e 5: seleção múltipla de cards para consolidar num só plano de
  // ação. `planoDialog` guarda o texto inicial e o que fazer com o plano
  // gerado — reaproveitado tanto pela seleção de cards quanto pelas
  // recomendações da IA (mesmo dialog, dois chamadores diferentes).
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [planoDialog, setPlanoDialog] = useState<{
    problema: string;
    onGerado: (plan: { id: string; code: string }) => void;
  } | null>(null);
  // Item 4: escolha de qual versão anterior serve de modelo. "branco" começa
  // do zero; qualquer outro valor é o id da análise a copiar.
  const [modeloOpen, setModeloOpen] = useState(false);
  const [modeloEscolhido, setModeloEscolhido] = useState<string>("branco");
  // Item 3: id da versão aberta pelo ícone de olho na listagem.
  const [verVersaoId, setVerVersaoId] = useState<string | null>(null);
  const [cardParaExcluir, setCardParaExcluir] = useState<SwotCard | null>(null);
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
        onError: (e) =>
          toast.error("Não foi possível reclassificar", { description: getErrorMessage(e) }),
      },
    );
    setDragId(null);
  };

  const toggleSelecionado = (cardId: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const abrirGeracaoConsolidada = () => {
    const selecionadosCards = cards.filter((c) => selecionados.has(c.id));
    if (selecionadosCards.length === 0) return;
    const problema = selecionadosCards
      .map((c) => `${prefixoQuadrante(c.quadrant)}: ${c.description}`)
      .join("\n");
    const idsAlvo = selecionadosCards.map((c) => c.id);
    setPlanoDialog({
      problema,
      onGerado: (plan) => {
        linkCardsToPlan.mutate(
          { cardIds: idsAlvo, planId: plan.id },
          {
            onError: (e) =>
              toast.error("Plano criado, mas não foi possível vincular os cards", {
                description: getErrorMessage(e),
              }),
          },
        );
        setSelecionados(new Set());
      },
    });
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
          toast.error("Não foi possível gerar o registro", { description: getErrorMessage(e) }),
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
          onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }),
        },
      );
    } else if (adding) {
      createCard.mutate(
        { analysisId: analysis.id, quadrant: adding, description: texto },
        {
          onSuccess: () => toast.success("Card adicionado"),
          onError: (e) => toast.error("Erro ao adicionar", { description: getErrorMessage(e) }),
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
      {
        onError: (e) => toast.error("Erro ao salvar contexto", { description: getErrorMessage(e) }),
      },
    );
  };

  const confirmarFormalizacao = () => {
    if (!analysis) return;
    formalize.mutate(analysis.id, {
      onSuccess: () => {
        toast.success("Análise formalizada", {
          description: "O número da versão foi gerado automaticamente.",
        });
        setFormalizeOpen(false);
      },
      onError: (e) =>
        toast.error("Não foi possível formalizar", { description: getErrorMessage(e) }),
    });
  };

  // Item 1: remover card. É soft delete no banco (carimba deleted_at), então
  // o registro continua existindo para auditoria — mas some da tela, que é o
  // que o usuário espera de uma lixeira. Só oferecido em rascunho.
  const excluirCard = (card: SwotCard) => {
    setCardParaExcluir(card);
  };

  const confirmarExclusaoCard = () => {
    const card = cardParaExcluir;
    if (!card) return;
    deleteCard.mutate(card.id, {
      onSuccess: () => {
        setCardParaExcluir(null);
        toast.success("Card removido");
      },
      onError: (e) =>
        toast.error("Não foi possível remover o card", { description: getErrorMessage(e) }),
    });
  };

  const iniciarNovaVersao = () => {
    // Já existe versão formalizada? Pergunta se quer aproveitar alguma como
    // modelo (Bloco 2, item 4). Sem histórico não há o que escolher, então
    // vai direto para o rascunho em branco.
    if (history && history.length > 0) {
      setModeloEscolhido("branco");
      setModeloOpen(true);
      return;
    }
    criarNovaVersao(null);
  };

  const criarNovaVersao = (sourceId: string | null) => {
    startNewVersion.mutate(sourceId, {
      onSuccess: () => {
        setModeloOpen(false);
        toast.success(
          sourceId ? "Nova versão criada a partir do modelo" : "Nova versão criada em branco",
        );
      },
      onError: (e) =>
        toast.error("Não foi possível iniciar nova versão", { description: getErrorMessage(e) }),
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
    setPlanoDialog({
      problema: rec.titulo,
      onGerado: () => setAiRecs((prev) => prev.filter((r) => r.id !== rec.id)),
    });
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
              Mapeie forças, fraquezas, oportunidades e ameaças, e gere planos de ação a partir do
              que precisa de resposta.
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
              Esta é a última versão formalizada ({formatarVersaoSwot(analysis)}) — somente leitura.
              Clique em "Nova versão" para editar. Gerar plano de ação e gerar risco/oportunidade
              continuam disponíveis normalmente.
            </LockedDocumentBanner>
          </div>
        )}

        {/* Itens 4 e 5: barra de seleção múltipla para consolidar num só
            plano de ação — disponível em rascunho ou em versão formalizada
            (item 1: decidir sobre item antigo não exige nova versão). */}
        {selecionados.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/30 bg-brand-soft/60 px-4 py-2.5">
            <span className="text-xs font-medium text-brand">
              {selecionados.size}{" "}
              {selecionados.size === 1 ? "item selecionado" : "itens selecionados"}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelecionados(new Set())}
                className="rounded-lg"
              >
                Limpar seleção
              </Button>
              <Button
                size="sm"
                onClick={abrirGeracaoConsolidada}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" /> Gerar Plano de Ação
              </Button>
            </div>
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
                            onDelete={() => excluirCard(c)}
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
                        onDelete={() => excluirCard(c)}
                        onGenerateRisk={showRiskAction ? () => gerarRisco(c) : undefined}
                        linkedRiskCode={
                          risks.find((r) => r.originSwotCardId === c.id)?.code ?? null
                        }
                        selecionavel
                        selecionado={selecionados.has(c.id)}
                        onToggleSelecionado={() => toggleSelecionado(c.id)}
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
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-semibold text-foreground">Contexto</h2>
                    <InfoHint text={CONTEXTO_INFO_TEXT} />
                  </div>
                  {analysis.status === "formalizada" && (
                    <Badge variant="outline" className="rounded-md text-[10px]">
                      Versão {formatarVersaoSwot(analysis)}
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
                    {/* Itens 2, 3 e 5: listagem completa das análises já
                        formalizadas, no mesmo formato do Escopo do Sistema —
                        versão, quem formalizou e data —, mais o olho para
                        abrir a versão em somente leitura. Antes isto era um
                        VersionHistoryList compacto limitado a 4 entradas,
                        sem autor e sem como consultar o conteúdo. */}
                    <div className="space-y-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Análises formalizadas
                      </h3>
                      <ul className="space-y-1.5">
                        {history.map((h) => (
                          <li
                            key={h.id}
                            className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2"
                          >
                            <Badge
                              variant="outline"
                              className="shrink-0 rounded-md font-mono text-[10px]"
                            >
                              {formatarVersaoSwot(h)}
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[11px] font-medium text-foreground">
                                {h.formalizedByName ?? "Autor não identificado"}
                              </div>
                              {h.formalizedAt && (
                                <div className="text-[10px] text-muted-foreground">
                                  {new Date(h.formalizedAt).toLocaleDateString("pt-BR")}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setVerVersaoId(h.id)}
                              title={`Ver a versão ${formatarVersaoSwot(h)}`}
                              aria-label={`Ver a versão ${formatarVersaoSwot(h)}`}
                              className="h-7 w-7 shrink-0 rounded-md p-0"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
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
          <p className="text-xs text-muted-foreground">
            O número da versão é gerado automaticamente na sequência da última formalizada.
          </p>
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

      {/* Item 1 — confirmação de exclusão de card */}
      <Dialog open={!!cardParaExcluir} onOpenChange={(v) => !v && setCardParaExcluir(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Remover card</DialogTitle>
            <DialogDescription>
              O card sai da análise. O registro é mantido no histórico do sistema para fins de
              auditoria, mas não volta a aparecer nesta tela.
            </DialogDescription>
          </DialogHeader>
          {cardParaExcluir && (
            <p className="rounded-lg bg-muted/50 p-3 text-sm text-foreground">
              {cardParaExcluir.description}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardParaExcluir(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarExclusaoCard}
              disabled={deleteCard.isPending}
              className="bg-[color:var(--severity-critical)] text-white hover:bg-[color:var(--severity-critical)]/90"
            >
              {deleteCard.isPending ? "Removendo…" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item 4 — escolher análise anterior como modelo */}
      <Dialog open={modeloOpen} onOpenChange={setModeloOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova versão da Análise de Cenário</DialogTitle>
            <DialogDescription>
              Você pode aproveitar uma análise já formalizada como ponto de partida — os cards dela
              são copiados para o novo rascunho — ou começar do zero.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={modeloEscolhido} onValueChange={setModeloEscolhido} className="gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs">
              <RadioGroupItem value="branco" /> Começar em branco
            </label>
            {(history ?? []).map((h) => (
              <label
                key={h.id}
                className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs"
              >
                <RadioGroupItem value={h.id} />
                <span className="font-mono">{formatarVersaoSwot(h)}</span>
                <span className="text-muted-foreground">
                  {h.formalizedAt ? new Date(h.formalizedAt).toLocaleDateString("pt-BR") : ""}
                </span>
              </label>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModeloOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => criarNovaVersao(modeloEscolhido === "branco" ? null : modeloEscolhido)}
              disabled={startNewVersion.isPending}
              className="bg-brand text-white hover:bg-brand/90"
            >
              {startNewVersion.isPending ? "Criando…" : "Criar versão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item 3 — ver uma versão formalizada (ícone de olho) */}
      <VerVersaoDialog analysisId={verVersaoId} onClose={() => setVerVersaoId(null)} />

      {/* Modal IA */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-brand" /> Análise cruzada por IA
            </DialogTitle>
            <DialogDescription>
              A IA Jawda combina os quadrantes e propõe estratégias acionáveis.
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

      {/* Itens 4 e 5 — gerar plano de ação a partir de cards selecionados ou
          de uma recomendação da IA (mesmo dialog, dois chamadores). */}
      <GerarPlanoAcaoDialog
        open={planoDialog !== null}
        onOpenChange={(o) => !o && setPlanoDialog(null)}
        origem="Estratégia"
        problemaInicial={planoDialog?.problema ?? ""}
        onGerado={(plan) => {
          planoDialog?.onGerado(plan);
          setPlanoDialog(null);
        }}
      />
    </AppShell>
  );
}

function SwotCardItem({
  card,
  isDraft,
  onDragStart,
  onEdit,
  onGenerateRisk,
  onDelete,
  linkedRiskCode,
  selecionavel,
  selecionado,
  onToggleSelecionado,
}: {
  card: SwotCard;
  isDraft: boolean;
  onDragStart: () => void;
  onEdit: () => void;
  onGenerateRisk?: () => void;
  onDelete?: () => void;
  linkedRiskCode?: string | null;
  selecionavel?: boolean;
  selecionado?: boolean;
  onToggleSelecionado?: () => void;
}) {
  // Itens 1, 2, 4 e 5: seleção pra gerar plano de ação funciona a qualquer
  // momento (rascunho ou versão formalizada) — decidir sobre um card antigo
  // não é edição de conteúdo, não deveria exigir nova versão.
  const podeSelecionar = selecionavel && !card.generatedActionPlanCode && onToggleSelecionado;

  return (
    <div
      draggable={isDraft}
      onDragStart={isDraft ? onDragStart : undefined}
      className={cn(
        "group rounded-xl border border-border/70 bg-card p-3 shadow-sm transition",
        isDraft && "cursor-grab hover:border-brand/40 hover:shadow-md active:cursor-grabbing",
        selecionado && "border-brand/60 bg-brand-soft/30 ring-1 ring-brand/40",
      )}
    >
      <div className="flex items-start gap-2">
        {isDraft && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />}
        {podeSelecionar && (
          <Checkbox
            checked={!!selecionado}
            onCheckedChange={onToggleSelecionado}
            aria-label="Selecionar para gerar plano de ação"
            className="mt-0.5 shrink-0"
          />
        )}
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
            {card.generatedActionPlanCode && (
              <Badge
                variant="outline"
                className="rounded-md border-brand/30 bg-brand-soft text-[10px] text-brand"
              >
                <Link2 className="mr-1 h-3 w-3" /> {card.generatedActionPlanCode}
              </Badge>
            )}
            {linkedRiskCode ? (
              <Badge
                variant="outline"
                className="rounded-md border-[color:var(--severity-high)]/30 bg-[color:var(--severity-high)]/10 text-[10px] text-[color:var(--severity-high)]"
              >
                <ShieldAlert className="mr-1 h-3 w-3" /> {linkedRiskCode}
              </Badge>
            ) : onGenerateRisk ? (
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
                title="Editar"
                aria-label="Editar card"
                className="ml-auto h-7 w-7 rounded-md p-0 opacity-0 group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            {isDraft && onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                title="Excluir card"
                aria-label="Excluir card"
                className="h-7 w-7 rounded-md p-0 text-[color:var(--severity-critical)] opacity-0 hover:bg-[color:var(--severity-critical)]/10 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Item 3 — consulta somente leitura de uma versão já formalizada, aberta
 * pelo ícone de olho na listagem. Reusa a mesma leitura de cards da tela
 * principal, mas sem nenhuma ação de edição: versão formalizada é evidência,
 * não rascunho. */
function VerVersaoDialog({
  analysisId,
  onClose,
}: {
  analysisId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useSwotAnalysisDetail(analysisId ?? undefined);

  return (
    <Dialog open={!!analysisId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            Análise de Cenário {data ? `— versão ${formatarVersaoSwot(data.analysis)}` : ""}
          </DialogTitle>
          <DialogDescription>
            {data?.analysis.formalizedByName
              ? `Formalizada por ${data.analysis.formalizedByName}`
              : "Versão formalizada"}
            {data?.analysis.formalizedAt
              ? ` em ${new Date(data.analysis.formalizedAt).toLocaleDateString("pt-BR")}`
              : ""}
            .
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>}

        {data && (
          <div className="space-y-4">
            {(data.analysis.contextoInterno || data.analysis.contextoExterno) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Contexto interno
                  </h4>
                  <p className="whitespace-pre-wrap text-xs text-foreground">
                    {data.analysis.contextoInterno || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Contexto externo
                  </h4>
                  <p className="whitespace-pre-wrap text-xs text-foreground">
                    {data.analysis.contextoExterno || "—"}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {QUADRANTS.map((q) => {
                const meta = quadrantMeta[q];
                const list = data.cards.filter((c) => c.quadrant === q);
                return (
                  <div key={q} className={cn("rounded-xl border p-3", meta.ring)}>
                    <div
                      className={cn(
                        "mb-2 rounded-md px-2 py-1 text-[11px] font-semibold",
                        meta.head,
                      )}
                    >
                      {meta.label}
                    </div>
                    {list.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">Nenhum registro.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {list.map((c) => (
                          <li
                            key={c.id}
                            className="rounded-lg border border-border/60 bg-card p-2 text-xs text-foreground"
                          >
                            {c.description}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
