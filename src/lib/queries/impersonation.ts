import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export interface ActiveImpersonationSession {
  id: string;
  staffFullName: string;
  orgId: string;
  expiresAt: string;
}

interface ImpersonationSessionRow {
  id: string;
  staff_full_name: string;
  org_id: string;
  expires_at: string;
}

/** Sessão de impersonação ativa do usuário logado (se houver). RLS de
 * impersonation_sessions permite ao próprio target_user_id ler as próprias
 * linhas — não precisa saber o id da sessão de antemão (não veio na URL de
 * verificação do magic-link), só consulta "a minha sessão ainda aberta".
 * Poll curto: a faixa precisa sumir logo depois do TTL expirar ou de
 * end_impersonation_session rodar em outra aba/pelo staff. */
export function useActiveImpersonationSession() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["active-impersonation-session"],
    queryFn: async (): Promise<ActiveImpersonationSession | null> => {
      const { data, error } = await supabase
        .from("impersonation_sessions")
        .select("id, staff_full_name, org_id, expires_at")
        .is("ended_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const row = data as unknown as ImpersonationSessionRow | null;
      if (!row) return null;
      return {
        id: row.id,
        staffFullName: row.staff_full_name,
        orgId: row.org_id,
        expiresAt: row.expires_at,
      };
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useEndImpersonationSession() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc("end_impersonation_session", {
        p_session_id: sessionId,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["active-impersonation-session"] }),
  });
}
