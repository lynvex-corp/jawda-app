import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type ReconhecimentoPeriodo = "mes" | "trimestre" | "ano";

export const RECONHECIMENTO_PERIODO_OPTIONS: { value: ReconhecimentoPeriodo; label: string }[] = [
  { value: "mes", label: "Este mês" },
  { value: "trimestre", label: "Este trimestre" },
  { value: "ano", label: "Este ano" },
];

function periodoStart(p: ReconhecimentoPeriodo): Date {
  const now = new Date();
  if (p === "mes") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === "trimestre") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  return new Date(now.getFullYear(), 0, 1);
}

export interface RankingEntry {
  userId: string;
  fullName: string;
  count: number;
}

/** Agrega linhas cruas (uma por registro) em contagem por autor — não dá
 * pra fazer GROUP BY direto no PostgREST, então soma no cliente (mesmo
 * padrão já usado no join em memória de Fornecedores). */
function aggregateByCreator(
  rows: { created_by: string; author: { full_name: string } | null }[],
): RankingEntry[] {
  const byUser = new Map<string, RankingEntry>();
  for (const r of rows) {
    const existing = byUser.get(r.created_by);
    if (existing) {
      existing.count += 1;
    } else {
      byUser.set(r.created_by, {
        userId: r.created_by,
        fullName: r.author?.full_name ?? "Usuário",
        count: 1,
      });
    }
  }
  return [...byUser.values()].sort((a, b) => b.count - a.count).slice(0, 5);
}

/** Ranking "Quem mais identifica Não Conformidades" — query direta em
 * ncs.created_by, sem tabela própria (seção "CÁLCULO NA UI" do prompt). */
export function useNCIdentificationRanking(periodo: ReconhecimentoPeriodo) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["recognition-nc-ranking", periodo],
    queryFn: async (): Promise<RankingEntry[]> => {
      const { data, error } = await supabase
        .from("ncs")
        .select("created_by, author:profiles!created_by(full_name)")
        .gte("created_at", periodoStart(periodo).toISOString());
      if (error) throw error;
      return aggregateByCreator(
        data as unknown as { created_by: string; author: { full_name: string } | null }[],
      );
    },
  });
}

/** Ranking "Quem mais registra melhoria de processo" — changes_improvements
 * onde tipo='melhoria', sem tabela própria. */
export function useMelhoriaRanking(periodo: ReconhecimentoPeriodo) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["recognition-melhoria-ranking", periodo],
    queryFn: async (): Promise<RankingEntry[]> => {
      const { data, error } = await supabase
        .from("changes_improvements")
        .select("created_by, author:profiles!created_by(full_name)")
        .eq("tipo", "melhoria")
        .gte("created_at", periodoStart(periodo).toISOString());
      if (error) throw error;
      return aggregateByCreator(
        data as unknown as { created_by: string; author: { full_name: string } | null }[],
      );
    },
  });
}

export type BadgeType = "sem_nc_critica" | "zero_planos_vencidos" | "treinamentos_no_prazo";

export interface BadgeStatus {
  badgeType: BadgeType;
  unitId: string | null;
  unitName: string | null;
  streakDays: number;
  recentBreak: { brokenAt: string; streakDaysAtBreak: number } | null;
}

interface BadgeEventRow {
  badge_type: BadgeType;
  unit_id: string | null;
  event: "iniciado" | "quebrado";
  event_date: string;
  streak_days_at_break: number | null;
  unit: { name: string } | null;
}

/** Selos ativos por badge_type/unidade — streak = now() - event_date do
 * último 'iniciado'. Se o 'quebrado' imediatamente anterior a esse
 * 'iniciado' aconteceu há menos de 48h, mostra a mensagem de transição
 * (seção "CÁLCULO NA UI" do prompt). */
export function useActiveBadges() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["recognition-badges"],
    queryFn: async (): Promise<BadgeStatus[]> => {
      const { data, error } = await supabase
        .from("recognition_badge_events")
        .select("badge_type, unit_id, event, event_date, streak_days_at_break, unit:units(name)")
        .order("event_date", { ascending: false });
      if (error) throw error;

      const rows = data as unknown as BadgeEventRow[];
      const byKey = new Map<string, BadgeEventRow[]>();
      for (const r of rows) {
        const key = `${r.badge_type}:${r.unit_id ?? "org"}`;
        const list = byKey.get(key) ?? [];
        list.push(r);
        byKey.set(key, list);
      }

      const now = Date.now();
      const result: BadgeStatus[] = [];
      for (const events of byKey.values()) {
        const idx = events.findIndex((e) => e.event === "iniciado");
        if (idx === -1) continue;
        const lastIniciado = events[idx];
        const streakDays = Math.floor(
          (now - new Date(lastIniciado.event_date).getTime()) / 86400000,
        );

        const maybeBreak = events[idx + 1];
        const recentBreak =
          maybeBreak?.event === "quebrado" &&
          now - new Date(maybeBreak.event_date).getTime() < 48 * 3600 * 1000
            ? {
                brokenAt: maybeBreak.event_date,
                streakDaysAtBreak: maybeBreak.streak_days_at_break ?? 0,
              }
            : null;

        result.push({
          badgeType: lastIniciado.badge_type,
          unitId: lastIniciado.unit_id,
          unitName: lastIniciado.unit?.name ?? null,
          streakDays,
          recentBreak,
        });
      }
      return result;
    },
  });
}
