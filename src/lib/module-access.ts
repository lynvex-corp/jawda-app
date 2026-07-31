import type { ContractModule } from "@/lib/queries/contract";

/** Mapa rota → módulo do contrato. Cobre navTop/navGroups inteiro
 * (mock-data.ts) — não só os 4 módulos reais da Gestão da Qualidade — para
 * a sidebar aplicar o cadeado de forma consistente em qualquer item, mesmo
 * os que ainda são só protótipo visual (seção 9: "fica de fora da v1").
 * Itens de Estratégia (exceto Riscos, que já tem enum próprio) e de Pessoas
 * não têm módulo individual em contract_modules — caem no enum coletivo do
 * grupo ('strategy'/'people'). */
export const ROUTE_MODULE: Record<string, ContractModule> = {
  "/nao-conformidades": "non_conformity",
  "/planos-de-acao": "action_plan",
  "/auditorias": "audit",
  "/indicadores": "indicators",
  "/analise-cenario": "strategy",
  "/partes-interessadas": "strategy",
  "/escopo-sistema": "strategy",
  "/riscos": "risks",
  "/mudancas-sg": "strategy",
  "/processos": "processes",
  "/documentos": "documents",
  "/aquisicao": "acquisition",
  "/producao": "production",
  "/comunicacoes": "communications",
  "/cargos": "people",
  "/aprendizagem": "people",
  "/avaliacao-performance": "people",
};

export function moduleForRoute(to: string): ContractModule | null {
  return ROUTE_MODULE[to] ?? null;
}
