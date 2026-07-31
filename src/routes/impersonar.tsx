import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { JawdaLogo } from "@/components/brand/logo";

/** Destino do magic-link gerado pelo Painel Admin ("Acessar como cliente").
 * Troca o token_hash por uma sessão REAL do Supabase Auth do usuário-alvo,
 * neste navegador — mecanismo escolhido com o usuário (ver docs/GUIA de
 * decisão da aba de Usuários e Acessos): sessão real, não um JWT paralelo.
 * A faixa fixa e a trilha completa nascem de impersonation_sessions
 * (aberta pelo Admin ANTES deste link ser gerado) — este componente só
 * autentica.
 *
 * Depois do verifyOtp, também vincula a sessão REAL do GoTrue (session_id,
 * decodificado do próprio JWT recebido) à linha de impersonation_sessions
 * via attach_impersonation_session_token — é isso que permite à varredura
 * de TTL (close_expired_impersonation_sessions, pg_cron a cada 1min)
 * revogar exatamente ESSA sessão quando o TTL expira, em vez de só parar de
 * mostrar a faixa. Sem esse vínculo, o TTL seria só um registro sem dentes. */
export const Route = createFileRoute("/impersonar")({
  validateSearch: z.object({
    token_hash: z.string(),
    imp_session_id: z.string(),
  }),
  head: () => ({ meta: [{ title: "Acessando como cliente — Jáwda" }] }),
  component: ImpersonarPage,
});

function decodeJwtSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { session_id?: string };
    return claims.session_id ?? null;
  } catch {
    return null;
  }
}

function ImpersonarPage() {
  const { token_hash, imp_session_id } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function run() {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash });
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }

      const supabaseSessionId = data.session ? decodeJwtSessionId(data.session.access_token) : null;
      if (supabaseSessionId) {
        // Falha em vincular não deve travar o acesso (a sessão em si já
        // está válida) — mas sem esse vínculo o TTL não consegue revogar
        // nada de verdade, só fica registrado; por isso ainda assim é
        // aguardado antes de navegar, para dar tempo do insert acontecer.
        await supabase.rpc("attach_impersonation_session_token", {
          p_impersonation_session_id: imp_session_id,
          p_supabase_session_id: supabaseSessionId,
        });
      }

      navigate({ to: "/" });
    }
    run();
    return () => {
      active = false;
    };
  }, [token_hash, imp_session_id, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <JawdaLogo size={32} />
      {error ? (
        <div className="max-w-sm text-sm text-destructive">
          Não foi possível iniciar o acesso como cliente: {error}. O link pode ter expirado — volte
          ao Painel Admin e tente novamente.
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Entrando como o usuário selecionado…</p>
      )}
    </div>
  );
}
