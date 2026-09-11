import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ProcessFlowPalette } from "@/components/processos/flow/palette";
import { ProcessFlowPropertiesPanel } from "@/components/processos/flow/properties-panel";
import { PROCESS_NODE_TYPES } from "@/components/processos/flow/nodes";
import { useSaveProcessMapDiagram } from "@/lib/queries/processos";
import type {
  ProcessFlowNode,
  ProcessFlowEdge,
  ProcessMapVersion,
  ProcessNodeType,
} from "@/lib/queries/processos";

const DEFAULT_LABEL: Record<ProcessNodeType, string> = {
  startNode: "Início",
  endNode: "Fim",
  taskNode: "Nova tarefa",
  decisionNode: "Decisão?",
  laneNode: "Nova raia",
};

const AUTOSAVE_DEBOUNCE_MS = 1200;

function ProcessFlowEditorInner({
  processMapId,
  version,
  readOnly,
}: {
  processMapId: string;
  version: ProcessMapVersion;
  readOnly: boolean;
}) {
  const { screenToFlowPosition } = useReactFlow<ProcessFlowNode, ProcessFlowEdge>();
  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessFlowNode>(version.diagram.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ProcessFlowEdge>(version.diagram.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const saveDiagram = useSaveProcessMapDiagram();
  const skipNextSave = useRef(true);
  const laneCount = useRef(0);

  // Troca de versão (ex.: abrir uma formalizada no histórico) recarrega o
  // estado local do zero e não deve disparar autosave do que acabou de
  // carregar.
  useEffect(() => {
    setNodes(version.diagram.nodes);
    setEdges(version.diagram.edges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    skipNextSave.current = true;
    laneCount.current = version.diagram.nodes.filter((n) => n.type === "laneNode").length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version.id]);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (readOnly) return;
    const timer = setTimeout(() => {
      saveDiagram.mutate({ versionId: version.id, processMapId, diagram: { nodes, edges } });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      setEdges((eds) =>
        addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, eds),
      );
    },
    [readOnly, setEdges],
  );

  const addNode = useCallback(
    (type: ProcessNodeType) => {
      if (readOnly) return;
      const id = crypto.randomUUID();
      if (type === "laneNode") {
        const newNode: ProcessFlowNode = {
          id,
          type,
          position: { x: 40, y: laneCount.current * 200 + 40 },
          width: 900,
          height: 170,
          zIndex: -1,
          data: { label: DEFAULT_LABEL[type] },
        };
        laneCount.current += 1;
        setNodes((nds) => [...nds, newNode]);
        return;
      }
      const center = screenToFlowPosition({
        x: window.innerWidth / 2 - 140,
        y: window.innerHeight / 2 - 120,
      });
      const newNode: ProcessFlowNode = {
        id,
        type,
        position: center,
        data: { label: DEFAULT_LABEL[type] },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [readOnly, screenToFlowPosition, setNodes],
  );

  const onNodeClick: NodeMouseHandler<ProcessFlowNode> = useCallback((_, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick: EdgeMouseHandler<ProcessFlowEdge> = useCallback((_, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const updateNodeData = useCallback(
    (id: string, patch: Partial<ProcessFlowNode["data"]>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
    },
    [setNodes],
  );

  const updateEdgeLabel = useCallback(
    (id: string, label: string) => {
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, label } : e)));
    },
    [setEdges],
  );

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
      );
      setSelectedNodeId(null);
    }
    if (selectedEdgeId) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId, setNodes, setEdges]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[520px] gap-3">
      {!readOnly && <ProcessFlowPalette onAdd={addNode} />}
      <div className="flex-1 overflow-hidden rounded-xl border border-border/70">
        <ReactFlow<ProcessFlowNode, ProcessFlowEdge>
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={PROCESS_NODE_TYPES}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable
          deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-card" />
        </ReactFlow>
      </div>
      <ProcessFlowPropertiesPanel
        node={selectedNode}
        edge={selectedEdge}
        readOnly={readOnly}
        onUpdateNode={updateNodeData}
        onUpdateEdge={updateEdgeLabel}
        onDelete={deleteSelected}
        onClose={onPaneClick}
      />
    </div>
  );
}

export function ProcessFlowEditor(props: {
  processMapId: string;
  version: ProcessMapVersion;
  readOnly: boolean;
}) {
  return (
    <ReactFlowProvider>
      <ProcessFlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
