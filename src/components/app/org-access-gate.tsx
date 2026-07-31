import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useOrgAccessLevel } from "@/lib/queries/org-access";
import { DelinquencyBanner } from "./delinquency-banner";
import { BlockedScreen } from "./blocked-screen";

/** Gancho crítico da escada de inadimplência no painel do cliente (seção 7
 * do Guia). Fica no __root.tsx, acima de <Outlet/>, porque cada página
 * monta seu próprio AppShell (não existe layout único abaixo da raiz) —
 * o único jeito de "substituir a árvore de rotas inteira" no nível
 * 'bloqueado' é aqui, antes de qualquer rota renderizar.
 *
 * /login fica de fora: sem sessão não há org_id no JWT, a query nem faria
 * sentido (e falharia por falta de GRANT a anon). */
export function OrgAccessGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isLoginRoute = pathname === "/login";
  const { data: level } = useOrgAccessLevel(!isLoginRoute);

  if (isLoginRoute) return <>{children}</>;

  if (level === "blocked" || level === "terminated") {
    return <BlockedScreen />;
  }

  return (
    <>
      {level && <DelinquencyBanner level={level} />}
      {children}
    </>
  );
}
