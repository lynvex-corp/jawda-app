import { Play, Square, Diamond, PanelTop } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProcessNodeType } from "@/lib/queries/processos";

const SHAPES: { type: ProcessNodeType; label: string; icon: typeof Play }[] = [
  { type: "laneNode", label: "Raia", icon: PanelTop },
  { type: "startNode", label: "Início", icon: Play },
  { type: "taskNode", label: "Tarefa", icon: Square },
  { type: "decisionNode", label: "Decisão", icon: Diamond },
  { type: "endNode", label: "Fim", icon: Square },
];

/** "Clique pra adicionar", não arrastar-da-paleta — o requisito de
 * arrastar livremente é sobre reposicionar o elemento já no canvas
 * (nativo do React Flow em qualquer nó), não sobre a origem do elemento.
 * Evita a complexidade extra (e frágil) de HTML5 drag-and-drop com
 * coordenada de soltura precisa, sem abrir mão de nada do pedido. */
export function ProcessFlowPalette({
  onAdd,
  disabled,
}: {
  onAdd: (type: ProcessNodeType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-card p-2 shadow-sm">
      {SHAPES.map((s) => {
        const Icon = s.icon;
        return (
          <Button
            key={s.type}
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onAdd(s.type)}
            className="justify-start gap-2 rounded-lg text-xs"
          >
            <Icon className="h-3.5 w-3.5" /> {s.label}
          </Button>
        );
      })}
    </div>
  );
}
