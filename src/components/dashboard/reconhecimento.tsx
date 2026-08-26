import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, ShieldCheck, Check, Award, Crown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RECONHECIMENTO_PERIODO_OPTIONS,
  useNCIdentificationRanking,
  useMelhoriaRanking,
  useActiveBadges,
  type ReconhecimentoPeriodo,
  type RankingEntry,
  type BadgeType,
} from "@/lib/queries/reconhecimento";

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

interface RankingCardProps {
  titulo: string;
  descricao: string;
  unidade: string;
  rodape: string;
  useRanking: (periodo: ReconhecimentoPeriodo) => { data?: RankingEntry[]; isLoading: boolean };
}

function RankingCard({ titulo, descricao, unidade, rodape, useRanking }: RankingCardProps) {
  const [periodo, setPeriodo] = useState<ReconhecimentoPeriodo>("mes");
  const { data: ranking = [], isLoading } = useRanking(periodo);

  return (
    <Card className="rounded-xl border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-[color:var(--warning)]" />
              <CardTitle className="text-base font-semibold">{titulo}</CardTitle>
            </div>
            <CardDescription className="mt-1 max-w-md text-xs leading-relaxed">
              {descricao}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-1">
            {RECONHECIMENTO_PERIODO_OPTIONS.map((p) => (
              <Button
                key={p.value}
                variant={periodo === p.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPeriodo(p.value)}
                className={cn(
                  "h-7 px-2.5 text-xs",
                  periodo === p.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2">
          {ranking.map((p, idx) => {
            const isFirst = idx === 0;
            return (
              <li
                key={p.userId}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-brand-soft/40",
                  isFirst
                    ? "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/5"
                    : "border-border/60 bg-transparent",
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isFirst
                      ? "bg-[color:var(--warning)]/15 text-[color:var(--severity-high)]"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {isFirst ? <Crown className="h-3.5 w-3.5" /> : <span>{idx + 1}</span>}
                </div>
                <Avatar className="h-9 w-9 border border-border/60">
                  <AvatarFallback
                    className={cn(
                      "text-xs font-semibold",
                      isFirst
                        ? "bg-[color:var(--warning)]/15 text-[color:var(--severity-high)]"
                        : "bg-brand-soft text-brand",
                    )}
                  >
                    {iniciais(p.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {p.fullName}
                    </span>
                    {isFirst && (
                      <Badge
                        variant="outline"
                        className="hidden border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[color:var(--severity-high)] sm:inline-flex"
                      >
                        Destaque
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold leading-none text-foreground">
                    {p.count}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{unidade}</div>
                </div>
              </li>
            );
          })}
          {!isLoading && ranking.length === 0 && (
            <li className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              Nenhum registro neste período.
            </li>
          )}
        </ul>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-success" />
          <span>{rodape}</span>
        </div>
      </CardContent>
    </Card>
  );
}

const badgeMeta: Record<BadgeType, { label: string; icon: typeof ShieldCheck; tone: string }> = {
  sem_nc_critica: {
    label: "Sem NC crítica",
    icon: ShieldCheck,
    tone: "bg-[color:var(--severity-high)]/12 text-[color:var(--severity-high)]",
  },
  zero_planos_vencidos: {
    label: "Planos de ação em dia",
    icon: Check,
    tone: "bg-[color:var(--success)]/12 text-[color:var(--success)]",
  },
  treinamentos_no_prazo: {
    label: "Treinamentos no prazo",
    icon: Award,
    tone: "bg-[color:var(--warning)]/12 text-[color:var(--severity-high)]",
  },
};

function ConquistasCard() {
  const { data: badges = [], isLoading } = useActiveBadges();

  return (
    <Card className="rounded-xl border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-brand" />
          <CardTitle className="text-base font-semibold">Conquistas da Qualidade</CardTitle>
        </div>
        <CardDescription className="mt-1 text-xs">
          Selos ativos por setor — reconhecimento coletivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          {badges.map((b) => {
            const meta = badgeMeta[b.badgeType];
            const Icon = meta.icon;
            const label = b.unitName ? `${meta.label} — ${b.unitName}` : meta.label;
            return (
              <div
                key={`${b.badgeType}:${b.unitId ?? "org"}`}
                className="relative flex flex-col items-start gap-2 rounded-lg border border-border/80 bg-card p-3"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md",
                        meta.tone,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-md border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]"
                  >
                    Ativo
                  </Badge>
                </div>
                {b.recentBreak && (
                  <div className="text-[11px] text-muted-foreground">
                    Sequência encerrada em{" "}
                    {new Date(b.recentBreak.brokenAt).toLocaleDateString("pt-BR")} —{" "}
                    {b.recentBreak.streakDaysAtBreak} dias
                  </div>
                )}
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Flame className="h-3 w-3" />
                  há {b.streakDays} {b.streakDays === 1 ? "dia" : "dias"}
                </div>
              </div>
            );
          })}
          {!isLoading && badges.length === 0 && (
            <div className="col-span-2 rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              Nenhum selo iniciado ainda.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReconhecimentoPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <RankingCard
        titulo="Olho Vivo da Qualidade"
        descricao="Pessoas que mais contribuem identificando problemas antes que virem prejuízo."
        unidade="NCs"
        rodape="Identificar cedo é cuidar. Cada registro aqui evita um prejuízo."
        useRanking={useNCIdentificationRanking}
      />
      <RankingCard
        titulo="Motor da Melhoria"
        descricao="Pessoas que mais registram melhorias de processo — quem propõe faz a empresa avançar."
        unidade="Melhorias"
        rodape="Cada melhoria registrada é um passo a mais na cultura de qualidade."
        useRanking={useMelhoriaRanking}
      />
      <ConquistasCard />
    </div>
  );
}
