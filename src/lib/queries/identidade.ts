import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { assertNotReadOnly } from "@/lib/org-access-guard";

/* ============================================================
 * Apresentação da Empresa — primeira aba de Identidade Organizacional.
 *
 * Bloco 7, item 1: ao contrário de Política da Qualidade e Diretrizes
 * Estratégicas (compromissos formais da Direção, com histórico de versão
 * numerada), a Apresentação não é exigida pela norma — é só identidade.
 * Ciclo simplificado: escreve, formaliza (sem rótulo), e depois disso edita
 * direto no lugar — nunca cria linha nova. Por isso não existe mais
 * "nova versão" nem histórico aqui.
 * ============================================================ */

export interface CompanyPresentation {
  id: string;
  status: "rascunho" | "formalizada";
  content: string;
  formalizedAt: string | null;
  formalizedByName: string | null;
}

export interface CompanyPresentationWithMeta {
  presentation: CompanyPresentation;
  isDraft: boolean;
}

const companyPresentationKeys = {
  all: ["company-presentation"] as const,
  current: () => [...companyPresentationKeys.all, "current"] as const,
};

const COMPANY_PRESENTATION_SELECT =
  "id, status, content, formalized_at, formalized_by_profile:profiles!formalized_by(full_name)";

interface CompanyPresentationRow {
  id: string;
  status: "rascunho" | "formalizada";
  content: string | null;
  formalized_at: string | null;
  formalized_by_profile: { full_name: string } | null;
}

function mapPresentation(row: CompanyPresentationRow): CompanyPresentation {
  return {
    id: row.id,
    status: row.status,
    content: row.content ?? "",
    formalizedAt: row.formalized_at,
    formalizedByName: row.formalized_by_profile?.full_name ?? null,
  };
}

export function useCompanyPresentationCurrent() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: companyPresentationKeys.current(),
    queryFn: async (): Promise<CompanyPresentationWithMeta | null> => {
      const { data: draft, error: draftErr } = await supabase
        .from("company_presentation")
        .select(COMPANY_PRESENTATION_SELECT)
        .eq("status", "rascunho")
        .maybeSingle();
      if (draftErr) throw draftErr;

      let row = draft as unknown as CompanyPresentationRow | null;
      let isDraft = true;

      if (!row) {
        const { data: lastFormalized, error: lastErr } = await supabase
          .from("company_presentation")
          .select(COMPANY_PRESENTATION_SELECT)
          .eq("status", "formalizada")
          .order("formalized_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastErr) throw lastErr;
        row = lastFormalized as unknown as CompanyPresentationRow | null;
        isDraft = false;
      }

      if (!row) return null;
      return { presentation: mapPresentation(row), isDraft };
    },
  });
}

export function useStartFirstCompanyPresentationDraft() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      assertNotReadOnly();
      const { error } = await supabase.from("company_presentation").insert({});
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyPresentationKeys.all }),
  });
}

export function useFormalizeCompanyPresentation() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("formalize_company_presentation", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyPresentationKeys.all }),
  });
}

export function useUpdateCompanyPresentationContent() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      assertNotReadOnly();
      const { error } = await supabase
        .from("company_presentation")
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyPresentationKeys.current() }),
  });
}
