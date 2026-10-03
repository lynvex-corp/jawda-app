import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, Plus } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PROBLEM_SOLUTION_STATUS_LABEL,
  useProblemSolutions,
} from "@/lib/queries/problem-solutions";

export function SolucoesProblemasPage() {
  const { data: solucoes = [], isLoading, isError } = useProblemSolutions();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Link
              to="/nao-conformidades"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Não Conformidades
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Soluções de Problemas
            </h1>
            <p className="text-sm text-muted-foreground">
              Metodologia A3 para problemas com causa a investigar e que pedem um pequeno projeto
              para resolver.
            </p>
          </div>
          <Button asChild className="rounded-lg bg-sp text-sp-foreground hover:bg-sp/90">
            <Link to="/nao-conformidades/solucoes/nova">
              <Plus className="mr-1 h-4 w-4" /> Nova Solução de Problema
            </Link>
          </Button>
        </div>

        <Card className="rounded-xl border-border/80 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : isError ? (
              <div className="py-12 text-center text-sm text-[color:var(--severity-critical)]">
                Não foi possível carregar as soluções de problemas.
              </div>
            ) : solucoes.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma solução de problemas ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Título</th>
                      <th className="px-4 py-3">NC de origem</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Criada em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solucoes.map((s) => (
                      <tr key={s.id} className="border-t border-border/60 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">
                          <Link
                            to="/nao-conformidades/solucoes/$id"
                            params={{ id: s.id }}
                            className="text-sp hover:underline"
                          >
                            {s.code}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{s.title}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.nc_origin?.code ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="border-sp/30 bg-sp-soft text-sp">
                            {PROBLEM_SOLUTION_STATUS_LABEL[s.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {format(new Date(s.created_at), "dd/MM/yyyy")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
