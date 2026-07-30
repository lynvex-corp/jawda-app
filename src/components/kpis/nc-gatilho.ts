import { toast } from "sonner";
import { ciclosFora, severidadeGatilho } from "@/lib/kpi-data";
import { useCreateNC, type CreateNCInput } from "@/lib/queries/ncs";
import type { Indicator } from "@/lib/queries/indicators";

/** Depois de salvar uma medição fora da meta, verifica se as últimas N
 * medições consecutivas (N = auto_nc_after_cycles) estão fora e, se sim,
 * sugere abrir NC — seção 10 do Guia de Arquitetura. `createNc` é a
 * mutation já instanciada no componente chamador (useCreateNC é hook —
 * precisa nascer no corpo do componente, nunca dentro de um callback).
 * Compartilhado entre LancarMedicaoDialog e LoteDialog. */
export function avisarGatilhoNc(
  indicador: Indicator,
  outOfTargetCronologico: boolean[],
  ultimoValor: number,
  createNc: ReturnType<typeof useCreateNC>,
) {
  const ciclos = ciclosFora(outOfTargetCronologico);
  if (ciclos < indicador.ciclosParaDisparo) return;

  const abrirNc = () => {
    const input: CreateNCInput = {
      origem: "Indicador",
      descricao: `Indicador ${indicador.nome} fora da meta há ${ciclos} ciclos. Último resultado: ${ultimoValor}${indicador.unidade}. Meta: ${indicador.meta}${indicador.unidade}.`,
      gravidade: severidadeGatilho(ultimoValor, indicador),
      indicatorId: indicador.id,
    };
    createNc.mutate(input, {
      onSuccess: (nc) =>
        toast.success("NC criada", { description: `${nc.codigo} · origem Indicador` }),
      onError: (err) => toast.error("Não foi possível criar a NC", { description: String(err) }),
    });
  };

  toast.warning(`Este indicador está fora da meta há ${ciclos} ciclos`, {
    description: `Sugerimos abrir uma NC com origem "ID — Indicador". Último resultado: ${ultimoValor}${indicador.unidade}. Meta: ${indicador.meta}${indicador.unidade}.`,
    action: { label: "Abrir NC", onClick: abrirNc },
  });
}
