import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ShieldAlert,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Settings2,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  PRAZO_CONTINGENCIA_DIAS_UTEIS_PADRAO,
  addDiasUteis,
  type PlanoOrigemTipo,
} from "@/lib/mock-data";
import { useNCs } from "@/lib/queries/ncs";
import { useCreateActionPlan, useOrgMembers, type OrgMember } from "@/lib/queries/action-plans";
import { Route as NovoPlanoRoute } from "@/routes/planos-de-acao.novo";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Plano de Ação", icon: ClipboardList },
  { id: 2, label: "Ações corretivas", icon: Sparkles },
];

const ORIGENS: PlanoOrigemTipo[] = [
  "Não Conformidade",
  "Auditoria Interna",
  "Auditoria Externa",
  "Risco/Oportunidade",
  "Análise Crítica",
  "Reclamação de Cliente",
  "Melhoria Contínua",
];

// 5W2H em português, exatamente os 7 campos da seção 10 do Guia de
// Arquitetura — "departamento" não é um deles (era só agrupamento visual do
// protótipo, sem coluna correspondente no banco), por isso não existe mais
// como campo próprio aqui.
type AcaoCorretiva = {
  oque: string;
  porque: string;
  onde: string;
  responsavelId: string;
  prazo: string; // yyyy-mm-dd
  como: string;
  quanto: string;
};

function novaAcao(): AcaoCorretiva {
  return {
    oque: "",
    porque: "",
    onde: "",
    responsavelId: "",
    prazo: "",
    como: "",
    quanto: "",
  };
}

function isoEmDias(dias: number) {
  return new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = current > s.id;
        const active = current === s.id;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors",
                done &&
                  "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
                active && "border-brand bg-brand text-white",
                !done && !active && "border-border bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              <span className="font-medium">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}

type IAProposta = {
  contencao: string;
  acoes: AcaoCorretiva[];
};

function gerarPropostaIA(problema: string, membros: OrgMember[]): IAProposta {
  const criticidade = /crític|urgent|paral/i.test(problema)
    ? 15
    : /moder|risco/i.test(problema)
      ? 30
      : 45;
  const foco = problema.trim().slice(0, 60) || "processo identificado";
  const resp = (i: number) => membros[i % Math.max(membros.length, 1)]?.id ?? "";
  return {
    contencao: `Isolar imediatamente ${foco.toLowerCase()} e comunicar a equipe responsável. Aplicar inspeção 100% até a estabilização.`,
    acoes: [
      {
        oque: `Revisar procedimento operacional associado a ${foco.toLowerCase()}`,
        porque: "Eliminar a causa raiz e evitar reincidência",
        onde: "Área impactada",
        responsavelId: resp(0),
        prazo: isoEmDias(Math.round(criticidade / 3)),
        como: "Reunião técnica + revisão da análise de causa raiz",
        quanto: "0",
      },
      {
        oque: "Atualizar POP e checklist de conferência",
        porque: "Formalizar a nova prática",
        onde: "Gestão Documental",
        responsavelId: resp(1),
        prazo: isoEmDias(Math.round(criticidade / 2)),
        como: "Redação e aprovação via workflow documental",
        quanto: "0",
      },
      {
        oque: "Treinamento dos operadores dos 3 turnos",
        porque: "Garantir aderência ao novo procedimento",
        onde: "Sala de treinamento + campo",
        responsavelId: resp(2),
        prazo: isoEmDias(Math.max(criticidade - 5, 5)),
        como: "Treinamento presencial com avaliação de eficácia",
        quanto: "800",
      },
    ],
  };
}

export function NovoPlanoWizard() {
  const navigate = useNavigate();
  const search = NovoPlanoRoute.useSearch();
  const { data: orgMembers = [] } = useOrgMembers();
  const { data: ncs = [] } = useNCs();
  const createActionPlan = useCreateActionPlan();

  const veioDeNC = Boolean(search.problema || search.vinculado);

  const [step, setStep] = useState(veioDeNC ? 2 : 1);

  // Step 1 — contexto
  const [origem, setOrigem] = useState<PlanoOrigemTipo>(
    (search.origem as PlanoOrigemTipo) ?? "Não Conformidade",
  );
  const [ncId, setNcId] = useState(search.ncId ?? "");
  const [problema, setProblema] = useState(search.problema ?? "");

  const ncSelecionada = ncs.find((n) => n.id === ncId);
  const vinculadoLabel = ncSelecionada?.codigo ?? search.vinculado ?? "";

  // Contingência
  const [usarContingencia, setUsarContingencia] = useState(false);
  const [contencao, setContencao] = useState("");
  const [contResponsavelId, setContResponsavelId] = useState("");
  const [prazoContDias, setPrazoContDias] = useState(PRAZO_CONTINGENCIA_DIAS_UTEIS_PADRAO);

  // Ações corretivas
  const [acoes, setAcoes] = useState<AcaoCorretiva[]>([novaAcao()]);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaProposta, setIaProposta] = useState<IAProposta | null>(null);

  const prazoContingencia = useMemo(() => addDiasUteis(new Date(), prazoContDias), [prazoContDias]);

  const gerarComIA = () => {
    if (!problema.trim()) {
      toast.error("Descreva o problema para a IA propor as ações.");
      return;
    }
    setIaLoading(true);
    setTimeout(() => {
      setIaProposta(gerarPropostaIA(problema, orgMembers));
      setIaLoading(false);
    }, 1500);
  };

  const aplicarTudo = () => {
    if (!iaProposta) return;
    setUsarContingencia(true);
    setContencao(iaProposta.contencao);
    setAcoes(iaProposta.acoes);
    setIaProposta(null);
    toast.success("Proposta aplicada — revise antes de concluir.");
  };

  const updateAcao = (i: number, field: keyof AcaoCorretiva, value: string) =>
    setAcoes((a) => a.map((x, idx) => (idx === i ? { ...x, [field]: value } : x)));
  const addAcao = () => setAcoes((a) => [...a, novaAcao()]);
  const removeAcao = (i: number) => setAcoes((a) => a.filter((_, idx) => idx !== i));

  const acaoIncompleta = (a: AcaoCorretiva) =>
    !a.oque.trim() ||
    !a.porque.trim() ||
    !a.onde.trim() ||
    !a.responsavelId ||
    !a.prazo ||
    !a.como.trim() ||
    !a.quanto.trim();

  const concluir = () => {
    if (usarContingencia && (!contencao.trim() || !contResponsavelId)) {
      toast.error("Preencha a descrição e o responsável da ação de contingência.");
      return;
    }
    if (!problema.trim()) {
      toast.error("Descreva o problema que originou o plano.");
      return;
    }
    if (acoes.some(acaoIncompleta)) {
      toast.error("Todos os campos das ações corretivas são obrigatórios.");
      return;
    }

    createActionPlan.mutate(
      {
        origem,
        problema: problema.trim(),
        ncId: origem === "Não Conformidade" && ncId ? ncId : undefined,
        contingencia: usarContingencia
          ? {
              descricao: contencao.trim(),
              responsavelId: contResponsavelId,
              prazo: prazoContingencia,
            }
          : undefined,
        acoes: acoes.map((a) => ({
          oque: a.oque.trim(),
          porque: a.porque.trim(),
          onde: a.onde.trim(),
          responsavelId: a.responsavelId,
          prazo: new Date(`${a.prazo}T12:00:00`),
          como: a.como.trim(),
          quanto: Number(a.quanto.replace(/[^\d.,-]/g, "").replace(",", ".")) || 0,
        })),
      },
      {
        onSuccess: (plan) => {
          toast.success(
            `${plan.code} criado com ${acoes.length} ação(ões) corretiva(s)${usarContingencia ? " + contingência" : ""}.`,
          );
          navigate({ to: "/planos-de-acao" });
        },
        onError: (err) => {
          toast.error("Não foi possível salvar o plano.", {
            description: err instanceof Error ? err.message : undefined,
          });
        },
      },
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">
              <Link to="/planos-de-acao" className="hover:text-foreground">
                Planos de Ação
              </Link>{" "}
              / Novo
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Novo Plano de Ação</h1>
          </div>
          <Button variant="outline" asChild>
            <Link to="/planos-de-acao">Cancelar</Link>
          </Button>
        </header>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <Stepper current={step} />
          </CardContent>
        </Card>

        {veioDeNC && step === 2 && (
          <Card className="rounded-xl border-brand/30 bg-brand-soft/30">
            <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <Link2 className="h-4 w-4 text-brand" />
              <span className="font-medium text-brand">
                Originado de {vinculadoLabel || "não conformidade"}
              </span>
              <span className="text-muted-foreground">Causa raiz: {problema || "—"}</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setStep(1)}>
                Editar contexto
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Plano de Ação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Origem</Label>
                  <Select
                    value={origem}
                    onValueChange={(v) => {
                      setOrigem(v as PlanoOrigemTipo);
                      if (v !== "Não Conformidade") setNcId("");
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORIGENS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {origem === "Não Conformidade" && (
                  <div>
                    <Label>Não conformidade vinculada (opcional)</Label>
                    <Select
                      value={ncId || "none"}
                      onValueChange={(v) => setNcId(v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma (plano avulso)</SelectItem>
                        {ncs.map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.codigo} — {n.descricao.slice(0, 50)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div>
                <Label>Descrição do Problema</Label>
                <Textarea
                  className="mt-2 min-h-[110px]"
                  value={problema}
                  onChange={(e) => setProblema(e.target.value)}
                  placeholder="Descreva o problema que originou o plano — quando vem de uma NC, a causa raiz já chega preenchida."
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {/* Contingência */}
            <Card className="rounded-xl border-[color:var(--severity-high)]/30 bg-[color:var(--severity-high)]/5">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-4 w-4 text-[color:var(--severity-high)]" />
                  Ação de Contingência (imediata)
                  <Badge
                    variant="outline"
                    className="border-border/60 text-[10px] font-normal text-muted-foreground"
                  >
                    opcional
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Usar contingência</span>
                  <Switch checked={usarContingencia} onCheckedChange={setUsarContingencia} />
                </div>
              </CardHeader>
              {usarContingencia && (
                <CardContent className="space-y-4">
                  <div>
                    <Label>O que será feito imediatamente</Label>
                    <Textarea
                      className="mt-2 min-h-[80px]"
                      value={contencao}
                      onChange={(e) => setContencao(e.target.value)}
                      placeholder="Ação de curto prazo para estancar o problema."
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Responsável</Label>
                      <Select value={contResponsavelId} onValueChange={setContResponsavelId}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {orgMembers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5">
                        <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                        Prazo governado (dias úteis)
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        className="mt-2"
                        value={prazoContDias}
                        onChange={(e) => setPrazoContDias(Math.max(1, Number(e.target.value) || 1))}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Padrão de configuração geral: {PRAZO_CONTINGENCIA_DIAS_UTEIS_PADRAO} dias
                        úteis · vence em{" "}
                        <span className="font-medium text-foreground">
                          {prazoContingencia.toLocaleDateString("pt-BR")}
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* IA */}
            <Card className="rounded-xl border-brand/30 bg-brand-soft/30">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand" />
                  <div>
                    <div className="text-sm font-semibold text-brand">Gerar ações com IA</div>
                    <div className="text-xs text-muted-foreground">
                      Contingência + ações corretivas detalhadas a partir da causa raiz.
                    </div>
                  </div>
                </div>
                <Button
                  className="bg-brand hover:bg-brand/90"
                  onClick={gerarComIA}
                  disabled={iaLoading}
                >
                  {iaLoading ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      IA analisando…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      Gerar proposta
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {iaProposta && (
              <Card className="rounded-xl border-brand/40 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-brand" /> Proposta da IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Contingência
                    </div>
                    <div className="mt-1">{iaProposta.contencao}</div>
                  </div>
                  {iaProposta.acoes.map((a, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 text-xs">
                      <div className="mb-1 font-semibold text-brand">
                        Ação {i + 1}: {a.oque}
                      </div>
                      <div className="grid gap-1 text-muted-foreground sm:grid-cols-2">
                        <div>Onde: {a.onde}</div>
                        <div>
                          Quem: {orgMembers.find((u) => u.id === a.responsavelId)?.fullName ?? "—"}
                        </div>
                        <div>Quando: {a.prazo}</div>
                        <div>Quanto: R$ {a.quanto}</div>
                        <div className="sm:col-span-2">Como: {a.como}</div>
                        <div className="sm:col-span-2">Por quê: {a.porque}</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" onClick={() => setIaProposta(null)}>
                      Descartar
                    </Button>
                    <Button className="bg-brand hover:bg-brand/90" onClick={aplicarTudo}>
                      Aplicar tudo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ações corretivas */}
            <Card className="rounded-xl">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    Ações Corretivas — Detalhamento da Ação
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cada linha vira um item acompanhável no módulo de Planos de Ação. Todos os
                    campos são obrigatórios.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-border/60 text-[10px] text-muted-foreground"
                >
                  {acoes.length} ação(ões)
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {acoes.map((a, i) => (
                  <div key={i} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand">
                        Ação corretiva {i + 1}
                      </span>
                      {acoes.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => removeAcao(i)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-12">
                      <div className="md:col-span-6">
                        <Label className="text-xs">O quê — descrição da ação *</Label>
                        <Input
                          className="mt-1.5"
                          value={a.oque}
                          onChange={(e) => updateAcao(i, "oque", e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-6">
                        <Label className="text-xs">Por quê — justificativa (causa raiz) *</Label>
                        <Input
                          className="mt-1.5"
                          value={a.porque}
                          onChange={(e) => updateAcao(i, "porque", e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-xs">Onde — local de aplicação *</Label>
                        <Input
                          className="mt-1.5"
                          value={a.onde}
                          onChange={(e) => updateAcao(i, "onde", e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-xs">Quem — responsável pela tratativa *</Label>
                        <Select
                          value={a.responsavelId}
                          onValueChange={(v) => updateAcao(i, "responsavelId", v)}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {orgMembers.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-xs">Quando — prazo *</Label>
                        <Input
                          type="date"
                          className="mt-1.5"
                          value={a.prazo}
                          onChange={(e) => updateAcao(i, "prazo", e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-6">
                        <Label className="text-xs">Como — método de execução *</Label>
                        <Input
                          className="mt-1.5"
                          value={a.como}
                          onChange={(e) => updateAcao(i, "como", e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-xs">Quanto custa — R$ *</Label>
                        <Input
                          className="mt-1.5"
                          value={a.quanto}
                          onChange={(e) => updateAcao(i, "quanto", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full gap-1.5 rounded-lg border-dashed"
                  onClick={addAcao}
                >
                  <Plus className="h-4 w-4" /> Adicionar ação
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep(1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          {step === 1 ? (
            <Button className="bg-brand hover:bg-brand/90" onClick={() => setStep(2)}>
              Avançar <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              className="bg-brand hover:bg-brand/90"
              onClick={concluir}
              disabled={createActionPlan.isPending}
            >
              {createActionPlan.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <Check className="mr-1 h-4 w-4" /> Cadastrar ações no plano
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
