import { useMemo, useState } from "react";
import {
  Plus,
  Upload,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ListFilter,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/app/searchable-select";
import { useOrgMembers } from "@/lib/queries/action-plans";
import { useIndicators, useQualityObjectives } from "@/lib/queries/indicators";
import { useIndicatorMeasurements, type Measurement } from "@/lib/queries/indicator-measurements";
import { processosKpi, semaforo, type BibliotecaItem, type SemaforoKpi } from "@/lib/kpi-data";
import { KpiCard } from "./shared";
import { LoteDialog } from "./lote-dialog";
import { NovoIndicadorDialog } from "./wizard-dialog";
import { BibliotecaDialog, EscolhaCriacaoDialog } from "./biblioteca-dialog";
import { ObjetivosTab } from "./objetivos-tab";
import { AnaliseCritica } from "./analise-critica";
import { TabelaIndicadores } from "./tabela-indicadores";
import { cn } from "@/lib/utils";

type FiltroCard = "todos" | SemaforoKpi;

export function IndicadoresModule() {
  const { data: indicadores = [] } = useIndicators();
  const { data: objetivos = [] } = useQualityObjectives();
  const { data: todasMedicoes = [] } = useIndicatorMeasurements();
  const { data: membros = [] } = useOrgMembers();

  const medicoesPorIndicador = useMemo(() => {
    const map: Record<string, Measurement[]> = {};
    for (const m of todasMedicoes) (map[m.indicatorId] ??= []).push(m);
    return map;
  }, [todasMedicoes]);

  const [tab, setTab] = useState("painel");
  const [filtroCard, setFiltroCard] = useState<FiltroCard | null>(null);
  const [fProcesso, setFProcesso] = useState("all");
  const [fObjetivo, setFObjetivo] = useState("all");
  const [fResp, setFResp] = useState("all");
  const [soFora, setSoFora] = useState(false);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);

  const [escolhaOpen, setEscolhaOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [bibliotecaOpen, setBibliotecaOpen] = useState(false);
  const [loteOpen, setLoteOpen] = useState(false);
  const [preset, setPreset] = useState<BibliotecaItem | null>(null);
  const [objetivoPadrao, setObjetivoPadrao] = useState<string | undefined>();

  const ativos = indicadores.filter((k) => !k.arquivado);
  const arquivados = indicadores.filter((k) => k.arquivado);

  const ultimoValor = (id: string) => {
    const m = medicoesPorIndicador[id];
    return m?.length ? m[m.length - 1].valor : null;
  };

  const base = useMemo(
    () =>
      ativos.filter(
        (k) =>
          (fProcesso === "all" || k.processo === fProcesso) &&
          (fObjetivo === "all" || k.objetivoId === fObjetivo) &&
          (fResp === "all" || k.responsavelMedicaoId === fResp),
      ),
    [ativos, fProcesso, fObjetivo, fResp],
  );

  const contagem = {
    total: base.length,
    verde: base.filter((k) => semaforo(ultimoValor(k.id), k) === "verde").length,
    amarelo: base.filter((k) => semaforo(ultimoValor(k.id), k) === "amarelo").length,
    vermelho: base.filter((k) => semaforo(ultimoValor(k.id), k) === "vermelho").length,
  };

  const filtrados = base.filter(
    (k) => !filtroCard || filtroCard === "todos" || semaforo(ultimoValor(k.id), k) === filtroCard,
  );

  const cards = [
    {
      key: "todos" as const,
      label: "Total de indicadores",
      valor: contagem.total,
      sub: "ativos",
      icon: Gauge,
      cor: "var(--brand)",
    },
    {
      key: "verde" as const,
      label: "Atingindo a meta",
      valor: contagem.verde,
      sub: `${contagem.total ? Math.round((contagem.verde / contagem.total) * 100) : 0}% do total`,
      icon: CheckCircle2,
      cor: "var(--success)",
    },
    {
      key: "amarelo" as const,
      label: "Em atenção",
      valor: contagem.amarelo,
      sub: "próximos de estourar",
      icon: AlertTriangle,
      cor: "var(--warning)",
    },
    {
      key: "vermelho" as const,
      label: "Fora da meta",
      valor: contagem.vermelho,
      sub: "requer análise crítica",
      icon: XCircle,
      cor: "var(--danger-deep)",
    },
  ];

  function abrirCriacao() {
    setPreset(null);
    setObjetivoPadrao(undefined);
    setEscolhaOpen(true);
  }

  const filtrosBar = (
    <div className="flex flex-wrap items-center gap-2">
      <ListFilter className="h-4 w-4 text-muted-foreground" />
      <SearchableSelect
        value={fProcesso}
        onValueChange={setFProcesso}
        placeholder="Processo"
        searchPlaceholder="Buscar processo…"
        emptyMessage="Nenhum processo encontrado."
        className="h-9 w-[150px] rounded-lg text-xs"
        options={[
          { value: "all", label: "Todos os processos" },
          ...processosKpi.map((p) => ({ value: p, label: p })),
        ]}
      />
      <SearchableSelect
        value={fObjetivo}
        onValueChange={setFObjetivo}
        placeholder="Objetivo"
        searchPlaceholder="Buscar objetivo…"
        emptyMessage="Nenhum objetivo encontrado."
        className="h-9 w-[190px] rounded-lg text-xs"
        options={[
          { value: "all", label: "Todos os objetivos" },
          ...objetivos.map((o) => ({ value: o.id, label: o.nome })),
        ]}
      />
      <SearchableSelect
        value={fResp}
        onValueChange={setFResp}
        placeholder="Responsável"
        searchPlaceholder="Buscar por nome…"
        emptyMessage="Nenhum responsável encontrado."
        className="h-9 w-[160px] rounded-lg text-xs"
        options={[
          { value: "all", label: "Todos responsáveis" },
          ...[...membros]
            .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"))
            .map((m) => ({ value: m.id, label: m.fullName })),
        ]}
      />
    </div>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Indicadores</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre o indicador com sua meta, lance as medições do período e acompanhe o
              resultado frente ao objetivo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
              onClick={abrirCriacao}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Novo Indicador
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => setLoteOpen(true)}
            >
              <Upload className="mr-1.5 h-4 w-4" /> Lançar medição em lote
            </Button>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="space-y-5">
          <TabsList className="rounded-xl">
            <TabsTrigger value="painel" className="rounded-lg text-xs">
              Painel
            </TabsTrigger>
            <TabsTrigger value="meus" className="rounded-lg text-xs">
              Meus indicadores
            </TabsTrigger>
            <TabsTrigger value="objetivos" className="rounded-lg text-xs">
              Objetivos da qualidade
            </TabsTrigger>
            <TabsTrigger value="analise" className="rounded-lg text-xs">
              Análise crítica
            </TabsTrigger>
          </TabsList>

          {/* ---------- PAINEL ---------- */}
          <TabsContent value="painel" className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((c) => {
                const ativo = filtroCard === c.key;
                const Icon = c.icon;
                return (
                  <button
                    key={c.key}
                    onClick={() => setFiltroCard(ativo ? null : c.key)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      ativo
                        ? "border-transparent bg-[color:var(--danger-deep)] text-white shadow-md"
                        : "border-border/80 bg-card hover:-translate-y-0.5 hover:shadow-md",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p
                        className={cn(
                          "text-[11px] font-medium",
                          ativo ? "text-white/80" : "text-muted-foreground",
                        )}
                      >
                        {c.label}
                      </p>
                      <Icon className="h-4 w-4" style={{ color: ativo ? "white" : c.cor }} />
                    </div>
                    <p
                      className="mt-2 text-3xl font-bold"
                      style={{ color: ativo ? "white" : c.cor }}
                    >
                      {c.valor}
                    </p>
                    <p
                      className={cn(
                        "text-[10px]",
                        ativo ? "text-white/70" : "text-muted-foreground",
                      )}
                    >
                      {c.sub}
                    </p>
                  </button>
                );
              })}
            </div>

            {filtrosBar}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtrados.map((k) => (
                <KpiCard key={k.id} indicador={k} medicoes={medicoesPorIndicador[k.id] ?? []} />
              ))}
              {!filtrados.length && (
                <p className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Nenhum indicador para os filtros selecionados.
                </p>
              )}
            </div>
          </TabsContent>

          {/* ---------- MEUS INDICADORES ---------- */}
          <TabsContent value="meus" className="space-y-4">
            {filtrosBar}
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2">
                <Switch id="so-fora" checked={soFora} onCheckedChange={setSoFora} />
                <Label htmlFor="so-fora" className="text-xs text-muted-foreground">
                  Mostrar apenas com meta não atingida
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="arquivados"
                  checked={mostrarArquivados}
                  onCheckedChange={setMostrarArquivados}
                />
                <Label htmlFor="arquivados" className="text-xs text-muted-foreground">
                  Arquivados
                </Label>
              </div>
            </div>
            <TabelaIndicadores
              indicadores={(mostrarArquivados ? arquivados : base).filter(
                (k) => !soFora || ["vermelho", "amarelo"].includes(semaforo(ultimoValor(k.id), k)),
              )}
              medicoesPorIndicador={medicoesPorIndicador}
            />
          </TabsContent>

          {/* ---------- OBJETIVOS ---------- */}
          <TabsContent value="objetivos">
            <ObjetivosTab
              objetivos={objetivos}
              indicadoresAtivos={ativos}
              medicoesPorIndicador={medicoesPorIndicador}
              onCriarIndicadorPara={(objetivoId) => {
                setObjetivoPadrao(objetivoId);
                setPreset(null);
                setWizardOpen(true);
              }}
            />
          </TabsContent>

          {/* ---------- ANÁLISE CRÍTICA ---------- */}
          <TabsContent value="analise">
            <AnaliseCritica
              indicadores={ativos}
              medicoesPorIndicador={medicoesPorIndicador}
              objetivos={objetivos}
            />
          </TabsContent>
        </Tabs>
      </div>

      <EscolhaCriacaoDialog
        open={escolhaOpen}
        onOpenChange={setEscolhaOpen}
        onDoZero={() => {
          setEscolhaOpen(false);
          setWizardOpen(true);
        }}
        onBiblioteca={() => {
          setEscolhaOpen(false);
          setBibliotecaOpen(true);
        }}
      />
      {wizardOpen && (
        <NovoIndicadorDialog
          key={preset?.nome ?? objetivoPadrao ?? "zero"}
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          objetivoPadrao={objetivoPadrao}
          preset={preset}
        />
      )}
      <BibliotecaDialog
        open={bibliotecaOpen}
        onOpenChange={setBibliotecaOpen}
        onAdotar={(item) => {
          setPreset(item);
          setBibliotecaOpen(false);
          setWizardOpen(true);
        }}
      />
      <LoteDialog open={loteOpen} onOpenChange={setLoteOpen} />
    </AppShell>
  );
}
