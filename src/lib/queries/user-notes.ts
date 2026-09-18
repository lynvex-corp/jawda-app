import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useSessionOrgId } from "@/lib/queries/contract";

/* ============================================================
 * Anotações pessoais livres (item 3, Bloco 6) — "post-it" da Gestão à
 * Vista. Rascunho pessoal descartável (RLS restringe à própria linha do
 * usuário; delete físico permitido, sem motivo obrigatório — decisão
 * confirmada com o Matheus, foge da regra "nada é apagado" de propósito
 * porque não é registro de gestão).
 * ============================================================ */

const notesKeys = {
  all: ["user-notes"] as const,
  mine: (orgId: string | null) => [...notesKeys.all, orgId] as const,
};

interface UserNoteRow {
  id: string;
  content: string;
  updated_at: string;
}

export interface UserNote {
  id: string;
  content: string;
  updatedAt: string;
}

/** Nota do usuário logado na organização atual — uma só por pessoa/org (a
 * primeira vez que ele digita algo, criamos a linha; dali em diante é
 * sempre update). RLS já garante que só existe a PRÓPRIA linha visível. */
export function useMyNote() {
  const supabase = getSupabaseBrowserClient();
  const orgId = useSessionOrgId();

  return useQuery({
    queryKey: notesKeys.mine(orgId ?? null),
    enabled: orgId !== undefined,
    queryFn: async (): Promise<UserNote | null> => {
      const { data, error } = await supabase
        .from("user_notes")
        .select("id, content, updated_at")
        .maybeSingle();
      if (error) throw error;
      const row = data as unknown as UserNoteRow | null;
      return row ? { id: row.id, content: row.content, updatedAt: row.updated_at } : null;
    },
  });
}

/** Upsert por (org_id, user_id) — constraint única na tabela (migration
 * 20260918090000_user_notes.sql) garante uma nota só por pessoa/org, então
 * o client nunca precisa decidir "é insert ou update?" na mão (evita
 * duplicata em corrida de duas abas salvando ao mesmo tempo). */
export function useSaveMyNote() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  const orgId = useSessionOrgId();

  return useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const { data, error } = await supabase
        .from("user_notes")
        .upsert({ content, updated_at: new Date().toISOString() }, { onConflict: "org_id,user_id" })
        .select("id")
        .single();
      if (error) throw error;
      return (data as unknown as { id: string }).id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKeys.mine(orgId ?? null) });
    },
  });
}

/** Autosave com debounce — mesmo padrão já usado noutros projetos para
 * campo de texto livre sem botão "Salvar" explícito. */
export function useAutosaveNote(nota: UserNote | null | undefined) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"ocioso" | "salvando" | "salvo">("ocioso");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carregouRef = useRef(false);
  const salvar = useSaveMyNote();

  useEffect(() => {
    if (nota === undefined || carregouRef.current) return;
    carregouRef.current = true;
    setContent(nota?.content ?? "");
  }, [nota]);

  function mudar(texto: string) {
    setContent(texto);
    setStatus("salvando");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      salvar.mutate(
        { content: texto },
        {
          onSuccess: () => setStatus("salvo"),
          onError: () => setStatus("ocioso"),
        },
      );
    }, 700);
  }

  return { content, status, mudar };
}
