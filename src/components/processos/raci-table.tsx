import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { useEmployees, useJobPositions } from "@/lib/queries/pessoas";
import {
  useProcessMapRaci,
  useAddProcessMapRaci,
  useRemoveProcessMapRaci,
  PROCESS_RACI_PAPEL_OPTIONS,
  type ProcessMapVersion,
  type ProcessRaciPapel,
  type ProcessFlowNode,
} from "@/lib/queries/processos";

const RACI_NODE_TYPES = new Set(["taskNode", "decisionNode", "laneNode"]);

/** Aba RACI — visão tabular do mesmo dado editável na aba Fluxo (painel
 * de propriedades não duplica esta UI, pra não ter duas telas editando a
 * mesma coisa com lógica separada). Linhas = elementos do fluxo que fazem
 * sentido ter responsável (tarefa/decisão/raia — início/fim não). */
export function ProcessRaciTable({
  version,
  readOnly,
}: {
  version: ProcessMapVersion;
  readOnly: boolean;
}) {
  const { data: assignments = [] } = useProcessMapRaci(version.id);
  const removeRaci = useRemoveProcessMapRaci();
  const [addingFor, setAddingFor] = useState<{ nodeKey: string; papel: ProcessRaciPapel } | null>(
    null,
  );

  const nodes = version.diagram.nodes.filter((n) => RACI_NODE_TYPES.has(n.type as string));

  if (nodes.length === 0) {
    return (
      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma tarefa, decisão ou raia no fluxo ainda — adicione elementos na aba Fluxo primeiro.
        </CardContent>
      </Card>
    );
  }

  const assignmentsFor = (nodeKey: string, papel: ProcessRaciPapel) =>
    assignments.filter((a) => a.nodeKey === nodeKey && a.papel === papel);

  const remover = (id: string) => {
    removeRaci.mutate(
      { id, versionId: version.id },
      { onError: (e) => toast.error("Erro ao remover", { description: getErrorMessage(e) }) },
    );
  };

  return (
    <>
      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 text-left">Elemento</th>
                {PROCESS_RACI_PAPEL_OPTIONS.map((p) => (
                  <th key={p.value} className="px-3 py-2.5 text-left">
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodes.map((n: ProcessFlowNode) => (
                <tr key={n.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground/85">
                    {n.data.label || "—"}
                  </td>
                  {PROCESS_RACI_PAPEL_OPTIONS.map((p) => {
                    const items = assignmentsFor(n.id, p.value);
                    return (
                      <td key={p.value} className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {items.map((a) => (
                            <Badge
                              key={a.id}
                              variant="outline"
                              className="gap-1 rounded-md text-[10px]"
                            >
                              {a.assigneeName}
                              {!readOnly && (
                                <button
                                  onClick={() => remover(a.id)}
                                  className="text-muted-foreground hover:text-[color:var(--severity-critical)]"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </Badge>
                          ))}
                          {!readOnly && (
                            <button
                              onClick={() => setAddingFor({ nodeKey: n.id, papel: p.value })}
                              className="text-muted-foreground hover:text-brand"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!addingFor} onOpenChange={(o) => !o && setAddingFor(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          {addingFor && (
            <AddRaciForm
              versionId={version.id}
              nodeKey={addingFor.nodeKey}
              papel={addingFor.papel}
              onDone={() => setAddingFor(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddRaciForm({
  versionId,
  nodeKey,
  papel,
  onDone,
}: {
  versionId: string;
  nodeKey: string;
  papel: ProcessRaciPapel;
  onDone: () => void;
}) {
  const { data: employees = [] } = useEmployees();
  const { data: positions = [] } = useJobPositions();
  const addRaci = useAddProcessMapRaci();
  const [value, setValue] = useState("");

  const salvar = () => {
    if (!value) {
      toast.error("Selecione uma pessoa ou cargo");
      return;
    }
    const isEmployee = value.startsWith("e:");
    addRaci.mutate(
      {
        versionId,
        nodeKey,
        employeeId: isEmployee ? value.slice(2) : null,
        jobPositionId: isEmployee ? null : value.slice(2),
        papel,
      },
      {
        onSuccess: onDone,
        onError: (e) => toast.error("Erro ao adicionar", { description: getErrorMessage(e) }),
      },
    );
  };

  const label = PROCESS_RACI_PAPEL_OPTIONS.find((p) => p.value === papel)?.label;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Adicionar {label}</DialogTitle>
        <DialogDescription>Escolha uma pessoa ou um cargo de Cargos e Perfis.</DialogDescription>
      </DialogHeader>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Selecione…" />
        </SelectTrigger>
        <SelectContent>
          {positions.map((p) => (
            <SelectItem key={`p:${p.id}`} value={`p:${p.id}`}>
              {p.nome} (cargo)
            </SelectItem>
          ))}
          {employees.map((e) => (
            <SelectItem key={`e:${e.id}`} value={`e:${e.id}`}>
              {e.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          onClick={salvar}
          disabled={addRaci.isPending}
          className="bg-brand text-white hover:bg-brand/90"
        >
          Adicionar
        </Button>
      </DialogFooter>
    </>
  );
}
