import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getCookies, setCookie } from "@tanstack/react-start/server";

// NUNCA importar SUPABASE_SERVICE_ROLE_KEY aqui. Este cliente roda com o
// token do usuário (via cookies) — o isolamento entre empresas continua
// sendo garantido pelo RLS, nunca por esta camada.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// createServerOnlyFn: __root.tsx (bundle de cliente) importa este módulo para
// chegar em getAuthState. Sem esse wrapper, o compilador do TanStack Start
// recusa o build (getCookies/setCookie vazariam para o bundle do navegador).
export const getSupabaseServerClient = createServerOnlyFn(() => {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        const cookies = getCookies();
        return Object.entries(cookies).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          setCookie(name, value, options as CookieOptions);
        });
      },
    },
  });
});

export type AuthState =
  | { authenticated: false }
  | { authenticated: true; userId: string; email: string | null };

// Usado pelo guard de rota em __root.tsx. Exige aal2 (2FA já verificado nesta
// sessão) — uma sessão que só passou por e-mail/senha (aal1) não conta como
// autenticada, porque o 2FA é obrigatório para todos (seção 8 do Guia de
// Arquitetura). Sem essa checagem, dar "voltar" no navegador durante o setup
// do TOTP bastaria para entrar sem completar o 2º fator.
export const getAuthState = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthState> => {
    const supabase = getSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return { authenticated: false };

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      userId: session.user.id,
      email: session.user.email ?? null,
    };
  },
);
