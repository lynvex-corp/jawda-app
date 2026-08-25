import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, AlertTriangle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { foraDaMeta } from "@/lib/kpi-data";
import {
  useCreateMeasurement,
  useIndicatorMeasurements,
} from "@/lib/queries/indicator-measurements";
import { useCreateNC } from "@/lib/queries/ncs";
import type { Indicator } from "@/lib/queries/indicators";
import { cn, getErrorMessage } from "@/lib/utils";
import { avisarGatilhoNc } from "./nc-gatilho";

function sugestaoIA(indicador: Indicator, valor: number) {
  return `O indicador ${indicador.nome} apresentou ${valor}${indicador.unidade} no período, frente à meta de ${indicador.meta}${indicador.unidade}. O desvio concentra-se no processo ${indicador.processo ?? "relacionado"}, com indícios de variação no método de execução e falhas pontuais de controle. Recomenda-se verificar a padronização das atividades, revisar a capacitação dos envolvidos e avaliar a abertura de não conformidade para tratamento estruturado da causa raiz.`;
}

export function LancarMedicaoDialog({
  indicador,
  open,
  onOpenChange,
}: {
  indicador: Indicator;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: medicoes = [] } = useIndicatorMeasurements(indicador.id);
  const createMedicao = useCreateMeasurement();
  const createNc = useCreateNC();
  const [periodo, setPeriodo] = useState("");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [analise, setAnalise] = useState("");
  const [breve, setBreve] = useState(false);
  const [sugestao, setSugestao] = useState<string | null>(null);

  const num = Number(valor);
  const temValor = valor !== "" && !Number.isNaN(num);
  const fora = temValor && foraDaMeta(num, indicador);
  const analiseOk = !fora || analise.trim().length >= 20;

  function salvar() {
    if (!periodo.trim()) return toast.error("Informe o período de referência.");
    if (!temValor) return toast.error("Informe o valor da medição.");
    if (!analiseOk)
      return toast.error(
        "Análise crítica obrigatória (mínimo 20 caracteres) para valor fora da meta.",
      );

    createMedicao.mutate(
      {
        indicatorId: indicador.id,
        periodo,
        valor: num,
        observacao: obs || undefined,
        analise: analise || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Medição registrada", {
            description: `${indicador.nome} · ${periodo}: ${num}${indicador.unidade}`,
          });
          if (fora) {
            const cronologico = [...medicoes.map((m) => m.foraDaMeta), true];
            avisarGatilhoNc(indicador, cronologico, num, createNc);
          }
          onOpenChange(false);
          setPeriodo("");
          setValor("");
          setObs("");
          setAnalise("");
          setSugestao(null);
        },
        onError: (err) => {
          if (getErrorMessage(err).includes("duplicate key")) {
            toast.error("Já existe medição para este período.", {
              description: "Use outro período de referência.",
            });
          } else {
            toast.error("Não foi possível salvar a medição", { description: getErrorMessage(err) });
          }
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lançar nova medição</DialogTitle>
          <DialogDescription>
            {indicador.codigo} · {indicador.nome} · frequência {indicador.frequencia.toLowerCase()}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Período de referência</Label>
              <Input
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                placeholder="ex. 2026-07"
                className="rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Valor ({indicador.unidade})</Label>
              <Input
                type="number"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={`Meta ${indicador.meta}`}
                className="rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Observação (opcional)</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              className="rounded-lg text-sm"
            />
          </div>

          <div
            className={cn(
              "space-y-2 rounded-xl border p-3",
              fora
                ? "border-[color:var(--danger-deep)]/40 bg-[color:var(--danger-deep)]/5"
                : "border-border/70 bg-muted/30",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] font-semibold">
                Análise crítica{" "}
                {fora ? (
                  <span className="text-[color:var(--danger-deep)]">· obrigatória</span>
                ) : (
                  <span className="text-muted-foreground">· opcional</span>
                )}
              </Label>
              {fora && <AlertTriangle className="h-4 w-4 text-[color:var(--danger-deep)]" />}
            </div>
            <Textarea
              value={analise}
              onChange={(e) => setAnalise(e.target.value)}
              rows={breve ? 2 : 4}
              placeholder={
                fora
                  ? "Descreva a causa provável e o encaminhamento (mín. 20 caracteres)"
                  : "adicione observações se quiser"
              }
              className="rounded-lg text-sm"
            />
            {fora && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-[11px]"
                  onClick={() => setSugestao(sugestaoIA(indicador, num))}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Sugerir análise com IA
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-lg text-[11px]"
                  onClick={() => setBreve((b) => !b)}
                >
                  Análise breve
                </Button>
              </div>
            )}
            {sugestao && (
              <Card className="rounded-lg border-brand/30 bg-brand-soft/40">
                <CardContent className="space-y-2 p-3">
                  <Badge
                    variant="outline"
                    className="rounded-md border-brand/30 bg-background text-[10px] text-brand"
                  >
                    Sugestão — deve ser analisada
                  </Badge>
                  <p className="text-[11px] leading-relaxed text-foreground">{sugestao}</p>
                  <Button
                    size="sm"
                    className="rounded-lg bg-brand text-white hover:bg-brand/90"
                    onClick={() => {
                      setAnalise(sugestao);
                      setSugestao(null);
                    }}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Usar esta análise
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
            onClick={salvar}
            disabled={createMedicao.isPending || createNc.isPending}
          >
            Salvar medição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
