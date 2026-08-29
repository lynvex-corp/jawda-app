import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PlayCircle, Award, BookOpen, CheckCircle2, Lock } from "lucide-react";

const trilhas = [
  {
    id: 1,
    mod: "Módulo 1",
    titulo: "Não Conformidades",
    aulas: 8,
    duracao: "1h 20min",
    progresso: 100,
    certificado: true,
  },
  {
    id: 2,
    mod: "Módulo 2",
    titulo: "Planos de Ação (PDCA e 5W2H)",
    aulas: 6,
    duracao: "55min",
    progresso: 75,
    certificado: false,
  },
  {
    id: 3,
    mod: "Módulo 3",
    titulo: "Auditorias Internas",
    aulas: 10,
    duracao: "2h 05min",
    progresso: 40,
    certificado: false,
  },
  {
    id: 4,
    mod: "Módulo 4",
    titulo: "Indicadores e KPIs",
    aulas: 7,
    duracao: "1h 10min",
    progresso: 20,
    certificado: false,
  },
  {
    id: 5,
    mod: "Módulo 5",
    titulo: "Riscos e Oportunidades",
    aulas: 5,
    duracao: "45min",
    progresso: 0,
    certificado: false,
  },
  {
    id: 6,
    mod: "Módulo 6",
    titulo: "Documentos e Comunicações",
    aulas: 6,
    duracao: "1h",
    progresso: 0,
    certificado: false,
  },
  {
    id: 7,
    mod: "Módulo 7",
    titulo: "Estratégia e Contexto (SWOT)",
    aulas: 4,
    duracao: "35min",
    progresso: 0,
    certificado: false,
  },
  {
    id: 8,
    mod: "Módulo 8",
    titulo: "Pessoas e Competências",
    aulas: 5,
    duracao: "50min",
    progresso: 0,
    certificado: false,
  },
];

export function TreinamentosPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jáwda Academy</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trilhas de capacitação para dominar a plataforma e o Sistema de Gestão da Qualidade.
          </p>
        </div>

        <Card className="overflow-hidden rounded-xl border-border">
          <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col justify-center gap-4 p-8">
              <Badge className="w-fit bg-brand-soft text-brand hover:bg-brand-soft">
                Comece por aqui
              </Badge>
              <h2 className="text-2xl font-semibold tracking-tight">O que é o Jáwda?</h2>
              <p className="text-sm text-muted-foreground">
                Uma visão geral de 6 minutos sobre como a plataforma organiza a gestão de
                conformidade, da estratégia à execução — passando por não conformidades, auditorias
                e indicadores.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button className="gap-2 bg-brand text-brand-foreground hover:bg-brand/90">
                  <PlayCircle className="h-4 w-4" /> Assistir introdução
                </Button>
                <span className="text-xs text-muted-foreground">6 min · Legendado</span>
              </div>
            </div>
            <div className="relative flex min-h-[220px] items-center justify-center bg-gradient-to-br from-brand to-brand/70 text-brand-foreground">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: "radial-gradient(circle at 30% 30%, white 0, transparent 40%)",
                }}
              />
              <button className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-brand shadow-lg transition hover:scale-105">
                <PlayCircle className="h-10 w-10" />
              </button>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Trilhas por módulo</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Award className="h-4 w-4 text-brand" />
            <span>
              {trilhas.filter((t) => t.certificado).length} de {trilhas.length} certificados
              conquistados
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trilhas.map((t) => {
            const bloqueada = t.progresso === 0 && t.id > 4;
            return (
              <Card key={t.id} className="rounded-xl border-border transition hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                        {t.mod}
                      </div>
                      <CardTitle className="mt-1 text-base">{t.titulo}</CardTitle>
                    </div>
                    {t.certificado ? (
                      <div className="flex flex-col items-center gap-0.5 rounded-lg bg-[color:var(--severity-low)]/15 px-2 py-1 text-[color:var(--severity-low)]">
                        <Award className="h-5 w-5" />
                        <span className="text-[9px] font-bold uppercase">Certificado</span>
                      </div>
                    ) : bloqueada ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" /> {t.aulas} aulas
                    </span>
                    <span>· {t.duracao}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{t.progresso}%</span>
                    </div>
                    <Progress value={t.progresso} className="h-2" />
                  </div>
                  <Button
                    variant={t.progresso === 100 ? "outline" : "default"}
                    className="w-full gap-2"
                  >
                    {t.progresso === 100 ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Revisar
                      </>
                    ) : t.progresso > 0 ? (
                      "Continuar"
                    ) : bloqueada ? (
                      "Bloqueada"
                    ) : (
                      "Iniciar"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
