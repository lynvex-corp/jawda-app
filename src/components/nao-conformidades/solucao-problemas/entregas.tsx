import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/app/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAddCorrectiveActionToPlan,
  useCorrectiveActionsByPlan,
  useOrgMembers,
  type CorrectiveActionStatusDb,
} from "@/lib/queries/action-plans";
import { getErrorMessage } from "@/lib/utils";

import {
  entregaPreenchida,
  entregaVazia,
  prazoParaData,
  type EntregaRascunho,
} from "@/components/nao-conformidades/solucao-problemas/entregas-utils";

const STATUS_LABEL: Record<CorrectiveActionStatusDb, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  planejada: "Planejada",
  em_execucao: "Em execução",
  aguardando_verificacao: "Em verificação",
  aprovada: "Concluída",
  encerrada: "Superada",
};

interface EntregasProps {
  /** Plano já gerado (milestones_plan_id) — a tabela passa a ser a do Plano de Ação. */
  planId: string | null;
  planCode?: string | null;
  solutionCode?: string;
  problemDefinition?: string;
  rascunhos: EntregaRascunho[];
  onRascunhosChange: (rows: EntregaRascunho[]) => void;
  disabled?: boolean;
}

/** Campo 6 do A3 — Principais Entregas (Milestones): N, Ação, Responsável,
 * Data, Status. Antes do plano existir são linhas locais; ao salvar viram
 * ações corretivas reais (origem "Solução de Problemas"). Depois, a tabela
 * lê as próprias ações do plano, e o status vem delas. */
export function Entregas({
  planId,
  planCode,
  rascunhos,
  onRascunhosChange,
  disabled,
  ...ctx
}: EntregasProps) {
  const { data: membros = [] } = useOrgMembers();
  const { data: acoes = [] } = useCorrectiveActionsByPlan(planId ?? undefined);
  const addAction = useAddCorrectiveActionToPlan();

  const opcoes = [...membros]
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"))
    .map((m) => ({ value: m.id, label: m.fullName }));

  function setRow(i: number, patch: Partial<EntregaRascunho>) {
    onRascunhosChange(rascunhos.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function adicionarAoPlano(i: number) {
    const row = rascunhos[i];
    if (!planId || !entregaPreenchida(row)) {
      toast.error("Preencha ação, responsável e data da entrega");
      return;
    }
    try {
      await addAction.mutateAsync({
        actionPlanId: planId,
        oque: row.oque.trim(),
        porque: `Entrega do A3 ${ctx.solutionCode}: ${ctx.problemDefinition}`,
        onde: `Conforme A3 ${ctx.solutionCode}`,
        responsavelId: row.responsavelId,
        prazo: prazoParaData(row.prazo),
        como: `Conforme A3 ${ctx.solutionCode}`,
        quanto: 0,
      });
      onRascunhosChange(rascunhos.filter((_, idx) => idx !== i));
      toast.success("Entrega adicionada ao Plano de Ação");
    } catch (e) {
      toast.error("Não foi possível adicionar a entrega", { description: getErrorMessage(e) });
    }
  }

  return (
    <div className="space-y-3">
      {planId && (
        <div className="overflow-x-auto rounded-lg border border-border/80">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-2">N</th>
                <th className="px-2 py-2">Ação</th>
                <th className="px-2 py-2">Responsável</th>
                <th className="px-2 py-2">Data</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {acoes.map((a, i) => (
                <tr key={a.id} className="border-t border-border/60">
                  <td className="px-2 py-2">{i + 1}</td>
                  <td className="px-2 py-2">{a.what_description}</td>
                  <td className="px-2 py-2">{a.who_responsible?.full_name ?? "—"}</td>
                  <td className="px-2 py-2">{format(new Date(a.when_end), "dd/MM/yyyy")}</td>
                  <td className="px-2 py-2">{STATUS_LABEL[a.status]}</td>
                </tr>
              ))}
              {acoes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-center text-muted-foreground">
                    Carregando entregas…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {planId && planCode && (
        <p className="text-xs text-muted-foreground">
          Entregas registradas no Plano de Ação{" "}
          <Link
            to="/planos-de-acao/$id"
            params={{ id: planId }}
            className="font-medium text-sp hover:underline"
          >
            {planCode}
          </Link>
          . O status acompanha a execução lá.
        </p>
      )}

      {rascunhos.map((r, i) => (
        <div
          key={i}
          className="grid items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-2 md:grid-cols-[1fr_200px_150px_auto]"
        >
          <Input
            value={r.oque}
            disabled={disabled}
            onChange={(e) => setRow(i, { oque: e.target.value })}
            placeholder={`Entrega ${(planId ? acoes.length : 0) + i + 1} — ação`}
            className="h-9 rounded-lg"
          />
          <SearchableSelect
            value={r.responsavelId || undefined}
            onValueChange={(v) => setRow(i, { responsavelId: v })}
            options={opcoes}
            placeholder="Responsável"
            searchPlaceholder="Buscar pessoa…"
            disabled={disabled}
          />
          <Input
            type="date"
            value={r.prazo}
            disabled={disabled}
            onChange={(e) => setRow(i, { prazo: e.target.value })}
            className="h-9 rounded-lg"
          />
          <div className="flex gap-1">
            {planId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || addAction.isPending}
                onClick={() => adicionarAoPlano(i)}
                className="h-9 rounded-lg"
              >
                Adicionar
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={disabled}
              aria-label="Remover entrega"
              onClick={() => onRascunhosChange(rascunhos.filter((_, idx) => idx !== i))}
              className="h-9 w-9"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {!disabled && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onRascunhosChange([...rascunhos, entregaVazia()])}
          className="gap-1 rounded-lg"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar entrega
        </Button>
      )}
      {!planId && rascunhos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Ao salvar, as entregas viram ações corretivas de um Plano de Ação com origem "Solução de
          Problemas".
        </p>
      )}
    </div>
  );
}
