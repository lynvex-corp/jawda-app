import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type ContractModule =
  | "non_conformity"
  | "action_plan"
  | "audit"
  | "indicators"
  | "documents"
  | "risks"
  | "strategy"
  | "processes"
  | "people"
  | "acquisition"
  | "production"
  | "communications";

interface ContractRow {
  id: string;
}

interface ContractModuleRow {
  module: ContractModule;
  enabled: boolean;
}

/** Módulos habilitados no contrato ATIVO da própria organização — "o
 * contrato manda no acesso" (seção 4/7 do Guia de Arquitetura). RLS de
 * `contracts`/`contract_modules` já restringe a leitura à própria org
 * (política *_select_own_org, ABA 8); aqui só traduz pro Set que a sidebar
 * usa pra decidir cadeado.
 *
 * `undefined` enquanto carrega (nunca mostra cadeado piscando durante o
 * loading inicial — só depois que a resposta real chegar). Se a org não
 * tiver nenhum contrato ativo (não deveria acontecer com empresa
 * provisionada pelo Admin, mas é estado possível), o conjunto vem vazio e
 * TUDO aparece bloqueado — reflete a realidade: sem contrato, sem módulo. */
export function useEnabledModules() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["contract-modules"],
    queryFn: async (): Promise<Set<ContractModule>> => {
      const { data: contract, error: contractError } = await supabase
        .from("contracts")
        .select("id")
        .eq("status", "active")
        .maybeSingle();
      if (contractError) throw contractError;
      const contractRow = contract as unknown as ContractRow | null;
      if (!contractRow) return new Set();

      const { data, error } = await supabase
        .from("contract_modules")
        .select("module, enabled")
        .eq("contract_id", contractRow.id)
        .eq("enabled", true);
      if (error) throw error;
      return new Set((data as unknown as ContractModuleRow[]).map((m) => m.module));
    },
  });
}
