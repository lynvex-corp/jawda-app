import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { FileText, ClipboardList, Link2, Plus, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CLASSIFICATION_META,
  FINDING_STATUS_LABEL,
  useFindings,
  useCreateFinding,
  useGenerateNcFromFinding,
  useGenerateActionPlanFromFinding,
  useCloseFinding,
  type AuditFindingRow,
  type FindingTypeDb,
} from "@/lib/queries/audits";
import { useOrgMembers } from "@/lib/queries/action-plans";

const FINDING_STATUS_CLS: Record<AuditFindingRow["status"], string> = {
  aberto: "border-border bg-muted text-muted-foreground",
  em_tratativa: "border-brand/30 bg-brand-soft text-brand",
  aguardando_verificacao:
    "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/15 text-[color:var(--severity-high)]",
  encerrado_eficaz:
    "border-[color:var(--success)]/40 bg-[color:var(--success)]/15 text-[color:var(--success)]",
  encerrado_nao_eficaz:
    "border-[color:var(--severity-critical)]/40 bg-[color:var(--severity-critical)]/15 text-[color:var(--severity-critical)]",
};

export function AbaApontamentos({ auditId, unitId }: { auditId: string; unitId?: string | null }) {
  const { data: findings = [] } = useFindings(auditId);
  const createFinding = useCreateFinding();

  const [novoTipo, setNovoTipo] = useState<FindingTypeDb>("OPM");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novoRequisito, setNovoRequisito] = useState("");

  function adicionar() {
    if (!novaDescricao.trim()) {
      toast.error("Descreva o apontamento.");
      return;
    }
    createFinding.mutate(
      {
        auditId,
        type: novoTipo,
        description: novaDescricao,
        normRequirement: novoRequisito || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Apontamento registrado");
          setNovaDescricao("");
          setNovoRequisito("");
        },
      },
    );
  }

  const counts = { OPM: 0, NCS: 0, NCM: 0, NCC: 0 } as Record<FindingTypeDb, number>;
  for (const f of findings) counts[f.type] += 1;

  return (
    <div className="space-y-4">
      <Card className="rounded-xl">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Apontamentos desta auditoria
          </div>
          <div className="flex flex-wrap gap-2">
            {(["OPM", "NCS", "NCM", "NCC"] as const).map((k) => (
              <span
                key={k}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold",
                  CLASSIFICATION_META[k].badge,
                )}
              >
                {CLASSIFICATION_META[k].label}
                <span className="rounded bg-background/60 px-1 text-[11px]">{counts[k]}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Registrar apontamento manual</CardTitle>
          <p className="text-xs text-muted-foreground">
            Use quando a observação surgir fora do checklist (ex.: entrevista com colaborador).
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as FindingTypeDb)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["OPM", "NCS", "NCM", "NCC"] as const).map((t) => (
                  <SelectItem key={t} value={t}>
                    {CLASSIFICATION_META[t].long}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Requisito</Label>
            <Input
              value={novoRequisito}
              onChange={(e) => setNovoRequisito(e.target.value)}
              placeholder="Ex.: 8.1"
            />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">Descrição</Label>
            <Input
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
              placeholder="O que foi observado"
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full gap-1.5 bg-brand hover:bg-brand/90"
              onClick={adicionar}
              disabled={createFinding.isPending}
            >
              <Plus className="h-4 w-4" /> Registrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {findings.map((f) => (
          <ApontamentoCard key={f.id} finding={f} auditId={auditId} unitId={unitId} />
        ))}
      </div>
    </div>
  );
}

function ApontamentoCard({
  finding,
  auditId,
  unitId,
}: {
  finding: AuditFindingRow;
  auditId: string;
  unitId?: string | null;
}) {
  const generateNc = useGenerateNcFromFinding();
  const [acaoOpen, setAcaoOpen] = useState(false);
  const closeFinding = useCloseFinding();
  const [closeOpen, setCloseOpen] = useState(false);

  function gerarNC() {
    generateNc.mutate(
      {
        findingId: finding.id,
        auditId,
        description: finding.description,
        type: finding.type,
        unitId: unitId ?? undefined,
      },
      { onSuccess: ({ nc }) => toast.success(`NC ${nc.codigo} gerada`) },
    );
  }

  const podeEncerrar =
    finding.status === "em_tratativa" || finding.status === "aguardando_verificacao";

  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold text-foreground">
            {finding.code}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
              CLASSIFICATION_META[finding.type].badge,
            )}
          >
            {CLASSIFICATION_META[finding.type].long}
          </span>
          {finding.norm_requirement && (
            <span className="text-xs text-muted-foreground">
              Item <span className="font-mono">{finding.norm_requirement}</span>
            </span>
          )}
          <Badge
            variant="outline"
            className={cn("border text-[11px]", FINDING_STATUS_CLS[finding.status])}
          >
            {FINDING_STATUS_LABEL[finding.status]}
          </Badge>
        </div>
        <p className="text-sm text-foreground">{finding.description}</p>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {finding.generated_nc ? (
            <Link
              to="/nao-conformidades/$id"
              params={{ id: finding.generated_nc.id }}
              className="inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/10"
            >
              <Link2 className="h-3.5 w-3.5" /> {finding.generated_nc.code}
            </Link>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={gerarNC}
              disabled={generateNc.isPending}
            >
              <FileText className="h-3.5 w-3.5" /> Gerar Não Conformidade
            </Button>
          )}
          {finding.generated_action_plan ? (
            <Link
              to="/planos-de-acao/$id"
              params={{ id: finding.generated_action_plan.id }}
              className="inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/10"
            >
              <Link2 className="h-3.5 w-3.5" /> {finding.generated_action_plan.code}
            </Link>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={() => setAcaoOpen(true)}
            >
              <ClipboardList className="h-3.5 w-3.5" /> Gerar Plano de Ação
            </Button>
          )}
          {podeEncerrar && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-8 gap-1"
              onClick={() => setCloseOpen(true)}
            >
              Encerrar apontamento
            </Button>
          )}
        </div>
      </CardContent>

      <GerarPlanoDialog
        open={acaoOpen}
        onOpenChange={setAcaoOpen}
        finding={finding}
        auditId={auditId}
        unitId={unitId}
      />
      <EncerrarDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        onConfirm={(effective) =>
          closeFinding.mutate(
            { id: finding.id, effective },
            { onSuccess: () => setCloseOpen(false) },
          )
        }
      />
    </Card>
  );
}

function GerarPlanoDialog({
  open,
  onOpenChange,
  finding,
  auditId,
  unitId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  finding: AuditFindingRow;
  auditId: string;
  unitId?: string | null;
}) {
  const { data: members = [] } = useOrgMembers();
  const generatePlan = useGenerateActionPlanFromFinding();
  const [porque, setPorque] = useState("");
  const [onde, setOnde] = useState("");
  const [responsavelId, setResponsavelId] = useState<string | undefined>(undefined);
  const [como, setComo] = useState("");
  const [prazo, setPrazo] = useState("");

  function confirmar() {
    if (!porque.trim() || !onde.trim() || !responsavelId || !como.trim() || !prazo) {
      toast.error("Preencha todos os campos do 5W2H.");
      return;
    }
    generatePlan.mutate(
      {
        findingId: finding.id,
        auditId,
        description: finding.description,
        ncId: finding.generated_nc?.id,
        unitId: unitId ?? undefined,
        acao: {
          oque: finding.description,
          porque,
          onde,
          responsavelId,
          prazo: new Date(prazo),
          como,
          quanto: 0,
        },
      },
      {
        onSuccess: ({ plan }) => {
          toast.success(`Plano ${plan.code} criado`);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar Plano de Ação — {finding.code}</DialogTitle>
          <DialogDescription>Preencha o 5W2H mínimo da primeira ação corretiva.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Por quê (causa)</Label>
            <Textarea
              value={porque}
              onChange={(e) => setPorque(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Onde</Label>
              <Input value={onde} onChange={(e) => setOnde(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Quem</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Como</Label>
            <Textarea
              value={como}
              onChange={(e) => setComo(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
          <div>
            <Label className="text-xs">Prazo</Label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-brand hover:bg-brand/90"
            onClick={confirmar}
            disabled={generatePlan.isPending}
          >
            Criar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EncerrarDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (effective: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar apontamento</DialogTitle>
          <DialogDescription>
            A tratativa (NC/Plano de Ação vinculados) foi eficaz?
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="gap-1.5 border-[color:var(--success)]/40 text-[color:var(--success)]"
            onClick={() => onConfirm(true)}
          >
            <Check className="h-4 w-4" /> Eficaz
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 border-[color:var(--severity-critical)]/40 text-[color:var(--severity-critical)]"
            onClick={() => onConfirm(false)}
          >
            <X className="h-4 w-4" /> Não eficaz
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
