import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendencias, type Pendencia } from "@/lib/queries/pendencias";
import { cn } from "@/lib/utils";

/* ============================================================
 * Quadro de Pendências — tudo que está em aberto, num lugar só.
 *
 * Cada linha leva ao registro de origem. Categoria sem item não é
 * renderizada: a decisão está explicada em `queries/pendencias.ts` — se a
 * RLS não devolveu nada porque o perfil não alcança aquela fonte, anunciar
 * "0" mentiria para o usuário.
 * ============================================================ */

function formatarData(iso: string | null): string | null {
  if (!iso) return null;
  // `date` puro (YYYY-MM-DD) precisa de hora fixa, senão o fuso joga o dia
  // para trás na renderização.
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR");
}

function LinhaPendencia({ item }: { item: Pendencia }) {
  const data = formatarData(item.prazo);

  return (
    <Link
      to={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        item.vencida
          ? "border-[color:var(--severity-critical)]/30 bg-[color:var(--severity-critical)]/5 hover:bg-[color:var(--severity-critical)]/10"
          : "border-border/60 hover:bg-brand-soft/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{item.titulo}</span>
          {item.vencida && (
            <Badge
              variant="outline"
              className="shrink-0 rounded-md border-[color:var(--severity-critical)]/30 bg-[color:var(--severity-critical)]/10 text-[10px] text-[color:var(--severity-critical)]"
            >
              Vencida
            </Badge>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.detalhe}</div>
      </div>
      {data && (
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            item.vencida
              ? "font-medium text-[color:var(--severity-critical)]"
              : "text-muted-foreground",
          )}
        >
          {data}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function QuadroPendencias() {
  const { data: grupos, isLoading, isError } = usePendencias();

  const total = grupos?.reduce((s, g) => s + g.itens.length, 0) ?? 0;
  const vencidas = grupos?.reduce((s, g) => s + g.vencidas, 0) ?? 0;

  return (
    <Card className="rounded-xl border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">Pendências</CardTitle>
            <CardDescription className="mt-1 text-xs">
              Tudo que está em aberto e depende de você, reunido num só lugar.
            </CardDescription>
          </div>
          {!isLoading && !isError && total > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-md text-xs">
                {total} {total === 1 ? "item" : "itens"}
              </Badge>
              {vencidas > 0 && (
                <Badge
                  variant="outline"
                  className="rounded-md border-[color:var(--severity-critical)]/30 bg-[color:var(--severity-critical)]/10 text-xs text-[color:var(--severity-critical)]"
                >
                  {vencidas} {vencidas === 1 ? "vencida" : "vencidas"}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-[color:var(--severity-critical)]/40 p-4 text-center text-sm text-muted-foreground">
            Não foi possível carregar as pendências.
          </div>
        )}

        {!isLoading && !isError && total === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 p-6 text-center">
            <CheckCircle2 className="h-6 w-6 text-[color:var(--success)]" />
            <p className="text-sm font-medium text-foreground">Nenhuma pendência em aberto</p>
            <p className="text-xs text-muted-foreground">
              Assim que algo precisar de atenção, aparece aqui.
            </p>
          </div>
        )}

        {!isLoading &&
          !isError &&
          grupos?.map((g) => (
            <div key={g.categoria} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </h3>
                <Badge variant="secondary" className="rounded-md text-[10px]">
                  {g.itens.length}
                </Badge>
                {g.vencidas > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-[color:var(--severity-critical)]">
                    <AlertTriangle className="h-3 w-3" />
                    {g.vencidas} vencida{g.vencidas === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {g.itens.map((item) => (
                  <LinhaPendencia key={`${item.categoria}:${item.id}`} item={item} />
                ))}
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
