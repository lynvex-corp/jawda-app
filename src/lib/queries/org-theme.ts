import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useSessionOrgId } from "@/lib/queries/contract";

/* ============================================================
 * Tema dinâmico por organização (itens 10/11/12, Bloco 6) — "o sistema se
 * pinta sozinho no carregamento" (seção 5 do Guia), que até aqui nunca
 * tinha sido implementado: organizations.logo_url/brand_color existiam
 * desde a fundação mas nunca eram lidos, e o formulário de Identidade era
 * inteiramente mock.
 * ============================================================ */

export const LOGOS_BUCKET = "logos-empresas";

export interface OrgTheme {
  tradeName: string | null;
  legalName: string;
  logoUrl: string | null;
  brandColor: string | null;
  accentColor: string | null;
  textColor: string | null;
  sidebarColor: string | null;
  contentBgColor: string | null;
}

interface OrgThemeRow {
  trade_name: string | null;
  legal_name: string;
  logo_url: string | null;
  brand_color: string | null;
  accent_color: string | null;
  text_color: string | null;
  sidebar_color: string | null;
  content_bg_color: string | null;
}

const themeKeys = {
  all: ["org-theme"] as const,
  current: (orgId: string | null) => [...themeKeys.all, orgId] as const,
};

function mapTheme(r: OrgThemeRow): OrgTheme {
  return {
    tradeName: r.trade_name,
    legalName: r.legal_name,
    logoUrl: r.logo_url,
    brandColor: r.brand_color,
    accentColor: r.accent_color,
    textColor: r.text_color,
    sidebarColor: r.sidebar_color,
    contentBgColor: r.content_bg_color,
  };
}

export function useOrgTheme() {
  const supabase = getSupabaseBrowserClient();
  const orgId = useSessionOrgId();

  return useQuery({
    queryKey: themeKeys.current(orgId ?? null),
    enabled: orgId !== undefined,
    queryFn: async (): Promise<OrgTheme | null> => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select(
          "trade_name, legal_name, logo_url, brand_color, accent_color, text_color, sidebar_color, content_bg_color",
        )
        .eq("id", orgId)
        .single();
      if (error) throw error;
      return mapTheme(data as unknown as OrgThemeRow);
    },
  });
}

export function useSaveOrgTheme() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  const orgId = useSessionOrgId();

  return useMutation({
    mutationFn: async (input: {
      tradeName: string;
      legalName: string;
      brandColor: string;
      accentColor: string;
      textColor: string;
      sidebarColor: string;
      contentBgColor: string;
    }) => {
      if (!orgId) throw new Error("Organização não identificada");
      const { error } = await supabase
        .from("organizations")
        .update({
          trade_name: input.tradeName || null,
          legal_name: input.legalName,
          brand_color: input.brandColor,
          accent_color: input.accentColor,
          text_color: input.textColor,
          sidebar_color: input.sidebarColor,
          content_bg_color: input.contentBgColor,
        })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: themeKeys.current(orgId ?? null) });
    },
  });
}

export function useUploadLogo() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  const orgId = useSessionOrgId();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!orgId) throw new Error("Organização não identificada");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${orgId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(LOGOS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from(LOGOS_BUCKET).getPublicUrl(path);
      // Cache-bust: mesmo caminho a cada troca de logo (upsert), sem isso o
      // navegador continuaria servindo a imagem antiga do cache até um
      // hard-refresh.
      const urlComVersao = `${publicUrl}?v=${Date.now()}`;

      const { error } = await supabase
        .from("organizations")
        .update({ logo_url: urlComVersao })
        .eq("id", orgId);
      if (error) throw error;
      return urlComVersao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: themeKeys.current(orgId ?? null) });
    },
  });
}

/* ============================================================
 * Provider — injeta as cores da organização como CSS custom properties em
 * :root, por cima dos valores fixos de styles.css. Fica perto do
 * ThemeToggle (mesmo nível do root layout) porque precisa rodar cedo, antes
 * do usuário perceber qualquer "flash" da paleta padrão — mesmo raciocínio
 * do script inline de light/dark em __root.tsx.
 * ============================================================ */

/** Luminância relativa (WCAG) simplificada — decide branco ou quase-preto
 * como texto de contraste automático para superfícies que NÃO têm campo de
 * cor de texto próprio no formulário (sidebar, brand). Cor de texto do
 * conteúdo principal continua sendo a escolha explícita do usuário
 * (--foreground), não este cálculo. */
function corDeContraste(hex: string): string {
  const limpo = hex.replace("#", "");
  if (limpo.length !== 6) return "oklch(1 0 0)";
  const r = parseInt(limpo.slice(0, 2), 16) / 255;
  const g = parseInt(limpo.slice(2, 4), 16) / 255;
  const b = parseInt(limpo.slice(4, 6), 16) / 255;
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminancia > 0.6 ? "oklch(0.18 0.01 260)" : "oklch(1 0 0)";
}

function aplicarVar(nome: string, valor: string | null | undefined) {
  if (!valor) {
    document.documentElement.style.removeProperty(nome);
    return;
  }
  document.documentElement.style.setProperty(nome, valor);
}

export function useApplyOrgTheme() {
  const { data: theme } = useOrgTheme();

  useEffect(() => {
    if (!theme) return;
    aplicarVar("--brand", theme.brandColor);
    if (theme.brandColor) aplicarVar("--brand-foreground", corDeContraste(theme.brandColor));
    aplicarVar("--brand-soft", theme.accentColor);
    aplicarVar("--foreground", theme.textColor);
    aplicarVar("--card-foreground", theme.textColor);
    aplicarVar("--popover-foreground", theme.textColor);
    aplicarVar("--sidebar", theme.sidebarColor);
    if (theme.sidebarColor) aplicarVar("--sidebar-foreground", corDeContraste(theme.sidebarColor));
    aplicarVar("--background", theme.contentBgColor);
    aplicarVar("--card", theme.contentBgColor);

    // Volta ao padrão do styles.css ao trocar de organização (ex.: staff
    // usando o seletor de empresas) — sem isso a paleta da org anterior
    // "vazaria" visualmente até o próximo valor não-nulo ser aplicado.
    return () => {
      for (const nome of [
        "--brand",
        "--brand-foreground",
        "--brand-soft",
        "--foreground",
        "--card-foreground",
        "--popover-foreground",
        "--sidebar",
        "--sidebar-foreground",
        "--background",
        "--card",
      ]) {
        document.documentElement.style.removeProperty(nome);
      }
    };
  }, [theme]);
}
