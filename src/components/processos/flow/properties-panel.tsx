import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/app/searchable-select";
import { Trash2, X } from "lucide-react";
import { useEmployees, useJobPositions } from "@/lib/queries/pessoas";
import type { ProcessFlowNode, ProcessFlowEdge, ProcessNodeType } from "@/lib/queries/processos";

const NODE_TYPE_LABEL: Record<ProcessNodeType, string> = {
  startNode: "Início",
  endNode: "Fim",
  taskNode: "Tarefa",
  decisionNode: "Decisão",
  laneNode: "Raia",
};

/** Cargos e Perfis dá dois jeitos de responsabilizar: uma pessoa
 * (employees) ou um cargo (job_positions) — mesmo par usado no RACI
 * planejado pro Bloco C. Um <select> só, prefixando o value pra saber
 * qual dos dois foi escolhido, evita dois campos redundantes na UI. */
function ResponsibleSelect({
  employeeId,
  jobPositionId,
  onChange,
}: {
  employeeId: string | null | undefined;
  jobPositionId: string | null | undefined;
  onChange: (v: { employeeId: string | null; jobPositionId: string | null }) => void;
}) {
  const { data: employees = [] } = useEmployees();
  const { data: positions = [] } = useJobPositions();
  const value = employeeId ? `e:${employeeId}` : jobPositionId ? `p:${jobPositionId}` : undefined;

  const options = [
    ...[...positions]
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((p) => ({ value: `p:${p.id}`, label: p.nome, sublabel: "Cargo" })),
    ...[...employees]
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((e) => ({ value: `e:${e.id}`, label: e.nome, sublabel: "Pessoa" })),
  ];

  return (
    <SearchableSelect
      value={value}
      onValueChange={(v) => {
        if (v.startsWith("e:")) onChange({ employeeId: v.slice(2), jobPositionId: null });
        else onChange({ employeeId: null, jobPositionId: v.slice(2) });
      }}
      placeholder="Ninguém definido"
      searchPlaceholder="Buscar por nome ou cargo…"
      emptyMessage="Nenhum resultado."
      className="h-9 text-sm"
      options={options}
    />
  );
}

export function ProcessFlowPropertiesPanel({
  node,
  edge,
  readOnly,
  onUpdateNode,
  onUpdateEdge,
  onDelete,
  onClose,
}: {
  node: ProcessFlowNode | null;
  edge: ProcessFlowEdge | null;
  readOnly: boolean;
  onUpdateNode: (id: string, patch: Partial<ProcessFlowNode["data"]>) => void;
  onUpdateEdge: (id: string, label: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  if (!node && !edge) return null;

  return (
    <div className="w-[280px] shrink-0 space-y-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {node ? NODE_TYPE_LABEL[node.type as ProcessNodeType] : "Conector"}
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {node && (
        <>
          <div>
            <label className="text-xs font-medium">Nome</label>
            <Input
              value={node.data.label}
              disabled={readOnly}
              onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
              className="mt-1 h-9 text-sm"
            />
          </div>
          {(node.type === "taskNode" || node.type === "laneNode") && (
            <div>
              <label className="text-xs font-medium">Responsável</label>
              <div className="mt-1">
                <ResponsibleSelect
                  employeeId={node.data.responsibleEmployeeId}
                  jobPositionId={node.data.responsibleJobPositionId}
                  onChange={(v) =>
                    !readOnly &&
                    onUpdateNode(node.id, {
                      responsibleEmployeeId: v.employeeId,
                      responsibleJobPositionId: v.jobPositionId,
                    })
                  }
                />
              </div>
            </div>
          )}
        </>
      )}

      {edge && (
        <div>
          <label className="text-xs font-medium">Rótulo da seta</label>
          <Input
            value={typeof edge.label === "string" ? edge.label : ""}
            disabled={readOnly}
            placeholder="Sim, Não…"
            onChange={(e) => onUpdateEdge(edge.id, e.target.value)}
            className="mt-1 h-9 text-sm"
          />
        </div>
      )}

      {!readOnly && (
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          className="w-full gap-1.5 text-xs text-[color:var(--severity-critical)] hover:bg-[color:var(--severity-critical)]/10"
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir {node ? "elemento" : "conector"}
        </Button>
      )}
    </div>
  );
}
