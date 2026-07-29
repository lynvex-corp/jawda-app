import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Save,
  CalendarIcon,
  UploadCloud,
  X,
  Search,
  FileText,
  Image as ImageIcon,
  Film,
  ShieldAlert,
  BadgeCheck,
  Info,
  Sparkles,
  Plus,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  PartyPopper,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "@tanstack/react-router";

import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  usuariosMock,
  slaPorGravidade,
  severityClasses,
  origensNC,
  origemSiglas,
  ncCodigo,
  setoresOcorrencia,
  guiaGravidadePadrao,
  PREFIXO_NC_PADRAO,
  type Severity,
  type Origem,
  type SetorOcorrencia,
} from "@/lib/mock-data";
import {
  useCreateNC,
  useNCs,
  useUpdateNC,
  type CategoriaNC,
  type NCRecord,
} from "@/lib/queries/ncs";
import { cn } from "@/lib/utils";

const DESCRICAO_EXEMPLOS = [
  "Ex.: Durante a inspeção do lote 245 do dia 12/09, foram identificadas 8 peças fora da especificação de dureza, resultando em segregação do lote e retrabalho.",
  "Ex.: O procedimento PO-QUA-004, revisão 02, não foi seguido na etapa de verificação final, gerando aprovação de peças com dimensão fora da tolerância.",
  "Ex.: Reclamação do cliente Alfa Ltda. registrada em 15/09 sobre atraso de 6 dias na entrega do pedido 8821, sem comunicação prévia.",
];

const STEPS = [
  { n: 1, label: "Identificação", short: "Ident." },
  { n: 2, label: "Classificação", short: "Class." },
  { n: 3, label: "Análise de Causa", short: "Causa" },
  { n: 4, label: "Plano de Ação", short: "Ação" },
  { n: 5, label: "Avaliação de Eficácia", short: "Eficácia" },
];

const CATEGORIAS = ["Qualidade", "Segurança", "Meio Ambiente", "Regulatório", "Financeiro"];
const LOCAIS = ["Produção", "Administrativo", "Serviço", "Outros"];
const ORIGENS: Origem[] = origensNC;

const NC_SEQ = 42;
const NC_ANO = 2026;

const PORQUE_GUIA = [
  "descreva o porquê que relaciona o sintoma",
  "descreva o porquê que relaciona a causa direta",
  "descreva o porquê que relaciona a origem do processo",
  "descreva o porquê que relaciona a falha sistêmica",
  "descreva o porquê que relaciona a causa raiz",
];

/** Monta a pergunta encadeada: a resposta anterior vira a pergunta seguinte */
function perguntaPorque(i: number, respostaAnterior: string, problema: string) {
  const base = i === 0 ? problema.trim() : respostaAnterior.trim();
  const limpo = base
    .replace(/^porque\s+/i, "")
    .replace(/[.]+$/, "")
    .trim();
  if (!limpo) return `${i + 1}º Por quê`;
  return `Por que ${limpo.charAt(0).toLowerCase()}${limpo.slice(1)}?`;
}

interface Evidence {
  id: string;
  name: string;
  size: number;
  kind: "image" | "video" | "document";
  url?: string;
}

function fileKind(name: string, type: string): Evidence["kind"] {
  if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name)) return "image";
  if (type.startsWith("video/") || /\.(mp4|mov|avi|mkv)$/i.test(name)) return "video";
  return "document";
}

function Stepper({ current, completed }: { current: number; completed: Set<number> }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const isDone = completed.has(s.n);
        const isActive = current === s.n;
        return (
          <div key={s.n} className="flex flex-1 items-center gap-2 min-w-[120px]">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  isDone && "border-[color:var(--success)] bg-[color:var(--success)] text-white",
                  !isDone && isActive && "border-brand bg-brand text-brand-foreground",
                  !isDone && !isActive && "border-border bg-card text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : s.n}
              </div>
              <div className="hidden sm:block">
                <div className={cn("text-xs font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                  Etapa {s.n}
                </div>
                <div className={cn("text-sm", isActive ? "text-foreground font-semibold" : "text-muted-foreground")}>
                  {s.label}
                </div>
              </div>
              <div className="sm:hidden">
                <div className={cn("text-xs", isActive ? "text-foreground font-semibold" : "text-muted-foreground")}>
                  {s.short}
                </div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px flex-1", isDone ? "bg-[color:var(--success)]" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SeverityCard({
  sev,
  selected,
  onSelect,
  guia,
  onGuiaChange,
}: {
  sev: Severity;
  selected: boolean;
  onSelect: () => void;
  guia: { definicao: string; exemplo: string; acao: string };
  onGuiaChange: (patch: Partial<{ definicao: string; exemplo: string; acao: string }>) => void;
}) {
  const sla = slaPorGravidade[sev];
  const [editando, setEditando] = useState(false);
  const dotColor: Record<Severity, string> = {
    Baixa: "bg-[color:var(--severity-low)]",
    Média: "bg-[color:var(--severity-medium)]",
    Alta: "bg-[color:var(--severity-high)]",
    Crítica: "bg-[color:var(--severity-critical)]",
  };
  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-all",
        selected
          ? "border-brand ring-2 ring-brand/20 shadow-sm"
          : "border-border/80 hover:border-brand/40 hover:shadow-sm",
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", dotColor[sev])} />
          <span className="text-sm font-semibold">{sev}</span>
        </div>
        {selected && <Check className="h-4 w-4 text-brand" />}
      </button>
      <button type="button" onClick={onSelect} className="text-left">
        <div className="text-xs text-muted-foreground">Prazo para tratativa</div>
        <div className="text-sm font-medium text-foreground">{sla.label}</div>
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-fit gap-1.5 rounded-lg px-2 text-xs text-brand hover:bg-brand-soft"
          >
            <Info className="h-3.5 w-3.5" /> Orientação
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Gravidade {sev}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-lg px-2 text-xs text-brand"
              onClick={() => setEditando((v) => !v)}
            >
              {editando ? "Concluir" : "Personalizar"}
            </Button>
          </div>
          {([
            ["definicao", "Definição"],
            ["exemplo", "Exemplo"],
            ["acao", "Ação"],
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {label}
              </Label>
              {editando ? (
                <Textarea
                  rows={3}
                  value={guia[key]}
                  onChange={(e) => onGuiaChange({ [key]: e.target.value })}
                  className="rounded-lg text-xs"
                />
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">{guia[key]}</p>
              )}
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function UserPicker({
  value,
  onChange,
  placeholder,
}: {
  value: string | undefined;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-lg">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {usuariosMock.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-brand-soft text-brand text-[10px] font-semibold">
                  {u.iniciais}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm">{u.nome}</span>
                <span className="text-[10px] text-muted-foreground">{u.cargo}</span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function NovaNCWizard() {
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [finalizado, setFinalizado] = useState(false);
  const [createdNC, setCreatedNC] = useState<NCRecord | null>(null);
  const createNC = useCreateNC();
  const updateNC = useUpdateNC();
  const { data: allNCs = [] } = useNCs();

  // Step 1
  const [dataOcorrencia, setDataOcorrencia] = useState<Date | undefined>(new Date("2026-07-14"));
  const [local, setLocal] = useState<string>();
  const [origem, setOrigem] = useState<Origem>();
  const [prefixo, setPrefixo] = useState(PREFIXO_NC_PADRAO);
  const [setorOcorrencia, setSetorOcorrencia] = useState<string>();
  const [tipoAcao, setTipoAcao] = useState<"Corretiva" | "Preventiva">("Corretiva");
  const [descricao, setDescricao] = useState("");
  const [exemploIdx] = useState(() => Math.floor(Math.random() * 3));
  const [reincidente, setReincidente] = useState(false);
  const [ncsVinculadas, setNcsVinculadas] = useState<string[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2
  const [gravidade, setGravidade] = useState<Severity | undefined>();
  const [categoria, setCategoria] = useState<string>();
  const [guias, setGuias] = useState(guiaGravidadePadrao);

  // Step 3
  const [causaTool, setCausaTool] = useState<"5porques" | "ishikawa">("5porques");
  const [porques, setPorques] = useState<string[]>(["", "", "", "", ""]);
  const [problemaEfeito, setProblemaEfeito] = useState("");
  const [ameacaFraqueza, setAmeacaFraqueza] = useState<"sim" | "nao" | undefined>();
  const ISHI_CATS = ["Método", "Mão de obra", "Material", "Máquina", "Meio ambiente", "Medição"] as const;
  const [ishikawa, setIshikawa] = useState<Record<string, string[]>>(
    Object.fromEntries(ISHI_CATS.map((c) => [c, [] as string[]])),
  );
  const [ishInputs, setIshInputs] = useState<Record<string, string>>(
    Object.fromEntries(ISHI_CATS.map((c) => [c, ""])),
  );
  const [causaRaiz, setCausaRaiz] = useState("");
  const [causaRaizEditada, setCausaRaizEditada] = useState(false);
  const [revisarRiscos, setRevisarRiscos] = useState(false);

  // Step 4
  const [contDesc, setContDesc] = useState("");
  const [contResp, setContResp] = useState<string>();
  const [contData, setContData] = useState<Date | undefined>();
  const [w5h2, setW5h2] = useState({ what: "", why: "", where: "", who: "", when: "", how: "", howMuch: "" });
  const [resultadoEsperado, setResultadoEsperado] = useState("");

  // Step 5
  const [metodoAval, setMetodoAval] = useState<string>();
  const [avaliador, setAvaliador] = useState<string>();
  const [evidEficacia, setEvidEficacia] = useState<Evidence[]>([]);
  const evidEficaciaRef = useRef<HTMLInputElement>(null);
  const [resultado, setResultado] = useState<"aprovado" | "reprovado" | "reinspecao" | undefined>();
  const [obsFinais, setObsFinais] = useState("");

  function handleEfFiles(files: FileList | null) {
    if (!files) return;
    const next: Evidence[] = Array.from(files).map((f) => {
      const kind = fileKind(f.name, f.type);
      return {
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        size: f.size,
        kind,
        url: kind === "image" ? URL.createObjectURL(f) : undefined,
      };
    });
    setEvidEficacia((prev) => [...prev, ...next]);
  }

  function sugerirCausaIA() {
    setPorques([
      "O peso do lote 4821 ficou fora da tolerância especificada.",
      "A balança BAL-07 apresentava desvio na leitura.",
      "A calibração periódica não foi executada dentro do prazo.",
      "O sistema de controle de calibração não emitiu alerta ao operador.",
      "O checklist de verificação diária não inclui validação de calibração.",
    ]);
    setIshikawa((prev) => ({
      ...prev,
      Método: [...prev["Método"], "Checklist diário incompleto"],
      Máquina: [...prev["Máquina"], "Balança fora de calibração"],
      Medição: [...prev["Medição"], "Sistema não emite alerta"],
    }));
    setCausaRaiz(
      "Falha no processo de gestão da calibração de equipamentos de medição, agravada pela ausência de verificação diária estruturada no checklist de linha.",
    );
    toast.success("Sugestão gerada pela IA", {
      description: "Revise antes de continuar — a análise final é sua responsabilidade.",
    });
  }

  function sugerirPlanoIA() {
    setContDesc(
      "Segregar imediatamente todos os lotes produzidos com a balança BAL-07 no período suspeito e substituir por balança BAL-03 (calibrada).",
    );
    setW5h2({
      what: "Implantar sistema de bloqueio automático de equipamentos com calibração vencida.",
      why: "Impedir que produtos sejam liberados com base em medições não confiáveis.",
      where: "Linha de envase 03 e todo o setor de pesagem.",
      who: "Coordenação de Manutenção + Qualidade",
      when: "Em até 30 dias após aprovação do plano",
      how: "Integrar cronograma de calibração ao sistema MES com bloqueio por leitor de código.",
      howMuch: "Estimativa: R$ 12.400,00 (licenças + horas de integração)",
    });
    setResultadoEsperado(
      "Redução a zero de liberações com equipamento de medição fora de calibração nos próximos 6 meses.",
    );
    toast.success("Rascunho de plano gerado pela IA", {
      description: "Revise cada campo antes de submeter para aprovação.",
    });
  }

  const proximoPorqueHabilitado = (i: number) => i === 0 || porques[i - 1].trim().length > 0;

  // Antes da NC ser gravada, o código é só uma prévia local — o código real
  // (sequencial por ano, por organização) é gerado no banco pela trigger
  // set_nc_code_and_sla ao criar o registro (ver migração
  // 20260729140300_ncs_triggers.sql).
  const previewCodigo = useMemo(
    () =>
      origem
        ? ncCodigo(origem, NC_SEQ, NC_ANO, prefixo || PREFIXO_NC_PADRAO)
        : `${prefixo || PREFIXO_NC_PADRAO}_[ORIGEM]_${String(NC_SEQ).padStart(3, "0")}_${NC_ANO}`,
    [origem, prefixo],
  );
  const codigoNC = createdNC?.codigo ?? previewCodigo;

  function setPorque(i: number, valor: string) {
    setPorques((prev) => {
      const next = [...prev];
      next[i] = valor;
      return next;
    });
    if (i === 4 && !causaRaizEditada) setCausaRaiz(valor);
  }

  function addIshikawaTag(cat: string) {
    const val = ishInputs[cat]?.trim();
    if (!val) return;
    setIshikawa((prev) => ({ ...prev, [cat]: [...prev[cat], val] }));
    setIshInputs((prev) => ({ ...prev, [cat]: "" }));
  }
  function removeIshikawaTag(cat: string, idx: number) {
    setIshikawa((prev) => ({ ...prev, [cat]: prev[cat].filter((_, i) => i !== idx) }));
  }

  const prazoFinal = useMemo(() => {
    if (!gravidade) return null;
    const horas = slaPorGravidade[gravidade].horas;
    const base = dataOcorrencia ?? new Date("2026-07-15");
    return new Date(base.getTime() + horas * 3600 * 1000);
  }, [gravidade, dataOcorrencia]);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const next: Evidence[] = Array.from(files).map((f) => {
      const kind = fileKind(f.name, f.type);
      return {
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        size: f.size,
        kind,
        url: kind === "image" ? URL.createObjectURL(f) : undefined,
      };
    });
    setEvidences((prev) => [...prev, ...next]);
  }

  function removeEvidence(id: string) {
    setEvidences((prev) => prev.filter((e) => e.id !== id));
  }

  // Identificação (etapa 1) + Classificação (etapa 2) são os campos que
  // existem de fato na tabela `ncs` nesta aba — Análise de Causa, Plano de
  // Ação e Avaliação de Eficácia (etapas 3-5) ainda são simulação local,
  // porque os módulos correspondentes (action_plans, etc.) não foram
  // migrados ainda ("uma coisa de cada vez"). A NC é gravada ao sair da
  // etapa 2, com os campos coletados até ali.
  async function goNext() {
    if (step === 2 && !createdNC) {
      if (!origem || !descricao.trim() || !gravidade) {
        toast.error("Preencha origem, descrição e gravidade antes de continuar", {
          description: "Esses campos são obrigatórios para registrar a não conformidade.",
        });
        return;
      }
      try {
        const nc = await createNC.mutateAsync({
          origem,
          descricao,
          gravidade,
          category: (categoria as CategoriaNC) || undefined,
          setorOcorrencia: (setorOcorrencia as SetorOcorrencia) || undefined,
          local,
          dataOcorrencia,
          reincidente,
          previousNcId: reincidente ? ncsVinculadas[0] : undefined,
        });
        setCreatedNC(nc);
        toast.success(`NC ${nc.codigo} registrada`, {
          description: "Continue preenchendo as próximas etapas.",
        });
      } catch {
        toast.error("Não foi possível registrar a não conformidade", {
          description: "Tente novamente em instantes.",
        });
        return;
      }
    }
    setCompleted((prev) => new Set(prev).add(step));
    setStep((s) => Math.min(STEPS.length, s + 1));
  }

  async function encerrarNC() {
    if (createdNC) {
      const statusFinal =
        resultado === "aprovado"
          ? "Encerrada"
          : resultado === "reprovado"
            ? "Plano em Execução"
            : "Em Avaliação";
      try {
        await updateNC.mutateAsync({
          id: createdNC.id,
          status: statusFinal,
          swotForwarded: ameacaFraqueza === "sim",
        });
      } catch {
        toast.error("NC salva, mas não foi possível atualizar o status final", {
          description: "Ajuste o status pela tela de detalhe da NC.",
        });
      }
    }
    setCompleted((prev) => new Set(prev).add(5));
    setFinalizado(true);
    toast.success("Não conformidade encerrada", {
      description: `${codigoNC} concluída com sucesso.`,
    });
  }
  function goPrev() {
    setStep((s) => Math.max(1, s - 1));
  }

  const ncsCatalog = allNCs.slice(0, 12);
  const linkedNCs = ncsCatalog.filter((nc) => ncsVinculadas.includes(nc.id));

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6 pb-28">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/nao-conformidades" className="hover:text-brand">
                Não Conformidades
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span>Nova</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Nova Não Conformidade
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Preencha as etapas do fluxo. Você pode salvar como rascunho a qualquer momento.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Código</span>
            <span className="font-mono text-sm font-semibold text-brand">{codigoNC}</span>
          </div>
        </div>

        {/* Stepper */}
        <Card className="rounded-xl border-border/80 shadow-sm">
          <CardContent className="p-4">
            <Stepper current={step} completed={completed} />
          </CardContent>
        </Card>

        {/* Step 1 */}
        {step === 1 && (
          <Card className="rounded-xl border-border/80 shadow-sm">
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="text-base font-semibold text-foreground">1. Identificação</h2>
                <p className="text-sm text-muted-foreground">
                  Registre o contexto e as evidências da não conformidade.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Código da NC</Label>
                  <Input readOnly value={codigoNC} className="h-10 rounded-lg bg-muted font-mono text-sm text-brand" />
                  <div className="flex items-center gap-2 pt-1">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Prefixo
                    </Label>
                    <Input
                      value={prefixo}
                      onChange={(e) => setPrefixo(e.target.value.toUpperCase().slice(0, 6))}
                      className="h-8 w-24 rounded-lg font-mono text-xs"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      Formato: prefixo_origem_nº_ano {origem && `(origem ${origemSiglas[origem]})`}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Data da ocorrência</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-10 w-full justify-start rounded-lg text-left font-normal",
                          !dataOcorrencia && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataOcorrencia
                          ? format(dataOcorrencia, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataOcorrencia}
                        onSelect={setDataOcorrencia}
                        initialFocus
                        className="pointer-events-auto p-3"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label>Local de ocorrência</Label>
                  <Select value={local} onValueChange={setLocal}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Selecione um local" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCAIS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Origem da NC</Label>
                  <Select value={origem} onValueChange={(v) => setOrigem(v as Origem)}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                    <SelectContent>
                      {ORIGENS.map((o) => (
                        <SelectItem key={o} value={o}>
                          <span className="font-mono text-[11px] font-semibold text-brand">
                            {origemSiglas[o]}
                          </span>{" "}
                          — {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Setor de Ocorrência</Label>
                  <Select value={setorOcorrencia} onValueChange={setSetorOcorrencia}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {setoresOcorrencia.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Tipo de Ação</Label>
                  <ToggleGroup
                    type="single"
                    value={tipoAcao}
                    onValueChange={(v) => v && setTipoAcao(v as "Corretiva" | "Preventiva")}
                    className="grid grid-cols-2 gap-2"
                  >
                    <ToggleGroupItem
                      value="Corretiva"
                      className="h-10 rounded-lg border border-border data-[state=on]:border-brand data-[state=on]:bg-brand-soft data-[state=on]:text-brand"
                    >
                      Corretiva
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="Preventiva"
                      className="h-10 rounded-lg border border-border data-[state=on]:border-brand data-[state=on]:bg-brand-soft data-[state=on]:text-brand"
                    >
                      Preventiva
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Descrição da não conformidade</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={5}
                  placeholder={DESCRICAO_EXEMPLOS[exemploIdx]}
                  className="rounded-lg"
                />
                <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                  {DESCRICAO_EXEMPLOS.map((ex) => (
                    <li key={ex}>{ex}</li>
                  ))}
                </ul>
              </div>

              {/* Upload */}
              <div className="space-y-2">
                <Label>Evidências</Label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                    isDragging ? "border-brand bg-brand-soft/40" : "border-border/80 bg-muted/30 hover:border-brand/50 hover:bg-brand-soft/20",
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    Arraste arquivos aqui ou <span className="text-brand">clique para selecionar</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Fotos, vídeos ou documentos — até 20MB por arquivo
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>
                {evidences.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {evidences.map((ev) => (
                      <div
                        key={ev.id}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-muted"
                      >
                        {ev.kind === "image" && ev.url ? (
                          <img src={ev.url} alt={ev.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-muted-foreground">
                            {ev.kind === "video" ? <Film className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                            <span className="line-clamp-2 text-center text-[10px]">{ev.name}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeEvidence(ev.id); }}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
                          {ev.kind === "image" ? <ImageIcon className="h-2.5 w-2.5" /> : ev.kind === "video" ? <Film className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
                          {(ev.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reincidente */}
              <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Reincidente?</div>
                    <div className="text-xs text-muted-foreground">
                      Marque se este desvio já ocorreu anteriormente para vincular NCs relacionadas.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs", !reincidente && "font-medium text-foreground")}>Não</span>
                    <Switch checked={reincidente} onCheckedChange={setReincidente} />
                    <span className={cn("text-xs", reincidente && "font-medium text-foreground")}>Sim</span>
                  </div>
                </div>
                {reincidente && (
                  <div className="mt-4 space-y-2">
                    <Popover open={linkOpen} onOpenChange={setLinkOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-9 w-full justify-between rounded-lg font-normal">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Search className="h-4 w-4" /> Buscar NC(s) para vincular…
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar por código ou descrição…" />
                          <CommandList>
                            <CommandEmpty>Nenhuma NC encontrada.</CommandEmpty>
                            <CommandGroup>
                              {ncsCatalog.map((nc) => {
                                const isSel = ncsVinculadas.includes(nc.id);
                                return (
                                  <CommandItem
                                    key={nc.id}
                                    value={`${nc.codigo} ${nc.descricao}`}
                                    onSelect={() => {
                                      setNcsVinculadas((prev) =>
                                        prev.includes(nc.id) ? prev.filter((x) => x !== nc.id) : [...prev, nc.id],
                                      );
                                    }}
                                  >
                                    <div className="flex w-full items-center justify-between gap-2">
                                      <div className="flex flex-col">
                                        <span className="font-mono text-[11px] font-semibold text-brand">{nc.codigo}</span>
                                        <span className="line-clamp-1 text-xs">{nc.descricao}</span>
                                      </div>
                                      {isSel && <Check className="h-4 w-4 text-brand" />}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {linkedNCs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {linkedNCs.map((nc) => (
                          <span
                            key={nc.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs text-brand"
                          >
                            <span className="font-mono font-semibold">{nc.codigo}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setNcsVinculadas((prev) => prev.filter((x) => x !== nc.id))
                              }
                              className="rounded-full p-0.5 hover:bg-brand/10"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <Card className="rounded-xl border-border/80 shadow-sm">
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="text-base font-semibold text-foreground">2. Classificação</h2>
                <p className="text-sm text-muted-foreground">
                  Defina gravidade e categoria. O prazo para tratativa é calculado automaticamente.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Gravidade</Label>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {(["Baixa", "Média", "Alta", "Crítica"] as Severity[]).map((s) => (
                    <SeverityCard
                      key={s}
                      sev={s}
                      selected={gravidade === s}
                      onSelect={() => setGravidade(s)}
                      guia={guias[s]}
                      onGuiaChange={(patch) =>
                        setGuias((prev) => ({ ...prev, [s]: { ...prev[s], ...patch } }))
                      }
                    />
                  ))}
                </div>
              </div>

              {gravidade && prazoFinal && (
                <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">Resumo do SLA</span>
                        <Badge variant="outline" className={cn("rounded-md border", severityClasses(gravidade))}>
                          {gravidade}
                        </Badge>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Prazo para tratativa
                          </div>
                          <div className="text-sm font-semibold text-foreground">
                            {slaPorGravidade[gravidade].label}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vencimento</div>
                          <div className="text-sm font-semibold text-foreground">
                            {format(prazoFinal, "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Escalonamento
                          </div>
                          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <ShieldAlert className="h-3.5 w-3.5 text-[color:var(--severity-high)]" />
                            {slaPorGravidade[gravidade].escalonamento}
                          </div>
                          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                            Em caso de vencimento do prazo, será enviado um alerta à pessoa designada.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  O responsável pela tratativa é definido no módulo de Plano de Ação.
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Análise de Causa */}
        {step === 3 && !finalizado && (
          <Card className="rounded-xl border-border/80 shadow-sm">
            <CardContent className="space-y-6 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">3. Análise de Causa</h2>
                  <p className="text-sm text-muted-foreground">
                    Selecione a ferramenta, mapeie as causas e consolide a causa raiz.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={sugerirCausaIA} className="gap-1.5 rounded-lg border-brand/40 text-brand hover:bg-brand-soft">
                  <Sparkles className="h-4 w-4" /> Sugerir causa raiz com IA
                </Button>
              </div>

              <ToggleGroup
                type="single"
                value={causaTool}
                onValueChange={(v) => v && setCausaTool(v as typeof causaTool)}
                className="flex flex-wrap gap-2"
              >
                {[
                  { v: "5porques", l: "5 Porquês" },
                  { v: "ishikawa", l: "Diagrama de Causa e Efeito" },
                ].map((t) => (
                  <ToggleGroupItem
                    key={t.v}
                    value={t.v}
                    className="h-9 rounded-lg border border-border px-4 data-[state=on]:border-brand data-[state=on]:bg-brand-soft data-[state=on]:text-brand"
                  >
                    {t.l}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              {causaTool === "5porques" && (
                <div className="relative pl-8">
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-4">
                    {porques.map((val, i) => {
                      const enabled = proximoPorqueHabilitado(i);
                      const filled = val.trim().length > 0;
                      const anterior = i === 0 ? descricao.trim() : porques[i - 1].trim();
                      return (
                        <div key={i} className="relative">
                          <div
                            className={cn(
                              "absolute -left-8 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold",
                              filled
                                ? "border-brand bg-brand text-brand-foreground"
                                : enabled
                                  ? "border-brand bg-background text-brand"
                                  : "border-border bg-muted text-muted-foreground",
                            )}
                          >
                            {filled ? <Check className="h-3 w-3" /> : i + 1}
                          </div>
                          <div className="space-y-1">
                            <Label className={cn(!enabled && "text-muted-foreground")}>
                              {`${i + 1}º Por quê`}
                            </Label>
                            <p className="text-xs italic text-muted-foreground">
                              {anterior
                                ? `Por que ${anterior.replace(/\.$/, "")}?`
                                : "Preencha a etapa anterior para encadear a pergunta."}
                            </p>
                            <Textarea
                              rows={2}
                              disabled={!enabled}
                              value={val}
                              onChange={(e) => setPorque(i, e.target.value)}
                              placeholder={enabled ? "Descreva por quê…" : "Preencha o passo anterior para liberar"}
                              className="rounded-lg"
                            />
                            {i === 4 && filled && (
                              <p className="text-[11px] font-medium text-brand">
                                Esta resposta foi consolidada como Causa Raiz.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {causaTool === "ishikawa" && (
                <div className="space-y-4">
                  <div className="space-y-1.5 rounded-xl border border-brand/20 bg-brand-soft/30 p-4">
                    <Label>Problema / Efeito (cabeça do peixe)</Label>
                    <Textarea
                      rows={2}
                      value={problemaEfeito}
                      onChange={(e) => setProblemaEfeito(e.target.value)}
                      placeholder="Descreva o efeito indesejado a ser analisado…"
                      className="rounded-lg bg-background"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {ISHI_CATS.map((cat) => (
                    <div key={cat} className="min-h-[190px] rounded-xl border border-border/80 bg-muted/20 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{cat}</span>
                        <span className="text-[10px] text-muted-foreground">{ishikawa[cat].length} causa(s)</span>
                      </div>
                      <div className="mb-3 flex min-h-[64px] flex-wrap gap-1.5">
                        {ishikawa[cat].map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft px-2 py-0.5 text-[11px] text-brand"
                          >
                            {tag}
                            <button type="button" onClick={() => removeIshikawaTag(cat, i)} className="rounded-full hover:bg-brand/10">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          value={ishInputs[cat]}
                          onChange={(e) => setIshInputs((p) => ({ ...p, [cat]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); addIshikawaTag(cat); }
                          }}
                          placeholder="Adicionar causa…"
                          className="h-8 rounded-lg text-xs"
                        />
                        <Button type="button" size="sm" variant="outline" onClick={() => addIshikawaTag(cat)} className="h-8 rounded-lg px-2">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-1.5">
                <Label>Causa raiz identificada</Label>
                <Textarea
                  rows={4}
                  value={causaRaiz}
                  onChange={(e) => { setCausaRaizEditada(true); setCausaRaiz(e.target.value); }}
                  placeholder="Consolide a causa raiz com base na ferramenta escolhida…"
                  className="rounded-lg"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Esta NC representa uma ameaça ou fraqueza para a organização?
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Aproveitamento estratégico — alimenta a análise SWOT (item 4.1 / 6.1).
                  </div>
                </div>
                <ToggleGroup
                  type="single"
                  value={ameacaFraqueza}
                  onValueChange={(v) => v && setAmeacaFraqueza(v as "sim" | "nao")}
                  className="flex gap-2"
                >
                  <ToggleGroupItem value="sim" className="h-9 rounded-lg border border-border px-5 data-[state=on]:border-brand data-[state=on]:bg-brand-soft data-[state=on]:text-brand">
                    Sim
                  </ToggleGroupItem>
                  <ToggleGroupItem value="nao" className="h-9 rounded-lg border border-border px-5 data-[state=on]:border-brand data-[state=on]:bg-brand-soft data-[state=on]:text-brand">
                    Não
                  </ToggleGroupItem>
                </ToggleGroup>
                {ameacaFraqueza === "sim" && (
                  <div className="flex items-start gap-2 rounded-lg border border-brand/30 bg-brand-soft/50 p-3 text-xs text-brand">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Esta não conformidade será enviada para a Análise de Cenário (SWOT) como
                    fraqueza ou ameaça, mantendo o vínculo com o registro.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/30 p-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Esta NC gera necessidade de revisão do mapa de riscos?
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ao marcar Sim, uma tarefa será aberta no módulo Riscos e Oportunidades.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs", !revisarRiscos && "font-medium text-foreground")}>Não</span>
                  <Switch checked={revisarRiscos} onCheckedChange={setRevisarRiscos} />
                  <span className={cn("text-xs", revisarRiscos && "font-medium text-foreground")}>Sim</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4 — Plano de Ação */}
        {step === 4 && !finalizado && (
          <Card className="rounded-xl border-border/80 shadow-sm">
            <CardContent className="space-y-6 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">4. Plano de Ação</h2>
                  <p className="text-sm text-muted-foreground">
                    Defina contenção imediata e ação corretiva estruturada (detalhamento da ação).
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={sugerirPlanoIA} className="gap-1.5 rounded-lg border-brand/40 text-brand hover:bg-brand-soft">
                  <Sparkles className="h-4 w-4" /> Gerar rascunho do plano com IA
                </Button>
              </div>

              <section className="space-y-4 rounded-xl border border-[color:var(--severity-high)]/25 bg-[color:var(--severity-high)]/5 p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[color:var(--severity-high)]" />
                  <h3 className="text-sm font-semibold text-foreground">Ação Imediata / Contenção</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Descrição da contenção</Label>
                    <Textarea rows={3} value={contDesc} onChange={(e) => setContDesc(e.target.value)} className="rounded-lg" placeholder="Descreva o que será feito imediatamente para conter o desvio…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Responsável</Label>
                    <UserPicker value={contResp} onChange={setContResp} placeholder="Selecione o responsável" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("h-10 w-full justify-start rounded-lg text-left font-normal", !contData && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {contData ? format(contData, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={contData} onSelect={setContData} initialFocus className="pointer-events-auto p-3" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-brand" />
                  <h3 className="text-sm font-semibold text-foreground">Ação Corretiva — Detalhamento da Ação</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {([
                    ["what", "O quê", "descrição da ação", "textarea"],
                    ["why", "Por quê", "justificativa", "textarea"],
                    ["where", "Onde", "local de aplicação", "input"],
                    ["who", "Quem", "responsável", "input"],
                    ["when", "Quando", "prazo", "input"],
                    ["how", "Como", "método de execução", "textarea"],
                    ["howMuch", "Quanto custa", "custo estimado", "input"],
                  ] as const).map(([key, ptL, enL, type]) => (
                    <div key={key} className="space-y-1.5 rounded-xl border border-border/80 bg-card p-3">
                      <div className="flex items-baseline justify-between">
                        <Label className="text-sm font-semibold">{ptL}</Label>
                        <span className="text-[10px] tracking-wide text-muted-foreground">{enL}</span>
                      </div>
                      {type === "textarea" ? (
                        <Textarea rows={3} value={w5h2[key]} onChange={(e) => setW5h2((p) => ({ ...p, [key]: e.target.value }))} className="rounded-lg" />
                      ) : (
                        <Input value={w5h2[key]} onChange={(e) => setW5h2((p) => ({ ...p, [key]: e.target.value }))} className="h-10 rounded-lg" />
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <div className="space-y-1.5">
                <Label>Resultado esperado</Label>
                <Textarea rows={3} value={resultadoEsperado} onChange={(e) => setResultadoEsperado(e.target.value)} className="rounded-lg" placeholder="Descreva o indicador ou evidência que confirmará a eficácia…" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5 — Avaliação de Eficácia */}
        {step === 5 && !finalizado && (
          <Card className="rounded-xl border-border/80 shadow-sm">
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="text-base font-semibold text-foreground">5. Avaliação de Eficácia</h2>
                <p className="text-sm text-muted-foreground">
                  Confirme se as ações resolveram a causa raiz e encerre a NC.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Método de avaliação</Label>
                  <Select value={metodoAval} onValueChange={setMetodoAval}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Teste", "Observação", "Entrevista", "Simulação", "Outros"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Avaliador</Label>
                  <UserPicker value={avaliador} onChange={setAvaliador} placeholder="Selecione o avaliador" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Evidência de eficácia</Label>
                <div
                  onClick={() => evidEficaciaRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-muted/30 p-6 text-center hover:border-brand/50 hover:bg-brand-soft/20"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    Anexe fotos, relatórios ou registros de verificação
                  </div>
                  <input ref={evidEficaciaRef} type="file" multiple hidden onChange={(e) => handleEfFiles(e.target.files)} />
                </div>
                {evidEficacia.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {evidEficacia.map((ev) => (
                      <div key={ev.id} className="aspect-square overflow-hidden rounded-lg border border-border/70 bg-muted">
                        {ev.kind === "image" && ev.url ? (
                          <img src={ev.url} alt={ev.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-muted-foreground">
                            <FileText className="h-6 w-6" />
                            <span className="line-clamp-2 text-center text-[10px]">{ev.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Resultado</Label>
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    { v: "aprovado", label: "Aprovado", desc: "Ação eficaz — NC pode ser encerrada.", cls: "border-[color:var(--success)]/40 bg-[color:var(--success)]/5 text-[color:var(--success)]", icon: ThumbsUp },
                    { v: "reprovado", label: "Reprovado", desc: "Ação não resolveu — retorna ao Plano de Ação.", cls: "border-[color:var(--severity-critical)]/40 bg-[color:var(--severity-critical)]/5 text-[color:var(--severity-critical)]", icon: ThumbsDown },
                    { v: "reinspecao", label: "Aprovado após nova inspeção", desc: "Requer nova verificação em prazo definido.", cls: "border-[color:var(--warning)]/50 bg-[color:var(--warning)]/10 text-[color:var(--severity-high)]", icon: AlertCircle },
                  ] as const).map((opt) => {
                    const Icon = opt.icon;
                    const selected = resultado === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setResultado(opt.v)}
                        className={cn(
                          "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all",
                          opt.cls,
                          selected ? "ring-2 ring-offset-2 ring-current" : "opacity-80 hover:opacity-100",
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <Icon className="h-5 w-5" />
                          {selected && <Check className="h-4 w-4" />}
                        </div>
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className="text-xs text-foreground/70">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {resultado === "reprovado" && (
                <div className="flex items-start gap-3 rounded-xl border border-[color:var(--severity-critical)]/30 bg-[color:var(--severity-critical)]/5 p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-[color:var(--severity-critical)]" />
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">A NC retornará para a etapa de Plano de Ação</div>
                    <div className="text-xs text-muted-foreground">
                      Ao encerrar, o responsável será notificado para revisar as ações corretivas e submeter uma nova avaliação.
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Observações finais</Label>
                <Textarea rows={3} value={obsFinais} onChange={(e) => setObsFinais(e.target.value)} className="rounded-lg" placeholder="Registre aprendizados, ressalvas ou próximos monitoramentos…" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success / Encerramento */}
        {finalizado && (
          <Card className="rounded-xl border-[color:var(--success)]/30 bg-[color:var(--success)]/5 shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--success)] text-white">
                <PartyPopper className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">Não Conformidade encerrada</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Todas as etapas foram concluídas e registradas na trilha de auditoria.
                </p>
              </div>
              <div className="w-full max-w-lg rounded-xl border border-border/80 bg-card p-4 text-left">
                <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Resumo</div>
                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Código</dt><dd className="font-mono font-semibold text-brand">{codigoNC}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Gravidade</dt><dd className="font-medium">{gravidade ?? "—"}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Categoria</dt><dd className="font-medium">{categoria ?? "—"}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Setor</dt><dd className="font-medium">{setorOcorrencia ?? "—"}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Resultado</dt><dd className="font-medium capitalize">{resultado ?? "—"}</dd></div>
                </dl>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" className="rounded-lg">
                  <Link to="/nao-conformidades">Voltar para lista</Link>
                </Button>
                <Button asChild className="rounded-lg bg-brand text-brand-foreground hover:bg-brand/90">
                  <Link to="/nao-conformidades/nova">Registrar outra NC</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sticky footer */}
      {!finalizado && (
      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
          <div>
            <Button
              variant="ghost"
              onClick={goPrev}
              disabled={step === 1}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-1 rounded-lg">
              <Save className="h-4 w-4" /> Salvar rascunho
            </Button>
            {step < STEPS.length ? (
              <Button
                onClick={goNext}
                disabled={createNC.isPending}
                className="gap-1 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
              >
                Salvar e continuar <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={encerrarNC}
                disabled={updateNC.isPending}
                className="gap-1.5 rounded-lg bg-[color:var(--success)] px-5 py-5 text-white hover:bg-[color:var(--success)]/90"
              >
                <Check className="h-5 w-5" /> Encerrar Não Conformidade
              </Button>
            )}
          </div>
        </div>
      </div>
      )}
    </AppShell>
  );
}