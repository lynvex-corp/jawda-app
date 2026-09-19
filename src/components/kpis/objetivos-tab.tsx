import { useState } from "react";
import { toast } from "sonner";
import { Plus, Target, Archive, MoreHorizontal, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQualityPolicyCurrent } from "@/lib/queries/documentos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/app/searchable-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrgMembers } from "@/lib/queries/action-plans";
import {
  useArchiveObjective,
  useCreateObjective,
  type QualityObjective,
  type Indicator,
} from "@/lib/queries/indicators";
import { progressoObjetivo } from "@/lib/kpi-data";
import type { Measurement } from "@/lib/queries/indicator-measurements";
import { TabelaIndicadores } from "./tabela-indicadores";
import { cn, getErrorMessage } from "@/lib/utils";

export function ObjetivosTab({
  objetivos,
  indicadoresAtivos,
  medicoesPorIndicador,
  onCriarIndicadorPara,
}: {
  objetivos: QualityObjective[];
  indicadoresAtivos: Indicator[];
  medicoesPorIndicador: Record<string, Measurement[]>;
  onCriarIndicadorPara: (objetivoId: string) => void;
}) {
  const [novoOpen, setNovoOpen] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const archiveObjetivo = useArchiveObjective();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          className="rounded-lg bg-brand text-white hover:bg-brand/90"
          onClick={() => setNovoOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Novo Objetivo
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {objetivos.map((o) => {
          const filhos = indicadoresAtivos.filter((k) => k.objetivoId === o.id);
          const prog = progressoObjetivo(
            filhos.map((k) => {
              const medicoes = medicoesPorIndicador[k.id] ?? [];
              return {
                valor: medicoes.length ? medicoes[medicoes.length - 1].valor : null,
                meta: k.meta,
                polaridade: k.polaridade,
              };
            }),
          );
          const cor =
            prog >= 100 ? "var(--success)" : prog >= 85 ? "var(--warning)" : "var(--danger-deep)";
          return (
            <Card
              key={o.id}
              className={cn(
                "rounded-2xl border-border/80 shadow-sm transition hover:shadow-md",
                expandido === o.id && "ring-2 ring-brand/30",
              )}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <button
                    className="flex flex-1 items-center gap-2 text-left"
                    onClick={() => setExpandido(expandido === o.id ? null : o.id)}
                  >
                    <Target className="h-4 w-4 shrink-0 text-brand" />
                    <h3 className="text-sm font-semibold text-foreground">{o.nome}</h3>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: cor }} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6 rounded-md">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={o.arquivado}
                          onClick={() =>
                            archiveObjetivo.mutate(o.id, {
                              onSuccess: () => toast.success("Objetivo arquivado"),
                              onError: (err) =>
                                toast.error("Não foi possível arquivar", {
                                  description: getErrorMessage(err),
                                }),
                            })
                          }
                        >
                          <Archive className="mr-2 h-3.5 w-3.5" /> Arquivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{o.descricao}</p>
                <Badge
                  variant="outline"
                  className="rounded-md border-brand/20 bg-brand-soft text-[10px] text-brand"
                >
                  {filhos.length} indicadores vinculados
                </Badge>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Progresso agregado</span>
                    <span>{prog}%</span>
                  </div>
                  <Progress value={Math.min(100, prog)} className="h-2" />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {o.prazo
                    ? `Prazo ${new Date(o.prazo).toLocaleDateString("pt-BR")}`
                    : "Sem prazo definido"}{" "}
                  · {o.responsavelNome}
                </p>
              </CardContent>
            </Card>
          );
        })}
        {!objetivos.length && (
          <p className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum objetivo da qualidade cadastrado.
          </p>
        )}
      </div>

      {expandido && (
        <Card className="rounded-2xl border-brand/30">
          <CardContent className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Indicadores de "{objetivos.find((o) => o.id === expandido)?.nome}"
            </h3>
            <TabelaIndicadores
              indicadores={indicadoresAtivos.filter((k) => k.objetivoId === expandido)}
              medicoesPorIndicador={medicoesPorIndicador}
            />
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => onCriarIndicadorPara(expandido)}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Criar indicador para este objetivo
            </Button>
          </CardContent>
        </Card>
      )}

      <NovoObjetivoDialog open={novoOpen} onOpenChange={setNovoOpen} />
    </div>
  );
}

function NovoObjetivoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: membros = [] } = useOrgMembers();
  const createObjetivo = useCreateObjective();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [prazo, setPrazo] = useState("");
  const [responsavelId, setResponsavelId] = useState("");

  function salvar() {
    if (!nome.trim() || !justificativa.trim()) {
      toast.error(
        "Nome e justificativa de coerência com a Política da Qualidade são obrigatórios.",
      );
      return;
    }
    createObjetivo.mutate(
      {
        nome,
        descricao,
        justificativa,
        prazo: prazo || null,
        responsavelId: responsavelId || null,
      },
      {
        onSuccess: () => {
          toast.success("Objetivo da qualidade criado", { description: nome });
          onOpenChange(false);
          setNome("");
          setDescricao("");
          setJustificativa("");
          setPrazo("");
          setResponsavelId("");
        },
        onError: (err) =>
          toast.error("Não foi possível criar o objetivo", { description: getErrorMessage(err) }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo objetivo da qualidade</DialogTitle>
          <DialogDescription>
            Todo objetivo precisa ser coerente com a Política da Qualidade.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="rounded-lg text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Descrição</Label>
            <Textarea
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="rounded-lg text-sm"
            />
          </div>
          {/* A justificativa sempre foi texto livre pedindo coerência com uma
              política que não aparecia em lugar nenhum desta tela — quem
              escrevia tinha que lembrar de cor ou sair do fluxo para
              consultar. Exibir a versão vigente aqui é o vínculo de leitura
              do Bloco 2 (item 10). Continua sem FK: a rastreabilidade de
              contra qual versão cada objetivo foi justificado fica para
              quando houver necessidade de auditoria completa. */}
          <PoliticaVigenteResumo />
          <div className="space-y-1.5">
            <Label className="text-[11px]">
              Justificativa de coerência com a Política da Qualidade *
            </Label>
            <Textarea
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="rounded-lg text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Prazo (opcional)</Label>
              <Input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Responsável</Label>
              <SearchableSelect
                value={responsavelId}
                onValueChange={setResponsavelId}
                placeholder="Selecione"
                searchPlaceholder="Buscar por nome…"
                emptyMessage="Nenhuma pessoa encontrada."
                className="rounded-lg text-xs"
                options={[...membros]
                  .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"))
                  .map((m) => ({ value: m.id, label: m.fullName }))}
              />
            </div>
          </div>
          <p className="rounded-lg bg-muted/40 p-2 text-[10px] text-muted-foreground">
            Vincule indicadores existentes na aba Painel ou use "Criar indicador para este
            objetivo".
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
            onClick={salvar}
            disabled={createObjetivo.isPending}
          >
            Salvar objetivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Mostra a Política da Qualidade vigente para consulta enquanto o usuário
 * escreve a justificativa de coerência do objetivo. Somente leitura — editar
 * é em Identidade Organizacional. */
function PoliticaVigenteResumo() {
  const { data } = useQualityPolicyCurrent();
  const policy = data?.policy;

  if (!policy || !policy.content.trim()) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 p-3 text-[11px] text-muted-foreground">
        Nenhuma Política da Qualidade formalizada ainda.{" "}
        <Link
          to="/identidade-organizacional"
          className="inline-flex items-center gap-1 text-brand hover:underline"
        >
          Definir agora <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-brand/20 bg-brand-soft/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand">
          Política da Qualidade vigente
          {policy.versionLabel ? ` · ${policy.versionLabel}` : ""}
        </span>
        <Link
          to="/identidade-organizacional"
          className="inline-flex shrink-0 items-center gap-1 text-[10px] text-brand hover:underline"
        >
          Abrir <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80">
        {policy.content}
      </p>
    </div>
  );
}
