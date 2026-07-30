import { Label } from "@/components/ui/label";
import type { FonteDados, Polaridade } from "@/lib/kpi-data";

/** Estado do wizard de novo indicador — compartilhado entre wizard-dialog.tsx
 * e wizard-step-meta.tsx (evita import circular entre os dois). */
export type Draft = {
  nome: string;
  descricao: string;
  objetivoId: string;
  processo: string;
  responsavelMedicaoId: string;
  responsavelAnaliseId: string;
  formula: string;
  unidade: string;
  fonte: FonteDados;
  derivadoDe: string;
  frequencia: string;
  meta: number;
  faixaMin: number;
  faixaMax: number;
  polaridade: Polaridade;
  toleranciaPct: number;
  ciclosParaDisparo: number;
};

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
