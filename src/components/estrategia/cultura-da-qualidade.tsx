import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  QUALITY_CULTURE_QUESTIONS,
  DIMENSAO_LABEL,
  useQualityCultureSurveys,
  useCreateQualityCultureSurvey,
  useMyOpenQualityCultureSurvey,
  useSubmitQualityCultureSurveyResponse,
  useQualityCultureSurveyResults,
  type QualityCultureDimensao,
} from "@/lib/queries/quality-culture";

const DIMENSOES = Object.keys(DIMENSAO_LABEL) as QualityCultureDimensao[];

/** Quem programa a rodada e vê o resultado agregado — mesma régua já usada
 * na pesquisa de clima organizacional (is_hr_authorized no banco). */
const PERFIS_GOVERNANCA = new Set(["admin", "quality_manager"]);

function MaturidadeBadge({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-sm text-muted-foreground">—</span>;
  const tone =
    valor >= 75
      ? "text-[color:var(--success)]"
      : valor >= 50
        ? "text-[color:var(--severity-high)]"
        : "text-[color:var(--severity-critical)]";
  return <span className={cn("text-2xl font-semibold", tone)}>{valor}%</span>;
}

function ResultadoRodada({ surveyId }: { surveyId: string }) {
  const { data: resultado, isLoading } = useQualityCultureSurveyResults(surveyId);

  if (isLoading || !resultado) {
    return <div className="py-6 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Maturidade geral
          </div>
          <div className="text-[11px] text-muted-foreground">
            {resultado.totalRespostas} resposta(s)
          </div>
        </div>
        <MaturidadeBadge valor={resultado.maturidadeGeral} />
      </div>
      <div className="space-y-2">
        {resultado.porDimensao.map((d) => (
          <div
            key={d.dimensao}
            className="flex items-center justify-between rounded-lg border border-border/60 p-3"
          >
            <span className="text-xs text-foreground/85">{d.label}</span>
            <MaturidadeBadge valor={d.maturidade} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgramarRodadaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const criar = useCreateQualityCultureSurvey();

  function programar() {
    if (!inicio || !fim) {
      toast.error("Preencha o início e o fim da janela");
      return;
    }
    criar.mutate(
      { janelaInicio: inicio, janelaFim: fim },
      {
        onSuccess: () => {
          toast.success("Rodada programada");
          onOpenChange(false);
          setInicio("");
          setFim("");
        },
        onError: (e) =>
          toast.error("Não foi possível programar", { description: getErrorMessage(e) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Programar rodada de autodiagnóstico</DialogTitle>
          <DialogDescription>
            Aplicado anualmente — todos os usuários ativos respondem dentro da janela.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Início</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={programar}
            disabled={criar.isPending}
            className="bg-brand text-white hover:bg-brand/90"
          >
            Programar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Formulário de resposta — qualquer usuário ativo, aparece só quando há
 * rodada aberta e a pessoa ainda não respondeu (useMyOpenQualityCultureSurvey
 * já filtra isso). Mesmo padrão de botões 1-5 já usado na pesquisa de clima
 * (src/components/pessoas/performance.tsx). */
function FormularioResposta() {
  const { data: pendente } = useMyOpenQualityCultureSurvey();
  const submeter = useSubmitQualityCultureSurveyResponse();
  const [notas, setNotas] = useState<Record<string, number>>({});

  if (!pendente) return null;

  function enviar() {
    if (!pendente) return;
    const faltando = QUALITY_CULTURE_QUESTIONS.filter((q) => !notas[q.codigo]);
    if (faltando.length > 0) {
      toast.error(`Faltam ${faltando.length} afirmação(ões) para responder`);
      return;
    }
    submeter.mutate(
      { surveyId: pendente.id, respostas: notas },
      {
        onSuccess: () =>
          toast.success("Resposta enviada — obrigado por contribuir com a cultura da qualidade."),
        onError: (e) => toast.error("Erro ao enviar", { description: getErrorMessage(e) }),
      },
    );
  }

  return (
    <Card className="rounded-2xl border-brand/30 bg-brand-soft/40 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-brand" /> Autodiagnóstico de Cultura da Qualidade
        </div>
        <CardDescription className="text-xs">
          Responda até {new Date(`${pendente.janelaFim}T00:00:00`).toLocaleDateString("pt-BR")}.
          Para cada afirmação, escolha de 1 (discordo totalmente) a 5 (concordo totalmente). Suas
          respostas são identificadas e vistas apenas por quem tem governança da qualidade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {DIMENSOES.map((dimensao) => (
          <div key={dimensao} className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand">
              {DIMENSAO_LABEL[dimensao]}
            </div>
            {QUALITY_CULTURE_QUESTIONS.filter((q) => q.dimensao === dimensao).map((q) => (
              <div key={q.codigo} className="space-y-1.5">
                <label className="text-xs text-foreground/85">{q.texto}</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNotas((prev) => ({ ...prev, [q.codigo]: n }))}
                      className={cn(
                        "flex h-8 flex-1 items-center justify-center rounded-lg border text-xs font-medium transition",
                        notas[q.codigo] === n
                          ? "border-brand bg-white text-brand"
                          : "border-border/60 bg-white/50 text-muted-foreground hover:border-brand/40",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
        <Button
          onClick={enviar}
          disabled={submeter.isPending}
          className="w-full bg-brand text-white hover:bg-brand/90"
        >
          Enviar respostas
        </Button>
      </CardContent>
    </Card>
  );
}

export function CulturaDaQualidadePage() {
  const { currentOrg } = useAuth();
  const souGovernanca = !!currentOrg && PERFIS_GOVERNANCA.has(currentOrg.role);
  const { data: rodadas = [] } = useQualityCultureSurveys();
  const [rodadaAberta, setRodadaAberta] = useState<string | null>(null);
  const [dialogNovaRodada, setDialogNovaRodada] = useState(false);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Cultura da Qualidade
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Autodiagnóstico anual de maturidade — é através dele que o sistema comprova, ao longo
              do tempo, que eleva a cultura de qualidade da organização.
            </p>
          </div>
          {souGovernanca && (
            <Button
              size="sm"
              onClick={() => setDialogNovaRodada(true)}
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Programar rodada
            </Button>
          )}
        </header>

        <FormularioResposta />

        {souGovernanca ? (
          <Card className="rounded-xl border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Rodadas</CardTitle>
              <CardDescription>Histórico de aplicações, mais recente primeiro.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {rodadas.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                  Nenhuma rodada programada ainda.
                </div>
              )}
              {rodadas.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRodadaAberta(rodadaAberta === r.id ? null : r.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-brand-soft/30"
                >
                  <span className="text-sm text-foreground">
                    {new Date(`${r.janelaInicio}T00:00:00`).toLocaleDateString("pt-BR")} —{" "}
                    {new Date(`${r.janelaFim}T00:00:00`).toLocaleDateString("pt-BR")}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      rodadaAberta === r.id && "rotate-90",
                    )}
                  />
                </button>
              ))}
              {rodadaAberta && (
                <div className="pt-2">
                  <ResultadoRodada surveyId={rodadaAberta} />
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl border-border/80 shadow-sm">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              O resultado agregado é visível para o Gestor da Qualidade e a Administração.
            </CardContent>
          </Card>
        )}
      </div>

      <ProgramarRodadaDialog open={dialogNovaRodada} onOpenChange={setDialogNovaRodada} />
    </AppShell>
  );
}
