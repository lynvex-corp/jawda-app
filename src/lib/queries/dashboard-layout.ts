import { useCallback, useEffect, useState } from "react";
import type { LayoutItem } from "react-grid-layout";
import { useSessionOrgId } from "@/lib/queries/contract";
import { useAuth } from "@/hooks/use-auth";

/* ============================================================
 * Personalização da Gestão à Vista por usuário (item 6, Bloco 6) — cada
 * usuário escolhe quais cards aparecem, reposiciona e redimensiona. v1 do
 * recurso: persistência em localStorage (decisão do Matheus — só migra pra
 * tabela no banco se o uso real mostrar necessidade de sincronizar entre
 * dispositivos). Chaveado por ORG + USUÁRIO (não só org, diferente do
 * período em dashboard.ts) — layout é "exclusivo por usuário", então dois
 * usuários no mesmo navegador (ex.: terminal compartilhado numa obra) não
 * podem herdar o layout um do outro.
 * ============================================================ */

export type WidgetId =
  | "kpis"
  | "pendencias"
  | "notas"
  | "cultura"
  | "planos-eficacia"
  | "ncs-graficos"
  | "ultimas-ncs"
  | "reconhecimento";

export const WIDGET_LABEL: Record<WidgetId, string> = {
  kpis: "Indicadores principais",
  pendencias: "Pendências",
  notas: "Minhas anotações",
  cultura: "Cultura da Qualidade",
  "planos-eficacia": "Planos de Ação Atrasados + Eficácia",
  "ncs-graficos": "NCs por mês e por gravidade",
  "ultimas-ncs": "Últimas não conformidades",
  reconhecimento: "Reconhecimento",
};

/** Ordem de exibição no painel "adicionar widget" (lista de escolha) —
 * separada da ordem de posição no grid, que vive em DEFAULT_LAYOUT/layout
 * salvo. */
export const WIDGET_IDS: WidgetId[] = [
  "kpis",
  "pendencias",
  "notas",
  "cultura",
  "planos-eficacia",
  "ncs-graficos",
  "ultimas-ncs",
  "reconhecimento",
];

/** Grid de 12 colunas, rowHeight de 30px (ver Dashboard). Espelha a ordem
 * visual que a tela tinha antes da personalização existir. */
export const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "kpis", x: 0, y: 0, w: 12, h: 4, minW: 4, minH: 3 },
  { i: "pendencias", x: 0, y: 4, w: 8, h: 9, minW: 3, minH: 5 },
  { i: "notas", x: 8, y: 4, w: 4, h: 9, minW: 3, minH: 4 },
  { i: "cultura", x: 0, y: 13, w: 12, h: 3, minW: 4, minH: 3 },
  { i: "planos-eficacia", x: 0, y: 16, w: 12, h: 8, minW: 4, minH: 5 },
  { i: "ncs-graficos", x: 0, y: 24, w: 12, h: 10, minW: 4, minH: 6 },
  { i: "ultimas-ncs", x: 0, y: 34, w: 12, h: 9, minW: 4, minH: 5 },
  { i: "reconhecimento", x: 0, y: 43, w: 12, h: 10, minW: 4, minH: 6 },
];

const DEFAULT_HIDDEN: WidgetId[] = [];

interface LayoutState {
  layout: LayoutItem[];
  hidden: WidgetId[];
}

const STORAGE_PREFIX = "jawda:gestao-a-vista:layout";

function isWidgetId(v: unknown): v is WidgetId {
  return typeof v === "string" && (WIDGET_IDS as string[]).includes(v);
}

function isValidLayout(v: unknown): v is LayoutItem[] {
  return (
    Array.isArray(v) &&
    v.every(
      (item) =>
        item &&
        typeof item.i === "string" &&
        typeof item.x === "number" &&
        typeof item.y === "number" &&
        typeof item.w === "number" &&
        typeof item.h === "number",
    )
  );
}

function lerEstadoSalvo(key: string): LayoutState {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { layout: DEFAULT_LAYOUT, hidden: DEFAULT_HIDDEN };
    const parsed = JSON.parse(raw);
    const layout = isValidLayout(parsed.layout) ? parsed.layout : DEFAULT_LAYOUT;
    const hidden = Array.isArray(parsed.hidden) ? parsed.hidden.filter(isWidgetId) : DEFAULT_HIDDEN;
    return { layout, hidden };
  } catch {
    return { layout: DEFAULT_LAYOUT, hidden: DEFAULT_HIDDEN };
  }
}

export function useDashboardLayout() {
  const orgId = useSessionOrgId();
  const { user } = useAuth();
  const storageKey = orgId && user ? `${STORAGE_PREFIX}:${orgId}:${user.id}` : null;

  const [state, setState] = useState<LayoutState>({
    layout: DEFAULT_LAYOUT,
    hidden: DEFAULT_HIDDEN,
  });
  const [editMode, setEditMode] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    setState(lerEstadoSalvo(storageKey));
    setPronto(true);
  }, [storageKey]);

  const persistir = useCallback(
    (novo: LayoutState) => {
      setState(novo);
      if (!storageKey) return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(novo));
      } catch {
        /* modo privado / storage bloqueado: a sessão atual continua valendo */
      }
    },
    [storageKey],
  );

  const setLayout = useCallback(
    (layout: LayoutItem[]) => persistir({ ...state, layout }),
    [state, persistir],
  );

  const toggleWidget = useCallback(
    (id: WidgetId) => {
      const escondido = state.hidden.includes(id);
      const hidden = escondido ? state.hidden.filter((h) => h !== id) : [...state.hidden, id];
      persistir({ ...state, hidden });
    },
    [state, persistir],
  );

  const resetLayout = useCallback(() => {
    persistir({ layout: DEFAULT_LAYOUT, hidden: DEFAULT_HIDDEN });
  }, [persistir]);

  return {
    layout: state.layout,
    hidden: state.hidden,
    setLayout,
    toggleWidget,
    resetLayout,
    editMode,
    setEditMode,
    pronto,
  };
}
