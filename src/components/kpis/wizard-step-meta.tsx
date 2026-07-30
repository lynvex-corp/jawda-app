import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Polaridade } from "@/lib/kpi-data";
import { Field, type Draft } from "./wizard-shared";

/** Passo 3 do wizard de indicador — meta, polaridade e o gatilho de NC.
 * Extraído de wizard-dialog.tsx pra manter os arquivos abaixo de ~500 linhas. */
export function PassoMetaPolaridade({
  draft,
  set,
}: {
  draft: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Meta (${draft.unidade})`}>
          <Input
            type="number"
            value={draft.meta}
            onChange={(e) => set("meta", Number(e.target.value))}
            className="rounded-lg text-sm"
          />
        </Field>
        <Field label="Tolerância para amarelo (%)">
          <Input
            type="number"
            value={draft.toleranciaPct}
            onChange={(e) => set("toleranciaPct", Number(e.target.value))}
            className="rounded-lg text-sm"
          />
        </Field>
      </div>
      <Field label="Polaridade">
        <RadioGroup
          value={draft.polaridade}
          onValueChange={(v) => set("polaridade", v as Polaridade)}
          className="space-y-2"
        >
          {(
            [
              ["maior_melhor", "Maior é melhor"],
              ["menor_melhor", "Menor é melhor"],
              ["faixa_ideal", "Faixa ideal"],
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
      {draft.polaridade === "faixa_ideal" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mínimo">
            <Input
              type="number"
              value={draft.faixaMin}
              onChange={(e) => set("faixaMin", Number(e.target.value))}
              className="rounded-lg text-sm"
            />
          </Field>
          <Field label="Máximo">
            <Input
              type="number"
              value={draft.faixaMax}
              onChange={(e) => set("faixaMax", Number(e.target.value))}
              className="rounded-lg text-sm"
            />
          </Field>
        </div>
      )}
      <div className="rounded-xl border border-border/70 p-3">
        <p className="text-xs font-medium text-foreground">
          Ciclos consecutivos fora antes de sugerir NC
        </p>
        <p className="mb-2 text-[10px] text-muted-foreground">
          A NC nasce com origem "ID — Indicador".
        </p>
        <Input
          type="number"
          value={draft.ciclosParaDisparo}
          onChange={(e) => set("ciclosParaDisparo", Number(e.target.value))}
          className="w-28 rounded-lg text-sm"
        />
      </div>
    </>
  );
}
