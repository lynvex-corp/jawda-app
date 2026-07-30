import { useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet } from "lucide-react";
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
import { cn } from "@/lib/utils";
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
          toast.error("Não foi possível salvar as medições", { description: String(err) }),
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

export function ImportarDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const steps = ["Baixar modelo", "Upload", "Mapear colunas", "Confirmar"];
  const preview = [
    { codigo: "IND_MAN_001_2026", periodo: "2026-07", valor: "9.0" },
    { codigo: "IND_DER_002_2026", periodo: "2026-07", valor: "92" },
    { codigo: "IND_MAN_003_2026", periodo: "2026-07", valor: "95" },
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setStep(0);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar medições de planilha</DialogTitle>
          <DialogDescription>
            Registros importados nascem com origem "Importado", visível na trilha.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                "flex-1 rounded-lg px-2 py-1.5 text-center text-[10px]",
                i === step
                  ? "bg-brand text-white"
                  : i < step
                    ? "bg-brand-soft text-brand"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {s}
            </div>
          ))}
        </div>
        <div className="min-h-[160px] rounded-xl border border-border/70 p-4">
          {step === 0 && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Baixe o modelo CSV com as colunas esperadas: código do indicador, período e valor.
              </p>
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => toast.success("Modelo modelo-indicadores.csv gerado")}
              >
                <Download className="mr-1.5 h-4 w-4" /> Baixar modelo CSV
              </Button>
            </div>
          )}
          {step === 1 && (
            <div className="flex h-[130px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand/40 bg-brand-soft/30 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-6 w-6 text-brand" />
              Arraste a planilha aqui ou clique para selecionar
            </div>
          )}
          {step === 2 && (
            <div className="space-y-2 text-xs">
              {["Código do indicador", "Período", "Valor"].map((c, i) => (
                <div
                  key={c}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                >
                  <span className="text-muted-foreground">
                    Coluna {String.fromCharCode(65 + i)} da planilha
                  </span>
                  <Badge
                    variant="outline"
                    className="rounded-md border-brand/30 bg-brand-soft text-[10px] text-brand"
                  >
                    {c}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-1 text-xs">
              <p className="mb-2 text-muted-foreground">
                3 medições serão importadas (simulação — a leitura real de planilha entra em aba
                futura):
              </p>
              {preview.map((p) => (
                <div
                  key={p.codigo}
                  className="flex justify-between rounded-lg bg-muted/40 px-3 py-1.5"
                >
                  <span className="font-mono text-[10px] text-brand">{p.codigo}</span>
                  <span className="text-muted-foreground">{p.periodo}</span>
                  <span className="font-medium text-foreground">{p.valor}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          {step > 0 && (
            <Button variant="outline" className="rounded-lg" onClick={() => setStep((s) => s - 1)}>
              Voltar
            </Button>
          )}
          {step < 3 ? (
            <Button
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
              onClick={() => setStep((s) => s + 1)}
            >
              Avançar
            </Button>
          ) : (
            <Button
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
              onClick={() => {
                toast.info(
                  "Importação de planilha ainda não persiste — use lançamento manual ou em lote.",
                );
                onOpenChange(false);
                setStep(0);
              }}
            >
              Confirmar importação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
