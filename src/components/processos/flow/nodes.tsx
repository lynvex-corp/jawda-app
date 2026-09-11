import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import { Play, Square, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProcessFlowNode } from "@/lib/queries/processos";

const SIDES: { id: string; position: Position }[] = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
];

/** 4 handles (um por lado), todos `type="source"` — o editor usa
 * `connectionMode="loose"` (ver editor.tsx), que deixa qualquer handle
 * também receber conexão. Um handle por lado com target+source
 * sobrepostos no mesmo pixel quebra a interação (limitação conhecida do
 * React Flow); "loose" evita isso sem duplicar handle nenhum. Sem
 * restringir de que lado sai o fluxo — o usuário conecta de qualquer
 * lado pra qualquer lado. */
function AllSideHandles() {
  return (
    <>
      {SIDES.map((s) => (
        <Handle
          key={s.id}
          type="source"
          position={s.position}
          id={s.id}
          className="!h-2 !w-2 !border-brand !bg-brand"
        />
      ))}
    </>
  );
}

export function StartNode({ selected }: NodeProps<ProcessFlowNode>) {
  return (
    <div
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full border-2 bg-[color:var(--success)]/15 text-[color:var(--success)]",
        selected ? "border-[color:var(--success)]" : "border-[color:var(--success)]/50",
      )}
    >
      <Play className="h-5 w-5 fill-current" />
      <Handle type="source" position={Position.Right} id="right" className="!h-2 !w-2 !bg-brand" />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!h-2 !w-2 !bg-brand"
      />
    </div>
  );
}

export function EndNode({ selected }: NodeProps<ProcessFlowNode>) {
  return (
    <div
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-full border-2 bg-[color:var(--severity-critical)]/15 text-[color:var(--severity-critical)]",
        selected
          ? "border-[color:var(--severity-critical)]"
          : "border-[color:var(--severity-critical)]/50",
      )}
    >
      <Square className="h-4 w-4 fill-current" />
      <Handle type="source" position={Position.Left} id="left" className="!h-2 !w-2 !bg-brand" />
      <Handle type="source" position={Position.Top} id="top" className="!h-2 !w-2 !bg-brand" />
    </div>
  );
}

export function TaskNode({ data, selected }: NodeProps<ProcessFlowNode>) {
  return (
    <div
      className={cn(
        "flex min-h-[64px] w-[160px] items-center justify-center rounded-xl border-2 bg-card px-3 py-2 text-center text-xs font-medium text-foreground shadow-sm",
        selected ? "border-brand" : "border-border",
      )}
    >
      <AllSideHandles />
      {data.label || "Tarefa"}
    </div>
  );
}

export function DecisionNode({ data, selected }: NodeProps<ProcessFlowNode>) {
  return (
    <div className="relative flex h-[110px] w-[110px] items-center justify-center">
      <div
        className={cn(
          "absolute inset-0 rotate-45 rounded-lg border-2 bg-[color:var(--warning)]/15",
          selected
            ? "border-[color:var(--severity-high)]"
            : "border-[color:var(--severity-high)]/60",
        )}
      />
      <AllSideHandles />
      <div className="z-10 flex items-center gap-1 px-4 text-center text-[11px] font-medium text-foreground">
        {data.label || "Decisão?"}
      </div>
      <Diamond className="pointer-events-none absolute -top-4 h-3 w-3 text-[color:var(--severity-high)]" />
    </div>
  );
}

/** Raia — região visual (não nó-pai do React Flow: sem parentId/extent).
 * Cada elemento (tarefa, decisão…) já tem o próprio campo Responsável no
 * painel de propriedades, independente de estar visualmente dentro de
 * uma raia ou não — a raia organiza visualmente por área/responsável,
 * como no Bizagi, mas não "adota" filhos automaticamente ao ser
 * arrastada (mover a raia não arrasta o que está dentro dela; decisão
 * deliberada pra não depender de detecção de interseção em tempo de
 * arraste, difícil de validar sem teste interativo de navegador).
 * Faixa horizontal com o nome do responsável fixo à esquerda; a
 * NodeResizer abaixo deixa a largura/altura ajustável quando selecionada. */
export function LaneNode({ data, selected }: NodeProps<ProcessFlowNode>) {
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={400}
        minHeight={140}
        lineClassName="!border-brand"
        handleClassName="!h-2.5 !w-2.5 !border-brand !bg-white"
      />
      <div
        className={cn(
          "h-full w-full rounded-xl border-2 bg-muted/20",
          selected ? "border-brand/60" : "border-border",
        )}
      >
        <div className="w-[140px] rounded-tl-[10px] border-b-2 border-r-2 border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground/80">
          {data.label || "Raia"}
        </div>
      </div>
    </>
  );
}

export const PROCESS_NODE_TYPES = {
  startNode: StartNode,
  endNode: EndNode,
  taskNode: TaskNode,
  decisionNode: DecisionNode,
  laneNode: LaneNode,
};
