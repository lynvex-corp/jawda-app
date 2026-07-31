import { Eye, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  useActiveImpersonationSession,
  useEndImpersonationSession,
} from "@/lib/queries/impersonation";

/** Faixa fixa exigida pelo item 6 da aba de Usuários e Acessos: enquanto o
 * time interno Lynvex está "acessando como cliente", o painel do cliente
 * precisa deixar isso visível o tempo todo, sem exceção. Fica acima de
 * <Outlet/> em __root.tsx, no mesmo nível do DelinquencyBanner. */
export function ImpersonationBanner() {
  const { data: session } = useActiveImpersonationSession();
  const endSession = useEndImpersonationSession();
  const navigate = useNavigate();

  if (!session) return null;

  async function handleExit() {
    try {
      await endSession.mutateAsync(session!.id);
    } finally {
      // Sessão real do Supabase Auth do usuário-alvo — sair de verdade,
      // nunca deixar o staff "preso" logado como o cliente.
      await getSupabaseBrowserClient().auth.signOut();
      toast.success("Sessão de acesso como cliente encerrada.");
      navigate({ to: "/login" });
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand/30 bg-brand px-4 py-2 text-xs text-brand-foreground md:px-8">
      <span className="flex items-center gap-2 font-medium">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        Você está visualizando como {session.staffFullName}, da equipe Lynvex — sessão de suporte,
        motivo registrado na trilha.
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 rounded-md px-2 text-[11px] text-brand-foreground hover:bg-black/10"
        onClick={handleExit}
        disabled={endSession.isPending}
      >
        <LogOut className="mr-1 h-3 w-3" /> Sair do modo cliente
      </Button>
    </div>
  );
}
