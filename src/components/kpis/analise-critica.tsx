import { useState } from "react";
import { toast } from "sonner";
import { FileDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { semaforo, progressoObjetivo } from "@/lib/kpi-data";
import {
  useCriticalAnalysisPeriods,
  useGenerateConsolidation,
  useNcsByIndicatorIds,
} from "@/lib/queries/indicator-measurements";
import type { QualityObjective, Indicator } from "@/lib/queries/indicators";
import type { Measurement } from "@/lib/queries/indicator-measurements";
import { Sparkline } from "./shared";
import { getErrorMessage } from "@/lib/utils";

export function AnaliseCritica({
  indicadores,
  medicoesPorIndicador,
  objetivos,
}: {
  indicadores: Indicator[];
  medicoesPorIndicador: Record<string, Measurement[]>;
  objetivos: QualityObjective[];
}) {
  const { data: consolidacoes = [] } = useCriticalAnalysisPeriods();
  const gerarConsolidacao = useGenerateConsolidation();

  const [periodo, setPeriodo] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [texto, setTexto] = useState("");
  const [decisoes, setDecisoes] = useState("");
  const [sugestao, setSugestao] = useState<string | null>(null);
  const [usouIA, setUsouIA] = useState(false);

  const ultimoValor = (id: string) => {
    const m = medicoesPorIndicador[id];
    return m?.length ? m[m.length - 1].valor : null;
  };

  const verdes = indicadores.filter((k) => semaforo(ultimoValor(k.id), k) === "verde");
  const vermelhos = indicadores.filter((k) => semaforo(ultimoValor(k.id), k) === "vermelho");
  const { data: ncsGeradas = [] } = useNcsByIndicatorIds(vermelhos.map((k) => k.id));

  function gerarSugestao() {
    setSugestao(
      `No período informado, foram monitorados ${indicadores.length} indicadores, dos quais ${verdes.length} atingiram a meta e ${vermelhos.length} permaneceram fora. Os desvios relevantes concentram-se nos indicadores em atenção listados abaixo. Recomenda-se priorizar recursos para tratar as causas registradas nas análises críticas de cada medição e revisar metas que se mostrarem consistentemente fora do alcance no próximo ciclo.`,
    );
  }

  function salvarConsolidacao() {
    if (!periodo.trim() || !inicio || !fim) {
      toast.error("Informe rótulo do período, data de início e data de fim.");
      return;
    }
    if (!texto.trim()) {
      toast.error("Preencha o campo de análise crítica antes de gerar a consolidação.");
      return;
    }
    gerarConsolidacao.mutate(
      {
        periodo,
        inicio,
        fim,
        analiseGeral: texto,
        decisoesDirecao: decisoes || undefined,
        aiSuggested: usouIA,
      },
      {
        onSuccess: () =>
          toast.success("Consolidação gerada para o período", { description: periodo }),
        onError: (err) =>
          toast.error("Não foi possível gerar a consolidação", {
            description: getErrorMessage(err),
          }),
      },
    );
  }

  return (
    <div className="space-y-5">
      <Bloco titulo="Período da análise crítica">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Rótulo do período</Label>
            <Input
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="ex. 1º semestre 2026"
              className="rounded-lg text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Início</Label>
            <Input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="rounded-lg text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Fim</Label>
            <Input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="rounded-lg text-sm"
            />
          </div>
        </div>
        {consolidacoes.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Consolidações anteriores
            </p>
            {consolidacoes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-[11px]"
              >
                <span className="font-medium text-foreground">{c.periodo}</span>
                <Badge variant="outline" className="rounded-md text-[10px]">
                  {c.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Bloco>

      <Bloco titulo="Panorama geral">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { l: "indicadores ativos", v: indicadores.length, c: "var(--brand)" },
            { l: "atingiram a meta", v: verdes.length, c: "var(--success)" },
            { l: "fora da meta", v: vermelhos.length, c: "var(--danger-deep)" },
          ].map((c) => (
            <Card key={c.l} className="rounded-xl border-border/80">
              <CardContent className="p-4">
                <p className="text-3xl font-bold" style={{ color: c.c }}>
                  {c.v}
                </p>
                <p className="text-[11px] text-muted-foreground">{c.l}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Objetivos da qualidade e grau de atendimento">
        <div className="space-y-2">
          {objetivos.map((o) => {
            const filhos = indicadores.filter((k) => k.objetivoId === o.id);
            const prog = progressoObjetivo(
              filhos.map((k) => ({
                valor: ultimoValor(k.id),
                meta: k.meta,
                polaridade: k.polaridade,
              })),
            );
            const cor =
              prog >= 100 ? "var(--success)" : prog >= 85 ? "var(--warning)" : "var(--danger-deep)";
            return (
              <div
                key={o.id}
                className="flex items-center gap-3 rounded-xl border border-border/70 p-3"
              >
                <span className="h-3 w-3 rounded-full" style={{ background: cor }} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {o.nome}
                </span>
                <span className="w-40">
                  <Progress value={Math.min(100, prog)} className="h-2" />
                </span>
                <span className="w-12 text-right text-xs font-semibold" style={{ color: cor }}>
                  {prog}%
                </span>
              </div>
            );
          })}
        </div>
      </Bloco>

      <Bloco titulo="Indicadores em destaque positivo">
        <div className="grid gap-3 md:grid-cols-3">
          {verdes.map((k) => (
            <Card
              key={k.id}
              className="rounded-xl border-[color:var(--success)]/30 bg-[color:var(--success)]/5"
            >
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-semibold text-foreground">{k.nome}</p>
                <p className="text-xl font-bold text-[color:var(--success)]">
                  {ultimoValor(k.id)}
                  {k.unidade}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  meta {k.meta}
                  {k.unidade} · {k.processo ?? k.objetivoNome}
                </p>
                <Sparkline
                  valores={(medicoesPorIndicador[k.id] ?? []).map((m) => m.valor)}
                  cor="var(--success)"
                />
              </CardContent>
            </Card>
          ))}
          {!verdes.length && (
            <p className="col-span-full text-xs text-muted-foreground">
              Nenhum indicador em destaque no momento.
            </p>
          )}
        </div>
      </Bloco>

      <Bloco titulo="Indicadores em atenção">
        <div className="grid gap-3 md:grid-cols-3">
          {vermelhos.map((k) => {
            const ultima = medicoesPorIndicador[k.id]?.[medicoesPorIndicador[k.id].length - 1];
            const nc = ncsGeradas.find((n) => n.indicator_id === k.id);
            return (
              <Card
                key={k.id}
                className="rounded-xl border-[color:var(--danger-deep)]/30 bg-[color:var(--danger-deep)]/5"
              >
                <CardContent className="space-y-1.5 p-4">
                  <p className="text-xs font-semibold text-foreground">{k.nome}</p>
                  <p className="text-xl font-bold text-[color:var(--danger-deep)]">
                    {ultimoValor(k.id)}
                    {k.unidade}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {ultima?.analise ??
                      "Análise crítica pendente de registro para o último período."}
                  </p>
                  {nc && (
                    <Badge
                      variant="outline"
                      className="rounded-md border-[color:var(--danger-deep)]/30 text-[10px] text-[color:var(--danger-deep)]"
                    >
                      NC gerada: {nc.code}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {!vermelhos.length && (
            <p className="col-span-full text-xs text-muted-foreground">
              Nenhum indicador fora da meta no momento.
            </p>
          )}
        </div>
      </Bloco>

      <Bloco titulo="Campo de análise crítica">
        <div className="space-y-2">
          <Textarea
            rows={6}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setUsouIA(false);
            }}
            placeholder="Registre a análise crítica do período…"
            className="rounded-xl text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-lg" onClick={gerarSugestao}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Sugerir análise com IA
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={salvarConsolidacao}
              disabled={gerarConsolidacao.isPending}
            >
              Gerar consolidação
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => toast.success("PDF da análise crítica gerado")}
            >
              <FileDown className="mr-1.5 h-4 w-4" /> Exportar PDF
            </Button>
          </div>
          {sugestao && (
            <Card className="rounded-xl border-brand/30 bg-brand-soft/40">
              <CardContent className="space-y-2 p-4">
                <Badge
                  variant="outline"
                  className="rounded-md border-brand/30 bg-background text-[10px] text-brand"
                >
                  Sugestão de IA — deve ser analisada e aprovada
                </Badge>
                <p className="text-[11px] leading-relaxed text-foreground">{sugestao}</p>
                <Button
                  size="sm"
                  className="rounded-lg bg-brand text-white hover:bg-brand/90"
                  onClick={() => {
                    setTexto(sugestao);
                    setUsouIA(true);
                    setSugestao(null);
                  }}
                >
                  Usar esta análise
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </Bloco>

      <Bloco titulo="Decisões da direção">
        <Textarea
          rows={5}
          value={decisoes}
          onChange={(e) => setDecisoes(e.target.value)}
          placeholder="Mudanças no SGQ, oportunidades de melhoria e recursos necessários…"
          className="rounded-xl text-sm"
        />
      </Bloco>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border/80 shadow-sm">
      <CardContent className="space-y-3 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-brand">{titulo}</h2>
        {children}
      </CardContent>
    </Card>
  );
}
