import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldCheck, Trash2, Lock } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useOrgMembers, type OrgMember } from "@/lib/queries/action-plans";
import {
  AUDIT_EVENT_LABEL,
  useCreateAudit,
  type AuditEventDb,
  type AuditTypeDb,
} from "@/lib/queries/audits";

const EVENTOS: AuditEventDb[] = [
  "certificacao",
  "monitoracao_12m",
  "monitoracao_24m",
  "recertificacao",
];
const NORMAS_BLOQUEADAS = ["ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001"];

function ChipToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand text-white"
          : "border-border bg-card text-muted-foreground hover:bg-brand-soft/60",
      )}
    >
      {label}
    </button>
  );
}

export function NovaAuditoriaWizard() {
  const navigate = useNavigate();
  const { data: members = [] } = useOrgMembers();
  const createAudit = useCreateAudit();

  const [tipo, setTipo] = useState<AuditTypeDb>("interna");
  const [scope, setScope] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
  );

  // Interna
  const [leadAuditorId, setLeadAuditorId] = useState<string | undefined>(undefined);
  const [equipe, setEquipe] = useState<string[]>([]);

  // Externa
  const [certificadora, setCertificadora] = useState("");
  const [evento, setEvento] = useState<AuditEventDb | undefined>(undefined);
  const [auditoresExternos, setAuditoresExternos] = useState("");

  const equipeMembers = useMemo(
    () =>
      equipe
        .map((id) => members.find((m) => m.id === id))
        .filter((m): m is OrgMember => Boolean(m)),
    [equipe, members],
  );

  function toggleEquipe(id: string) {
    setEquipe((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    if (!scope.trim()) {
      toast.error("Descreva o escopo da auditoria.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("Data fim não pode ser anterior à data início.");
      return;
    }
    if (tipo === "interna" && !leadAuditorId) {
      toast.error("Selecione o auditor líder.");
      return;
    }
    if (tipo === "externa" && (!certificadora.trim() || !evento)) {
      toast.error("Informe a certificadora e o evento.");
      return;
    }

    const auditorRows =
      tipo === "interna"
        ? [
            ...(leadAuditorId
              ? [
                  {
                    name: members.find((m) => m.id === leadAuditorId)!.fullName,
                    isInternal: true,
                    userId: leadAuditorId,
                  },
                ]
              : []),
            ...equipeMembers
              .filter((m) => m.id !== leadAuditorId)
              .map((m) => ({ name: m.fullName, isInternal: true, userId: m.id })),
          ]
        : auditoresExternos
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean)
            .map((name) => ({ name, isInternal: false }));

    createAudit.mutate(
      {
        type: tipo,
        scope,
        startDate,
        endDate,
        leadAuditorId: tipo === "interna" ? leadAuditorId : undefined,
        externalCertifier: tipo === "externa" ? certificadora : undefined,
        event: tipo === "externa" ? evento : undefined,
        auditors: auditorRows,
      },
      {
        onSuccess: (audit) => {
          toast.success(`${audit.code} programada`);
          navigate({ to: "/auditorias/$id", params: { id: audit.id } });
        },
      },
    );
  }

  return (
    <AppShell>
      <TooltipProvider>
        <div className="mx-auto max-w-[900px] space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Programar Nova Auditoria
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Auditoria externa é uma casca leve — a execução acontece no sistema da certificadora.
              Auditoria interna ganha plano, checklist e apontamentos na própria tela de detalhe,
              logo após ser criada.
            </p>
          </div>

          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tipo</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <ChipToggle
                label="Interna"
                active={tipo === "interna"}
                onClick={() => setTipo("interna")}
              />
              <ChipToggle
                label="Externa"
                active={tipo === "externa"}
                onClick={() => setTipo("externa")}
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Norma</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <span className="rounded-full border border-brand bg-brand px-4 py-1.5 text-sm font-medium text-white">
                ISO 9001
              </span>
              {NORMAS_BLOQUEADAS.map((n) => (
                <Tooltip key={n}>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground opacity-50">
                      <Lock className="h-3 w-3" /> {n}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Disponível apenas na opção Personalizado</TooltipContent>
                </Tooltip>
              ))}
            </CardContent>
          </Card>

          {tipo === "externa" ? (
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Registro externo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Certificadora</Label>
                  <Input
                    value={certificadora}
                    onChange={(e) => setCertificadora(e.target.value)}
                    placeholder="Ex.: BRTÜV"
                  />
                </div>
                <div>
                  <Label className="text-xs">Evento</Label>
                  <Select value={evento} onValueChange={(v) => setEvento(v as AuditEventDb)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENTOS.map((e) => (
                        <SelectItem key={e} value={e}>
                          {AUDIT_EVENT_LABEL[e]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">
                    Auditores da certificadora (separados por vírgula)
                  </Label>
                  <Input
                    value={auditoresExternos}
                    onChange={(e) => setAuditoresExternos(e.target.value)}
                    placeholder="Ex.: João Silva, Maria Souza"
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Equipe auditora</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Auditor líder</Label>
                  <Select value={leadAuditorId} onValueChange={setLeadAuditorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
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
                <div>
                  <Label className="text-xs">Equipe (opcional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {equipeMembers.map((m) => (
                      <span
                        key={m.id}
                        className="flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pl-3 pr-1"
                      >
                        <span className="text-xs font-medium text-foreground">{m.fullName}</span>
                        <button
                          type="button"
                          onClick={() => toggleEquipe(m.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <Select value="" onValueChange={(v) => v && toggleEquipe(v)}>
                      <SelectTrigger className="h-8 w-[200px] text-xs">
                        <SelectValue placeholder="+ Adicionar pessoa" />
                      </SelectTrigger>
                      <SelectContent>
                        {members
                          .filter((m) => !equipe.includes(m.id) && m.id !== leadAuditorId)
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.fullName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                  Independência e confidencialidade são declaradas por cada auditor ao aceitar a
                  designação.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Escopo e datas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="text-xs">Escopo</Label>
                <Textarea
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              <div>
                <Label className="text-xs">Data início</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Data fim</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              className="bg-brand hover:bg-brand/90"
              onClick={submit}
              disabled={createAudit.isPending}
            >
              Programar auditoria
            </Button>
          </div>
        </div>
      </TooltipProvider>
    </AppShell>
  );
}
