import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQualityObjectives, useCreateIndicator } from "@/lib/queries/indicators";
import { useOrgMembers } from "@/lib/queries/action-plans";
import {
  fontesDerivadas,
  frequenciasKpi,
  processosKpi,
  unidadesMedida,
  type BibliotecaItem,
  type FonteDados,
} from "@/lib/kpi-data";
import { cn, getErrorMessage } from "@/lib/utils";
import { PassoMetaPolaridade } from "./wizard-step-meta";
import { Field, type Draft } from "./wizard-shared";

const passos = ["Identidade", "Como medir", "Meta e polaridade"];

const draftVazio: Draft = {
  nome: "",
  descricao: "",
  objetivoId: "",
  processo: "Qualidade",
  responsavelMedicaoId: "",
  responsavelAnaliseId: "",
  formula: "",
  unidade: "%",
  fonte: "manual",
  derivadoDe: "NCs abertas",
  frequencia: "Mensal",
  meta: 90,
  faixaMin: 0,
  faixaMax: 100,
  polaridade: "maior_melhor",
  toleranciaPct: 10,
  ciclosParaDisparo: 2,
};

export function NovoIndicadorDialog({
  open,
  onOpenChange,
  objetivoPadrao,
  preset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  objetivoPadrao?: string;
  preset?: BibliotecaItem | null;
}) {
  const { data: objetivos = [] } = useQualityObjectives();
  const { data: membros = [] } = useOrgMembers();
  const createIndicador = useCreateIndicator();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    ...draftVazio,
    objetivoId: objetivoPadrao ?? "",
    responsavelMedicaoId: membros[0]?.id ?? "",
    responsavelAnaliseId: membros[0]?.id ?? "",
    ...(preset
      ? {
          nome: preset.nome,
          descricao: preset.descricao,
          formula: preset.formula,
          unidade: preset.unidade,
          frequencia: preset.frequencia,
          polaridade: preset.polaridade,
        }
      : {}),
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const podeAvancar = step !== 0 || (draft.objetivoId !== "" && draft.nome.trim() !== "");

  function salvar() {
    if (!draft.responsavelMedicaoId || !draft.responsavelAnaliseId) {
      toast.error("Selecione responsável pela medição e pela análise.");
      return;
    }
    createIndicador.mutate(
      {
        nome: draft.nome,
        descricao: draft.descricao,
        objetivoId: draft.objetivoId,
        processo: draft.processo,
        responsavelMedicaoId: draft.responsavelMedicaoId,
        responsavelAnaliseId: draft.responsavelAnaliseId,
        formula: draft.fonte === "derivado" ? `Derivado de: ${draft.derivadoDe}` : draft.formula,
        unidade: draft.unidade,
        fonte: draft.fonte,
        derivadoDe: draft.derivadoDe,
        frequencia: draft.frequencia,
        meta: draft.meta,
        polaridade: draft.polaridade,
        faixaMin: draft.polaridade === "faixa_ideal" ? draft.faixaMin : undefined,
        faixaMax: draft.polaridade === "faixa_ideal" ? draft.faixaMax : undefined,
        toleranciaPct: draft.toleranciaPct,
        ciclosParaDisparo: draft.ciclosParaDisparo,
      },
      {
        onSuccess: (novo) => {
          toast.success("Indicador criado", { description: `${novo.codigo} · ${novo.nome}` });
          onOpenChange(false);
          setStep(0);
          setDraft(draftVazio);
        },
        onError: (err) =>
          toast.error("Não foi possível criar o indicador", { description: getErrorMessage(err) }),
      },
    );
  }

  const objetivoNome = objetivos.find((o) => o.id === draft.objetivoId)?.nome;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Novo indicador</DialogTitle>
          <DialogDescription>
            O código é gerado automaticamente ao salvar, conforme a fonte dos dados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          {passos.map((p, i) => (
            <div
              key={p}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium",
                i === step
                  ? "bg-brand text-white"
                  : i < step
                    ? "bg-brand-soft text-brand"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background/25 text-[10px]">
                {i + 1}
              </span>
              {p}
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
            {step === 0 && (
              <>
                <Field label="Nome do indicador">
                  <Input
                    value={draft.nome}
                    onChange={(e) => set("nome", e.target.value)}
                    className="rounded-lg text-sm"
                  />
                </Field>
                <Field label="Descrição / o que ele mede">
                  <Textarea
                    rows={2}
                    value={draft.descricao}
                    onChange={(e) => set("descricao", e.target.value)}
                    className="rounded-lg text-sm"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Objetivo da qualidade (obrigatório)">
                    <Select value={draft.objetivoId} onValueChange={(v) => set("objetivoId", v)}>
                      <SelectTrigger className="rounded-lg text-xs">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {objetivos.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Processo relacionado">
                    <Select value={draft.processo} onValueChange={(v) => set("processo", v)}>
                      <SelectTrigger className="rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {processosKpi.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Responsável pela medição">
                    <Select
                      value={draft.responsavelMedicaoId}
                      onValueChange={(v) => set("responsavelMedicaoId", v)}
                    >
                      <SelectTrigger className="rounded-lg text-xs">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {membros.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Responsável pela análise">
                    <Select
                      value={draft.responsavelAnaliseId}
                      onValueChange={(v) => set("responsavelAnaliseId", v)}
                    >
                      <SelectTrigger className="rounded-lg text-xs">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {membros.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <Field label="Fórmula de cálculo">
                  <Textarea
                    rows={2}
                    value={draft.formula}
                    onChange={(e) => set("formula", e.target.value)}
                    placeholder="peças conformes ÷ total × 100"
                    className="rounded-lg font-mono text-xs"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Unidade de medida">
                    <Select value={draft.unidade} onValueChange={(v) => set("unidade", v)}>
                      <SelectTrigger className="rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unidadesMedida.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Frequência">
                    <Select value={draft.frequencia} onValueChange={(v) => set("frequencia", v)}>
                      <SelectTrigger className="rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {frequenciasKpi.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Fonte dos dados">
                  <RadioGroup
                    value={draft.fonte}
                    onValueChange={(v) => set("fonte", v as FonteDados)}
                    className="space-y-2"
                  >
                    {(
                      [
                        ["manual", "Manual — o usuário lança periodicamente"],
                        ["derivado", "Derivado do sistema"],
                        ["importado", "Importado (planilha)"],
                      ] as const
                    ).map(([v, label]) => (
                      <label
                        key={v}
                        className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs"
                      >
                        <RadioGroupItem value={v} /> {label}
                      </label>
                    ))}
                  </RadioGroup>
                </Field>
                {draft.fonte === "derivado" && (
                  <Field label="Origem no sistema">
                    <Select value={draft.derivadoDe} onValueChange={(v) => set("derivadoDe", v)}>
                      <SelectTrigger className="rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fontesDerivadas.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </>
            )}

            {step === 2 && <PassoMetaPolaridade draft={draft} set={set} />}
          </div>

          <aside className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Pré-visualização
            </p>
            <Card className="rounded-2xl border-border/80 shadow-sm">
              <CardContent className="space-y-2 p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {draft.nome || "Novo indicador"}
                </h3>
                <div className="flex flex-wrap gap-1">
                  <Badge
                    variant="outline"
                    className="rounded-md border-brand/20 bg-brand-soft text-[10px] text-brand"
                  >
                    {objetivoNome ?? "Objetivo pendente"}
                  </Badge>
                  <Badge variant="outline" className="rounded-md text-[10px] text-muted-foreground">
                    {draft.processo}
                  </Badge>
                </div>
                <div className="flex items-end gap-6 border-t border-border/60 pt-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Meta</p>
                    <p className="text-base font-semibold">
                      {draft.meta}
                      {draft.unidade}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Resultado</p>
                    <p className="text-xl font-bold text-muted-foreground">—</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">{draft.frequencia}</p>
              </CardContent>
            </Card>
          </aside>
        </div>

        <DialogFooter>
          {step > 0 && (
            <Button variant="outline" className="rounded-lg" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
          )}
          {step < 2 ? (
            podeAvancar ? (
              <Button
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
                onClick={() => setStep((s) => s + 1)}
              >
                Avançar <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button disabled className="rounded-lg">
                      Avançar <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Todo indicador precisa estar vinculado a um objetivo da qualidade
                </TooltipContent>
              </Tooltip>
            )
          ) : (
            <Button
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
              onClick={salvar}
              disabled={createIndicador.isPending}
            >
              <Check className="mr-1.5 h-4 w-4" /> Criar indicador
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
