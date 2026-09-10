import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  redirect,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "sonner";
import { JawdaProvider } from "../lib/jawda-store";
import { getAuthState } from "../lib/supabase-server";
import { OrgAccessGate } from "../components/app/org-access-gate";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado do nosso lado. Tente recarregar ou voltar ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#2183b4" },
      { title: "Jawda / Sistema de Gestão" },
      {
        name: "description",
        content:
          "Jawda / Sistema de Gestão: plataforma SaaS B2B para não conformidades, auditorias, riscos e indicadores da qualidade (ISO 9001).",
      },
      { name: "author", content: "Jawda" },
      { name: "application-name", content: "Jawda / Sistema de Gestão" },
      { name: "apple-mobile-web-app-title", content: "Jawda" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { property: "og:title", content: "Jawda / Sistema de Gestão" },
      {
        property: "og:description",
        content:
          "Jawda / Sistema de Gestão: plataforma SaaS B2B para não conformidades, auditorias, riscos e indicadores da qualidade (ISO 9001).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Jawda / Sistema de Gestão" },
      {
        name: "twitter:description",
        content:
          "Jawda / Sistema de Gestão: plataforma SaaS B2B para não conformidades, auditorias, riscos e indicadores da qualidade (ISO 9001).",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a650a87d-e380-41ac-a38c-24dd5c537b09/id-preview-2cb0a50b--ea696609-cdc5-42ee-8ca4-50002a796220.lovable.app-1784171387099.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a650a87d-e380-41ac-a38c-24dd5c537b09/id-preview-2cb0a50b--ea696609-cdc5-42ee-8ca4-50002a796220.lovable.app-1784171387099.png",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const authState = await getAuthState();
    const isLoginRoute = location.pathname === "/login";
    // /impersonar troca o magic-link do staff por sessão real do usuário-alvo
    // no próprio navegador — precisa rodar sem sessão prévia, igual /login.
    const isImpersonarRoute = location.pathname === "/impersonar";
    const isResetPasswordRoute = location.pathname === "/redefinir-senha";
    // Convite de dono de empresa (ABA 8): sessão sem senha e sem 2FA, nunca
    // chega a aal2 pelo /login normal — ver needsFirstAccess em getAuthState.
    const isFirstAccessRoute = location.pathname === "/primeiro-acesso";

    if (!authState.authenticated) {
      if (authState.needsFirstAccess) {
        if (!isFirstAccessRoute) throw redirect({ to: "/primeiro-acesso" });
        return { authState };
      }
      // Sem convite pendente, /primeiro-acesso não tem sessão pra completar.
      if (isFirstAccessRoute || (!isLoginRoute && !isImpersonarRoute)) {
        throw redirect({ to: "/login" });
      }
      return { authState };
    }

    if (isLoginRoute || isFirstAccessRoute) {
      throw redirect({ to: "/" });
    }

    // Item 1 da ABA 11: must_reset_password=true força a troca de senha
    // antes de qualquer outra rota, sem exceção — mesmo digitando a URL
    // direto (por isso a checagem fica aqui, no beforeLoad server-side, não
    // num gate client-side que só monta depois da rota já ter carregado).
    if (!isImpersonarRoute) {
      if (authState.mustResetPassword && !isResetPasswordRoute) {
        throw redirect({ to: "/redefinir-senha" });
      }
      if (!authState.mustResetPassword && isResetPasswordRoute) {
        throw redirect({ to: "/" });
      }
    }

    return { authState };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <JawdaProvider>
        <OrgAccessGate>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </OrgAccessGate>
        <Toaster richColors position="top-right" />
      </JawdaProvider>
    </QueryClientProvider>
  );
}
