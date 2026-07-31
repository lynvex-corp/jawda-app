import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { setOrgAccessLevel, type OrgAccessLevel } from "@/lib/org-access-guard";

interface OrganizationStatusRow {
  id: string;
  status: OrgAccessLevel;
}

/** Lê organizations.status da própria org (RLS organizations_select_own já
 * restringe — não precisa filtrar por id). É o único sinal de inadimplência
 * visível ao cliente: delinquency_state é restrita a internal_staff (seção
 * 7 do Guia — financeiro é área do Admin, cliente só vê o efeito).
 *
 * Poll leve + refetch no foco: não há realtime pra esse sinal ainda, e o
 * efeito (banner/bloqueio) não precisa ser instantâneo — perceptível em até
 * 1 minuto ou ao voltar pra aba já é suficiente pro caso de uso. */
export function useOrgAccessLevel(enabled: boolean = true) {
  const supabase = getSupabaseBrowserClient();
  const query = useQuery({
    queryKey: ["org-access-level"],
    queryFn: async (): Promise<OrgAccessLevel> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, status")
        .maybeSingle();
      if (error) throw error;
      const row = data as unknown as OrganizationStatusRow | null;
      return row?.status ?? "active";
    },
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (query.data) setOrgAccessLevel(query.data);
  }, [query.data]);

  return query;
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exportação de dados da própria org — nunca passa pelo cadeado de
 * somente-leitura (export_organization_data no banco não checa nível de
 * inadimplência, de propósito). Disponível em qualquer degrau da escada,
 * inclusive 'bloqueado' (seção 7 do Guia: "cliente sempre pode exportar"). */
export function useExportOrganizationData() {
  const supabase = getSupabaseBrowserClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("export_organization_data");
      if (error) throw error;
      downloadJson(data, `jawda-exportacao-${new Date().toISOString().slice(0, 10)}.json`);
      return data;
    },
  });
}
