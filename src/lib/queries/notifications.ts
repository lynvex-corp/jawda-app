import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";

/* ============================================================
 * Notificações (Bloco 3, item 4).
 *
 * Até aqui o sino do topo lia de `useJawda()` — dados semeados em memória a
 * cada carregamento, iguais para todo usuário e perdidos no refresh. Não
 * havia tabela, nem destinatário, nem persistência de "lida".
 *
 * A RLS filtra por `user_id = auth.uid()`, não por organização: notificação
 * é pessoal, e nem o Administrador da empresa vê a dos outros. Por isso
 * nenhuma query aqui precisa (nem deve) filtrar nada na mão.
 * ============================================================ */

export interface Notification {
  id: string;
  title: string;
  description: string;
  tone: "info" | "success" | "warning" | "danger";
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
};

interface NotificationRow {
  id: string;
  title: string;
  description: string;
  tone: Notification["tone"];
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Teto de 50: o sino é chamada à ação, não arquivo histórico. */
const LIMITE = 50;

export function useNotifications() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: notificationKeys.list(),
    staleTime: 30_000,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, description, tone, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(LIMITE);
      if (error) throw error;
      return (data as unknown as NotificationRow[]).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        tone: r.tone,
        link: r.link,
        readAt: r.read_at,
        createdAt: r.created_at,
      }));
    },
  });
}

/** Marca como lidas as que ainda não foram. O `is("read_at", null)` evita
 * reescrever linha já lida a cada abertura do painel. */
export function useMarkNotificationsRead() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
