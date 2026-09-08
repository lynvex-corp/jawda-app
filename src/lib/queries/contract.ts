import { useEffect, useState } from "react";
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

/** Lê o claim `org_id` do próprio access token — a MESMA fonte que as
 * políticas de RLS usam (`auth.jwt() ->> 'org_id'`, ver
 * 20260729120100_foundation_rls.sql). Só o claim é confiável para dizer
 * "de qual empresa é esta sessão": o hook custom_access_token_hook o
 * reemite a cada login/refresh e `set_active_org()` + refreshSession() o
 * trocam quando o usuário alterna de empresa. */
function orgIdFromAccessToken(accessToken: string | undefined | null): string | null {
  if (!accessToken) return null;
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { org_id?: string };
    return claims.org_id ?? null;
  } catch {
    return null;
  }
}

/** `undefined` = ainda resolvendo a sessão; `null` = sessão sem claim
 * `org_id` (usuário sem empresa ativa — nada a liberar). */
export function useSessionOrgId(): string | null | undefined {
  const supabase = getSupabaseBrowserClient();
  const [orgId, setOrgId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: { access_token?: string } | null } }) => {
        if (active) setOrgId(orgIdFromAccessToken(data.session?.access_token));
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: { access_token?: string } | null) => {
        setOrgId(orgIdFromAccessToken(session?.access_token));
      },
    );
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return orgId;
}

/** Módulos habilitados no contrato ATIVO da própria organização — "o
 * contrato manda no acesso" (seção 4/7 do Guia de Arquitetura).
 *
 * O filtro `.eq("org_id", ...)` é OBRIGATÓRIO e não é redundante com a RLS.
 * `contracts` tem DUAS políticas de SELECT (20260730180200_admin_rls.sql):
 * `contracts_select_own_org` (a própria empresa) e `contracts_select_staff`
 * (tudo, para internal_staff). Como políticas de RLS são somadas com OR, um
 * usuário que é dono de uma empresa cliente E também internal_staff enxerga
 * o contrato de TODAS as empresas. Sem o filtro por org, `.maybeSingle()`
 * recebia N linhas, devolvia erro, `data` ficava `undefined` — e tanto o
 * ModuleGate quanto a sidebar tratam `undefined` como "ainda carregando" e
 * liberam tudo. Efeito prático: para essa empresa NENHUM módulo desligado
 * no Admin fazia efeito, enquanto para uma empresa cujo dono não é staff
 * funcionava normalmente. O escopo por empresa é individual e vem daqui.
 *
 * `undefined` enquanto carrega (nunca mostra cadeado piscando durante o
 * loading inicial — só depois que a resposta real chegar). Se a org não
 * tiver nenhum contrato ativo, o conjunto vem vazio e TUDO aparece
 * bloqueado — reflete a realidade: sem contrato, sem módulo. */
export function useEnabledModules() {
  const supabase = getSupabaseBrowserClient();
  const orgId = useSessionOrgId();

  return useQuery({
    // orgId na chave: trocar de empresa (set_active_org + refreshSession)
    // reemite o JWT com outro org_id e precisa refazer a leitura, nunca
    // reaproveitar o cache do contrato da empresa anterior.
    queryKey: ["contract-modules", orgId ?? null],
    enabled: orgId !== undefined,
    queryFn: async (): Promise<Set<ContractModule>> => {
      if (!orgId) return new Set();

      const { data: contract, error: contractError } = await supabase
        .from("contracts")
        .select("id")
        .eq("org_id", orgId)
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
