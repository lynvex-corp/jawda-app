import type { ReactNode } from "react";
import { GridLayout, useContainerWidth, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetId } from "@/lib/queries/dashboard-layout";

/** Mecânica do grid arrastável/redimensionável (item 6, Bloco 6) — separado
 * de dashboard.tsx pra esse arquivo cuidar só de COMO renderizar o grid, não
 * do QUE renderizar em cada widget. `useContainerWidth` mede a largura real
 * via ResizeObserver (client-only); `mounted` fica false na primeira
 * passada do SSR, evitando mismatch de hidratação — só desenha o grid
 * depois de medir de verdade. Abaixo de `md`, o grid dá lugar a uma lista
 * empilhada simples: arrastar/redimensionar caixinha não é uma interação
 * viável em touch de tela pequena. */
export function DashboardGrid({
  editMode,
  layout,
  onLayoutChange,
  visibleIds,
  renderWidget,
  onHideWidget,
}: {
  editMode: boolean;
  layout: Layout;
  onLayoutChange: (layout: Layout) => void;
  visibleIds: WidgetId[];
  renderWidget: (id: WidgetId) => ReactNode;
  onHideWidget: (id: WidgetId) => void;
}) {
  const { width, containerRef, mounted } = useContainerWidth();

  const layoutVisivel = layout.filter((item) => visibleIds.includes(item.i as WidgetId));
  const emOrdem = [...layoutVisivel].sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <>
      {/* Mobile/tablet: empilhado, sem grid arrastável. */}
      <div className="space-y-4 md:hidden">
        {emOrdem.map((item) => (
          <div key={item.i}>{renderWidget(item.i as WidgetId)}</div>
        ))}
      </div>

      {/* Desktop: grid de verdade. */}
      <div ref={containerRef} className="hidden md:block">
        {mounted && (
          <GridLayout
            width={width}
            layout={layoutVisivel}
            onLayoutChange={onLayoutChange}
            gridConfig={{ cols: 12, rowHeight: 30, margin: [16, 16], containerPadding: [0, 0] }}
            dragConfig={{ enabled: editMode }}
            resizeConfig={{ enabled: editMode }}
          >
            {layoutVisivel.map((item) => {
              const id = item.i as WidgetId;
              return (
                <div key={id} className="overflow-hidden rounded-xl">
                  <div className="relative h-full">
                    {editMode && (
                      <>
                        <div className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-brand/5 ring-2 ring-brand/40" />
                        <button
                          type="button"
                          onClick={() => onHideWidget(id)}
                          className="pointer-events-auto absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm hover:text-foreground"
                          aria-label="Esconder widget"
                          title="Esconder widget"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <div
                      className={cn(
                        "h-full overflow-y-auto",
                        editMode && "pointer-events-none select-none",
                      )}
                    >
                      {renderWidget(id)}
                    </div>
                  </div>
                </div>
              );
            })}
          </GridLayout>
        )}
      </div>
    </>
  );
}
