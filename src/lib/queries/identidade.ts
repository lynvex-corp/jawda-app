import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { assertNotReadOnly } from "@/lib/org-access-guard";

/* ============================================================
 * Apresentação da Empresa — primeira aba de Identidade Organizacional.
 *
 * Documento versionado (seção 21.5 do Guia), com exatamente o mesmo desenho
 * de quality_policy: um só rascunho aberto por organização, "Nova versão" e
 * "Formalizar" são RPCs, nunca UPDATE livre do cliente.
 *
 * A duplicação de forma em relação a documentos.ts é deliberada: são duas
 * entidades de negócio distintas, e generalizar as duas num "documento
 * versionado" abstrato acoplaria dois módulos que podem divergir (a Política
 * já exige Administrador para formalizar, a Apresentação não).
 * ============================================================ */

export interface CompanyPresentation {
  id: string;
  status: "rascunho" | "formalizada";
  versionLabel: string | null;
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
  history: () => [...companyPresentationKeys.all, "history"] as const,
};

const COMPANY_PRESENTATION_SELECT =
  "id, status, version_label, content, formalized_at, formalized_by_profile:profiles!formalized_by(full_name)";

interface CompanyPresentationRow {
  id: string;
  status: "rascunho" | "formalizada";
  version_label: string | null;
  content: string | null;
  formalized_at: string | null;
  formalized_by_profile: { full_name: string } | null;
}

function mapPresentation(row: CompanyPresentationRow): CompanyPresentation {
  return {
    id: row.id,
    status: row.status,
    versionLabel: row.version_label,
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

export function useCompanyPresentationHistory() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: companyPresentationKeys.history(),
    queryFn: async (): Promise<CompanyPresentation[]> => {
      const { data, error } = await supabase
        .from("company_presentation")
        .select(COMPANY_PRESENTATION_SELECT)
        .eq("status", "formalizada")
        .order("formalized_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as CompanyPresentationRow[]).map(mapPresentation);
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

export function useStartNewCompanyPresentationVersion() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("start_new_company_presentation_version");
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyPresentationKeys.all }),
  });
}

export function useFormalizeCompanyPresentation() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, versionLabel }: { id: string; versionLabel: string }) => {
      assertNotReadOnly();
      const { error } = await supabase.rpc("formalize_company_presentation", {
        p_id: id,
        p_version_label: versionLabel,
      });
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
