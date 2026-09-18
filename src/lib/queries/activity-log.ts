import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useSessionOrgId } from "@/lib/queries/contract";

/* ============================================================
 * "Últimas atualizações" da topbar (item 8, Bloco 6) — antes lia de um mock
 * semeado em memória (jawda-store), igual pra todo usuário e perdido no
 * refresh. Agora lê `activity_log` de verdade, mesma tabela que já alimenta
 * a trilha de NC/Plano de Ação/Auditoria/Indicador — só sem o filtro por
 * entity_code (é a visão GERAL da organização, não de um registro só). A
 * RLS de `activity_log` (org_id = jwt) já garante isolamento; não há filtro
 * de papel aqui porque toda ação da organização é visível a todo mundo que
 * está dentro dela (mesmo padrão da trilha por entidade).
 * ============================================================ */

const LIMITE_ATIVIDADES = 40;

interface ActivityLogRow {
  id: string;
  action: string;
  actor_type: "user" | "ai" | "system" | "internal_staff";
  entity_type: string;
  entity_code: string | null;
  created_at: string;
  actor: { full_name: string } | null;
}

export interface AtividadeRecente {
  id: string;
  acao: string;
  alvo: string | null;
  autorNome: string;
  autorTipo: ActivityLogRow["actor_type"];
  data: string;
}

/** Rótulos conhecidos (levantados nas triggers já escritas) — qualquer
 * `action` fora deste mapa cai no fallback humanizado (underscore -> espaço,
 * primeira letra maiúscula), então uma trigger nova em módulo futuro nunca
 * quebra a tela, só aparece com um texto genérico até alguém curar aqui. */
const ACTION_LABEL: Record<string, string> = {
  criou: "criou",
  atualizou: "atualizou",
  arquivou: "arquivou",
  cancelou: "cancelou",
  meta_alterada: "alterou a meta de",
  lancou_medicao: "lançou medição em",
  nc_gerada: "gerou NC a partir de",
  cliente_respondeu_ticket: "respondeu o chamado",
  staff_respondeu_ticket: "respondeu o chamado",
};

function humanizarAcao(action: string): string {
  return ACTION_LABEL[action] ?? action.replaceAll("_", " ").replace(/^./, (c) => c.toLowerCase());
}

const ENTITY_TYPE_LABEL: Record<string, string> = {
  nc: "não conformidade",
  action_plan: "plano de ação",
  audit: "auditoria",
  indicator: "indicador",
};

export function useAtividadesRecentes() {
  const supabase = getSupabaseBrowserClient();
  const orgId = useSessionOrgId();

  return useQuery({
    queryKey: ["activity-log", "recentes", orgId ?? null],
    enabled: orgId !== undefined,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AtividadeRecente[]> => {
      const { data, error } = await supabase
        .from("activity_log")
        .select(
          "id, action, actor_type, entity_type, entity_code, created_at, actor:profiles!actor_id(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(LIMITE_ATIVIDADES);
      if (error) throw error;

      return (data as unknown as ActivityLogRow[]).map((row) => ({
        id: row.id,
        acao: humanizarAcao(row.action),
        alvo: row.entity_code ?? ENTITY_TYPE_LABEL[row.entity_type] ?? null,
        autorNome: row.actor?.full_name ?? "—",
        autorTipo: row.actor_type,
        data: row.created_at,
      }));
    },
  });
}
