import { useMemo, useState } from "react";
import { Search, UserPlus, X, Users, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmployees, useJobPositions } from "@/lib/queries/pessoas";
import { cn } from "@/lib/utils";

/* ============================================================
 * Seletor de participantes (Bloco 3, item 1).
 *
 * Antes era um <Input> onde se digitava o nome e apertava Enter — texto
 * livre, sem vínculo com pessoa cadastrada. Agora sai de Cargos e Perfis,
 * nos dois modos que o item pedia: por cargo (adiciona todo mundo daquele
 * cargo de uma vez) e por pessoa.
 *
 * Quem não tem usuário vinculado (`linkedUserId` nulo) entra na lista
 * normalmente, mas é sinalizado: essa pessoa não recebe a notificação de
 * confirmação porque não tem conta onde recebê-la.
 * ============================================================ */

export function ParticipantesPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: employees = [], isLoading } = useEmployees();
  const { data: positions = [] } = useJobPositions();
  const [busca, setBusca] = useState("");

  const selected = useMemo(
    () => employees.filter((e) => selectedIds.includes(e.id)),
    [employees, selectedIds],
  );

  const disponiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return employees
      .filter((e) => !selectedIds.includes(e.id))
      .filter(
        (e) =>
          !termo ||
          e.nome.toLowerCase().includes(termo) ||
          (e.jobPositionNome ?? "").toLowerCase().includes(termo),
      );
  }, [employees, selectedIds, busca]);

  const adicionarPorCargo = (positionId: string) => {
    const doCargo = employees.filter((e) => e.jobPositionId === positionId).map((e) => e.id);
    // Set em vez de concat: quem já estava selecionado individualmente não
    // pode entrar duas vezes — o unique (evento, employee) recusaria.
    onChange([...new Set([...selectedIds, ...doCargo])]);
  };

  const semConta = selected.filter((e) => !e.linkedUserId).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value="" onValueChange={adicionarPorCargo}>
          <SelectTrigger className="h-9 w-[240px] rounded-lg text-xs">
            <SelectValue placeholder="Adicionar todos de um cargo…" />
          </SelectTrigger>
          <SelectContent>
            {positions.map((p) => {
              const total = employees.filter((e) => e.jobPositionId === p.id).length;
              return (
                <SelectItem key={p.id} value={p.id} disabled={total === 0}>
                  {p.nome} ({total})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pessoa por nome ou cargo…"
            className="h-9 rounded-lg pl-8 text-xs"
          />
        </div>
      </div>

      {selected.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Users className="h-3 w-3" />
            {selected.length} participante{selected.length === 1 ? "" : "s"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((e) => (
              <Badge
                key={e.id}
                variant="outline"
                className={cn(
                  "gap-1 rounded-md py-1 pl-2 pr-1 text-[11px] font-normal",
                  !e.linkedUserId && "border-dashed",
                )}
              >
                <span className="text-foreground">{e.nome}</span>
                {e.jobPositionNome && (
                  <span className="text-muted-foreground">· {e.jobPositionNome}</span>
                )}
                <button
                  type="button"
                  onClick={() => onChange(selectedIds.filter((id) => id !== e.id))}
                  aria-label={`Remover ${e.nome}`}
                  className="ml-0.5 rounded p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          {semConta > 0 && (
            <p className="flex items-start gap-1.5 text-[11px] text-[color:var(--severity-high)]">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              {semConta === 1
                ? "1 participante não tem usuário vinculado e não receberá a notificação para confirmar presença."
                : `${semConta} participantes não têm usuário vinculado e não receberão a notificação para confirmar presença.`}
            </p>
          )}
        </div>
      )}

      <div className="max-h-44 overflow-y-auto rounded-lg border border-border/60">
        {isLoading ? (
          <p className="p-3 text-center text-xs text-muted-foreground">Carregando pessoas…</p>
        ) : disponiveis.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">
            {employees.length === 0
              ? "Nenhuma pessoa cadastrada em Cargos e Perfis."
              : "Ninguém mais a adicionar."}
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {disponiveis.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onChange([...selectedIds, e.id])}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-brand-soft/40"
                >
                  <UserPlus className="h-3.5 w-3.5 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">{e.nome}</span>
                  {e.jobPositionNome && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {e.jobPositionNome}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
