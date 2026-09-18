import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLatestQualityCultureIndicator } from "@/lib/queries/quality-culture";

/** Indicador estratégico (item 5, Bloco 6) — visível só para quem tem
 * governança da qualidade (mesma régua de useAuth().currentOrg.role já
 * usada em ReconhecimentoPanel). É através dele que a maturidade do
 * sistema de gestão é comprovada ao longo do tempo, por isso fica na
 * Gestão à Vista, não só dentro de Estratégia. */
export function CulturaDaQualidadeIndicador() {
  const { data } = useLatestQualityCultureIndicator();

  if (!data) return null;

  const tone =
    data.maturidadeGeral === null
      ? "text-muted-foreground"
      : data.maturidadeGeral >= 75
        ? "text-[color:var(--success)]"
        : data.maturidadeGeral >= 50
          ? "text-[color:var(--severity-high)]"
          : "text-[color:var(--severity-critical)]";

  return (
    <Link to="/cultura-da-qualidade" className="block">
      <Card className="rounded-xl border-border/80 shadow-sm transition-colors hover:border-brand/40">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cultura da Qualidade
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {data.totalRespostas > 0
                  ? `${data.totalRespostas} resposta(s) na última rodada`
                  : "Rodada programada, sem resposta ainda"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-3xl font-semibold tracking-tight", tone)}>
              {data.maturidadeGeral === null ? "—" : `${data.maturidadeGeral}%`}
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
