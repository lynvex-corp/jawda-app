import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* ============================================================
 * Teste dos 5 Porquês — componente controlado e compartilhado.
 *
 * Extraído de nao-conformidades/nova-wizard.tsx sem mudança de
 * comportamento, para ser reaproveitado pela Solução de Problemas (A3).
 * Quem usa decide o que fazer com os valores (a NC grava em ncs.five_whys;
 * a Solução de Problemas, em problem_solutions.five_whys) e o que acontece
 * ao preencher o 5º porquê (consolidar a causa raiz) via onChange.
 * ============================================================ */

interface CincoPorquesProps {
  /** Sempre 5 posições. */
  valores: string[];
  /** Texto do problema — vira a pergunta do 1º porquê. */
  problema: string;
  onChange: (indice: number, valor: string) => void;
}

export function CincoPorques({ valores, problema, onChange }: CincoPorquesProps) {
  const habilitado = (i: number) => i === 0 || valores[i - 1].trim().length > 0;

  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
      <div className="space-y-4">
        {valores.map((val, i) => {
          const enabled = habilitado(i);
          const filled = val.trim().length > 0;
          const anterior = i === 0 ? problema.trim() : valores[i - 1].trim();
          return (
            <div key={i} className="relative">
              <div
                className={cn(
                  "absolute -left-8 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold",
                  filled
                    ? "border-brand bg-brand text-brand-foreground"
                    : enabled
                      ? "border-brand bg-background text-brand"
                      : "border-border bg-muted text-muted-foreground",
                )}
              >
                {filled ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <div className="space-y-1">
                <Label className={cn(!enabled && "text-muted-foreground")}>
                  {`${i + 1}º Por quê`}
                </Label>
                <p className="text-xs italic text-muted-foreground">
                  {anterior
                    ? `Por que ${anterior.replace(/\.$/, "")}?`
                    : "Preencha a etapa anterior para encadear a pergunta."}
                </p>
                <Textarea
                  rows={2}
                  disabled={!enabled}
                  value={val}
                  onChange={(e) => onChange(i, e.target.value)}
                  placeholder={
                    enabled ? "Descreva por quê…" : "Preencha o passo anterior para liberar"
                  }
                  className="rounded-lg"
                />
                {i === 4 && filled && (
                  <p className="text-[11px] font-medium text-brand">
                    Esta resposta foi consolidada como Causa Raiz.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
