import { History, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Peças reutilizáveis do padrão "documento formal versionado" (seção 21.5
 * do Guia de Arquitetura) — usado agora em 5 sub-abas de Estratégia
 * (SWOT, Partes Interessadas, Escopo do Sistema, Análise Crítica pela
 * Direção, Missão/Visão/Valores/Propósito). Extraído aqui na 5ª repetição
 * em vez de duplicar de novo, por pedido explícito do prompt desta aba. */

/** Faixa "somente leitura" mostrada no topo da tela quando o documento não
 * está mais em rascunho. O texto varia por sub-aba (cada uma tem sua
 * própria regra de quando trava e como reabrir), por isso fica como
 * children em vez de prop de texto fixo. */
export function LockedDocumentBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
      <Lock className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

export interface VersionHistoryEntry {
  id: string;
  label: string;
  date: string | null;
  byName?: string | null;
  snippet?: string;
}

/** Lista pura (sem Card em volta) — para quando o histórico já vive dentro
 * de outro card (ex.: seção "Contexto" da Análise de Cenário). `compact` é
 * o formato enxuto (rótulo + data); o formato completo mostra um trecho do
 * conteúdo e quem aprovou. */
export function VersionHistoryList({
  title = "Versões formalizadas",
  entries,
  emptyMessage = "Nenhuma versão formalizada ainda.",
  compact = false,
  showTitle = true,
}: {
  title?: string;
  entries: VersionHistoryEntry[];
  emptyMessage?: string;
  compact?: boolean;
  showTitle?: boolean;
}) {
  return (
    <div>
      {showTitle && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <History className="h-3.5 w-3.5" /> {title}
        </div>
      )}
      {entries.length === 0 && <p className="text-[11px] text-muted-foreground">{emptyMessage}</p>}
      <ol className={cn(compact ? "space-y-1.5" : "space-y-3")}>
        {entries.map((e, idx) =>
          compact ? (
            <li
              key={e.id}
              className="flex items-center justify-between text-[11px] text-muted-foreground"
            >
              <span className="font-medium text-foreground">{e.label}</span>
              <span>{e.date ? new Date(e.date).toLocaleDateString("pt-BR") : ""}</span>
            </li>
          ) : (
            <li
              key={e.id}
              className={cn(
                "rounded-lg border p-2.5",
                idx === 0 ? "border-brand/40 bg-brand-soft/40" : "border-border/60",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-brand">{e.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {e.date ? new Date(e.date).toLocaleDateString("pt-BR") : ""}
                </span>
              </div>
              {e.snippet && (
                <p className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">{e.snippet}</p>
              )}
              {e.byName && (
                <div className="mt-1 text-[10px] text-muted-foreground/80">por {e.byName}</div>
              )}
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

/** Mesma lista, envolvida num Card próprio — para quando o histórico é uma
 * seção independente da tela (Escopo, Partes Interessadas, Análise Crítica,
 * Missão/Visão/Valores). */
export function VersionHistoryCard(props: Parameters<typeof VersionHistoryList>[0]) {
  return (
    <Card className="rounded-2xl border-border/80 shadow-sm">
      <CardContent className="p-4">
        <VersionHistoryList {...props} title={props.title ?? "Versões formalizadas"} showTitle />
      </CardContent>
    </Card>
  );
}
