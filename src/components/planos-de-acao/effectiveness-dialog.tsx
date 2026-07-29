import { useState } from "react";
import { toast } from "sonner";
import { AlertOctagon, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateNC } from "@/lib/queries/ncs";
import {
  useVerifyEffectiveness,
  VERIFICATION_REASON_LABEL,
  type CorrectiveActionView,
  type VerificationReasonDb,
} from "@/lib/queries/action-plans";

/**
 * Fluxo completo de verificação de eficácia (seção 11 do Guia): pergunta
 * "foi eficaz?", os 3 caminhos de reprovação, e a oferta de encerrar a NC
 * de origem quando a verificação aprova. Componente único usado tanto na
 * lista/kanban (src/components/planos-de-acao/page.tsx) quanto no detalhe
 * do plano (src/components/planos-de-acao/detalhe.tsx) para não duplicar a
 * lógica de negócio em dois lugares.
 */
export function EffectivenessDialog({
  action,
  onClose,
}: {
  action: CorrectiveActionView | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const verifyEffectiveness = useVerifyEffectiveness();
  const updateNC = useUpdateNC();

  const [efResult, setEfResult] = useState<"eficaz" | "nao_eficaz" | null>(null);
  const [efReason, setEfReason] = useState<VerificationReasonDb | "">("");
  const [efNewDeadline, setEfNewDeadline] = useState("");
  const [efNewRootCause, setEfNewRootCause] = useState("");
  const [efNotes, setEfNotes] = useState("");
  const [ncCloseOffer, setNcCloseOffer] = useState<{ ncId: string; ncCodigo: string } | null>(null);

  function reset() {
    setEfResult(null);
    setEfReason("");
    setEfNewDeadline("");
    setEfNewRootCause("");
    setEfNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  const confirmar = () => {
    if (!action || !user) return;

    if (efResult === "eficaz") {
      verifyEffectiveness.mutate(
        { correctiveActionId: action.actionId, verifiedBy: user.id, result: "eficaz" },
        {
          onSuccess: () => {
            toast.success(`${action.codigo} aprovado — ação eficaz confirmada.`);
            if (action.ncId) {
              setNcCloseOffer({ ncId: action.ncId, ncCodigo: action.vinculadoCodigo ?? "" });
            }
            handleClose();
          },
          onError: (err) =>
            toast.error("Não foi possível registrar a verificação.", {
              description: err instanceof Error ? err.message : undefined,
            }),
        },
      );
      return;
    }

    if (efResult !== "nao_eficaz") {
      toast.error('Responda "Foi eficaz?" antes de confirmar.');
      return;
    }
    if (!efReason) {
      toast.error("Selecione por que a ação não foi eficaz.");
      return;
    }
    if (!efNewDeadline) {
      toast.error("Informe o novo prazo da próxima tentativa.");
      return;
    }
    if (efReason === "causa_errada" && !efNewRootCause.trim()) {
      toast.error("Descreva a nova causa raiz.");
      return;
    }

    verifyEffectiveness.mutate(
      {
        correctiveActionId: action.actionId,
        verifiedBy: user.id,
        result: "nao_eficaz",
        reason: efReason,
        newDeadline: new Date(`${efNewDeadline}T12:00:00`),
        newRootCause: efReason === "causa_errada" ? efNewRootCause.trim() : undefined,
        notes: efNotes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.warning(`${action.codigo} reprovado — nova tentativa aguardando aprovação.`, {
            description: VERIFICATION_REASON_LABEL[efReason as VerificationReasonDb],
          });
          handleClose();
        },
        onError: (err) =>
          toast.error("Não foi possível registrar a verificação.", {
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
  };

  function handleCloseNc() {
    if (!ncCloseOffer) return;
    updateNC.mutate(
      { id: ncCloseOffer.ncId, status: "Encerrada" },
      {
        onSuccess: () => toast.success(`${ncCloseOffer.ncCodigo} encerrada.`),
        onError: (err) =>
          toast.error("Não foi possível encerrar a NC.", {
            description: err instanceof Error ? err.message : undefined,
          }),
      },
    );
    setNcCloseOffer(null);
  }

  return (
    <>
      <Dialog open={!!action} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Verificação de Eficácia</DialogTitle>
            <DialogDescription>
              {action?.codigo} · {action?.descricao.slice(0, 90)}
            </DialogDescription>
          </DialogHeader>

          {efResult === null && (
            <div className="space-y-4 py-2">
              <p className="text-sm font-medium text-foreground">Foi eficaz?</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-16 flex-col gap-1 border-[color:var(--success)]/40 text-[color:var(--success)] hover:bg-[color:var(--success)]/10"
                  onClick={() => setEfResult("eficaz")}
                >
                  <Check className="h-5 w-5" /> Sim
                </Button>
                <Button
                  variant="outline"
                  className="h-16 flex-col gap-1 border-[color:var(--severity-critical)]/40 text-[color:var(--severity-critical)] hover:bg-[color:var(--severity-critical)]/10"
                  onClick={() => setEfResult("nao_eficaz")}
                >
                  <AlertOctagon className="h-5 w-5" /> Não
                </Button>
              </div>
            </div>
          )}

          {efResult === "eficaz" && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 p-3 text-sm text-foreground/80">
                A ação será encerrada como <strong>aprovada</strong>.
                {action?.ncId &&
                  " Como esta ação veio de uma NC, você poderá encerrar a NC em seguida."}
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="ghost" onClick={() => setEfResult(null)}>
                  Voltar
                </Button>
                <Button
                  className="bg-[color:var(--success)] text-white hover:bg-[color:var(--success)]/90"
                  onClick={confirmar}
                  disabled={verifyEffectiveness.isPending}
                >
                  Confirmar aprovação
                </Button>
              </DialogFooter>
            </div>
          )}

          {efResult === "nao_eficaz" && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs">Por que não foi eficaz? *</Label>
                <RadioGroup
                  className="mt-2 space-y-2"
                  value={efReason}
                  onValueChange={(v) => setEfReason(v as VerificationReasonDb)}
                >
                  {(Object.keys(VERIFICATION_REASON_LABEL) as VerificationReasonDb[]).map((r) => (
                    <label
                      key={r}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border p-2.5 text-sm cursor-pointer",
                        efReason === r ? "border-brand bg-brand-soft/40" : "border-border/70",
                      )}
                    >
                      <RadioGroupItem value={r} className="mt-0.5" />
                      <span>{VERIFICATION_REASON_LABEL[r]}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              {efReason === "causa_errada" && (
                <div>
                  <Label className="text-xs">Nova causa raiz *</Label>
                  <Textarea
                    className="mt-1.5 min-h-[70px]"
                    value={efNewRootCause}
                    onChange={(e) => setEfNewRootCause(e.target.value)}
                    placeholder="Descreva a causa raiz correta — reabre a análise (5 Porquês)."
                  />
                </div>
              )}
              <div>
                <Label className="text-xs">Novo prazo *</Label>
                <Input
                  type="date"
                  className="mt-1.5"
                  value={efNewDeadline}
                  onChange={(e) => setEfNewDeadline(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Observações (opcional)</Label>
                <Textarea
                  className="mt-1.5 min-h-[60px]"
                  value={efNotes}
                  onChange={(e) => setEfNotes(e.target.value)}
                  placeholder="Evidências ou contexto da reprovação…"
                />
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="ghost" onClick={() => setEfResult(null)}>
                  Voltar
                </Button>
                <Button
                  className="bg-[color:var(--severity-critical)] text-white hover:bg-[color:var(--severity-critical)]/90"
                  onClick={confirmar}
                  disabled={verifyEffectiveness.isPending}
                >
                  Confirmar reprovação
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!ncCloseOffer} onOpenChange={(o) => !o && setNcCloseOffer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar a não conformidade?</AlertDialogTitle>
            <AlertDialogDescription>
              Uma ação corretiva de {ncCloseOffer?.ncCodigo} foi aprovada na verificação de
              eficácia. Você pode encerrar a NC agora ou mantê-la em tratativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter em tratativa</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseNc}>Encerrar NC</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
