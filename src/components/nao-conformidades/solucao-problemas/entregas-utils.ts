/** Rascunho de entrega antes do plano existir (prazo como yyyy-MM-dd). */
export interface EntregaRascunho {
  oque: string;
  responsavelId: string;
  prazo: string;
}

export const entregaVazia = (): EntregaRascunho => ({ oque: "", responsavelId: "", prazo: "" });

export function entregaPreenchida(e: EntregaRascunho) {
  return Boolean(e.oque.trim() && e.responsavelId && e.prazo);
}

export function entregaEmBranco(e: EntregaRascunho) {
  return !e.oque.trim() && !e.responsavelId && !e.prazo;
}

export function prazoParaData(prazo: string) {
  return new Date(`${prazo}T12:00:00`);
}
