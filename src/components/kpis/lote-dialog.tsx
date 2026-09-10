import { useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { foraDaMeta } from "@/lib/kpi-data";
import {
  useBulkMeasurements,
  useIndicatorMeasurements,
} from "@/lib/queries/indicator-measurements";
import { useCreateNC } from "@/lib/queries/ncs";
import { useIndicators } from "@/lib/queries/indicators";
import { cn, getErrorMessage } from "@/lib/utils";
import { avisarGatilhoNc } from "./nc-gatilho";

export function LoteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: indicadores = [] } = useIndicators({ status: "active" });
  const { data: todasMedicoes = [] } = useIndicatorMeasurements();
  const bulkMedicao = useBulkMeasurements();
  const createNc = useCreateNC();
  const mensais = indicadores.filter((k) => k.frequencia === "Mensal");
  const [periodo, setPeriodo] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [analises, setAnalises] = useState<Record<string, string>>({});

  function salvarTudo() {
    if (!periodo.trim()) return toast.error("Informe o período de referência.");
    const entradas = mensais.filter((k) => valores[k.id] && !Number.isNaN(Number(valores[k.id])));
    if (!entradas.length) return toast.error("Nenhum valor informado.");
    const faltando = entradas.filter(
      (k) => foraDaMeta(Number(valores[k.id]), k) && (analises[k.id] ?? "").trim().length < 20,
    );
    if (faltando.length)
      return toast.error(
        `Análise crítica obrigatória em ${faltando.length} indicador(es) fora da meta.`,
      );

    bulkMedicao.mutate(
      entradas.map((k) => ({
        indicatorId: k.id,
        periodo,
        valor: Number(valores[k.id]),
        analise: analises[k.id] || undefined,
      })),
      {
        onSuccess: () => {
          toast.success(`${entradas.length} medições registradas`);
          entradas.forEach((k) => {
            const valor = Number(valores[k.id]);
            if (foraDaMeta(valor, k)) {
              const cronologico = [
                ...todasMedicoes.filter((m) => m.indicatorId === k.id).map((m) => m.foraDaMeta),
                true,
              ];
              avisarGatilhoNc(k, cronologico, valor, createNc);
            }
          });
          setValores({});
          setAnalises({});
          setPeriodo("");
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error("Não foi possível salvar as medições", { description: getErrorMessage(err) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lançar medição em lote</DialogTitle>
          <DialogDescription>
            Indicadores de frequência mensal, todos no mesmo período de referência.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Período de referência</Label>
          <Input
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            placeholder="ex. 2026-07"
            className="w-40 rounded-lg text-sm"
          />
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {mensais.map((k) => {
            const v = valores[k.id];
            const fora =
              v !== undefined && v !== "" && !Number.isNaN(Number(v)) && foraDaMeta(Number(v), k);
            return (
              <div
                key={k.id}
                className={cn(
                  "rounded-xl border p-3",
                  fora
                    ? "border-[color:var(--danger-deep)]/40 bg-[color:var(--danger-deep)]/5"
                    : "border-border/70",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{k.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {k.codigo} · meta {k.meta}
                      {k.unidade} · {k.objetivoNome}
                    </p>
                  </div>
                  <Input
                    type="number"
                    value={v ?? ""}
                    placeholder={k.unidade}
                    onChange={(e) => setValores((p) => ({ ...p, [k.id]: e.target.value }))}
                    className="h-9 w-28 rounded-lg text-sm"
                  />
                </div>
                {fora && (
                  <Textarea
                    rows={2}
                    value={analises[k.id] ?? ""}
                    onChange={(e) => setAnalises((p) => ({ ...p, [k.id]: e.target.value }))}
                    placeholder="Análise crítica obrigatória (mín. 20 caracteres)"
                    className="mt-2 rounded-lg text-xs"
                  />
                )}
              </div>
            );
          })}
          {!mensais.length && (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum indicador ativo de frequência mensal.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
            onClick={salvarTudo}
            disabled={bulkMedicao.isPending}
          >
            Salvar todas as medições
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
