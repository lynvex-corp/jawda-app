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
 * autentica, nunca escreve na trilha. */
export const Route = createFileRoute("/impersonar")({
  validateSearch: z.object({
    token_hash: z.string(),
  }),
  head: () => ({ meta: [{ title: "Acessando como cliente — Jáwda" }] }),
  component: ImpersonarPage,
});

function ImpersonarPage() {
  const { token_hash } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function run() {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash });
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      navigate({ to: "/" });
    }
    run();
    return () => {
      active = false;
    };
  }, [token_hash, navigate]);

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
