import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  useAuditReport,
  useUpsertReport,
  useUpdateAuditStatus,
  useFindings,
  useChecklistItems,
  type AuditRow,
  type ReportRecommendationDb,
} from "@/lib/queries/audits";

export function AbaRelatorio({ audit }: { audit: AuditRow }) {
  const navigate = useNavigate();
  const { data: report } = useAuditReport(audit.id);
  const { data: findings = [] } = useFindings(audit.id);
  const { data: checklist = [] } = useChecklistItems(audit.id);
  const upsertReport = useUpsertReport();
  const updateStatus = useUpdateAuditStatus();

  const [summary, setSummary] = useState(report?.summary ?? "");
  const [positivePoints, setPositivePoints] = useState(report?.positive_points ?? "");
  const [conclusion, setConclusion] = useState(report?.conclusion ?? "");
  const [recommendation, setRecommendation] = useState<ReportRecommendationDb | undefined>(
    report?.recommendation ?? undefined,
  );

  const avaliados = checklist.filter((c) => c.classification).length;
  const checklistCompleto = checklist.length > 0 && avaliados === checklist.length;
  const conformes = checklist.filter((c) => c.classification === "C").length;
  const pctConformidade = checklist.length ? Math.round((conformes / checklist.length) * 100) : 0;
  const totalNCC = findings.filter((f) => f.type === "NCC").length;
  const bloqueiaManutencao = totalNCC > 0;

  const jaEmitido = Boolean(report?.generated_at);

  function salvarRascunho() {
    upsertReport.mutate(
      { auditId: audit.id, summary, positivePoints, conclusion, recommendation },
      { onSuccess: () => toast.success("Rascunho salvo") },
    );
  }

  function emitir() {
    if (!checklistCompleto) {
      toast.error("Conclua o checklist antes de emitir o relatório.");
      return;
    }
    upsertReport.mutate(
      { auditId: audit.id, summary, positivePoints, conclusion, recommendation, emit: true },
      {
        onSuccess: () => {
          updateStatus.mutate(
            { id: audit.id, status: "concluida" },
            { onSuccess: () => toast.success("Relatório emitido — auditoria concluída") },
          );
        },
      },
    );
  }

  if (jaEmitido) {
    return (
      <Card className="rounded-xl">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)]">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Relatório emitido</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {audit.code} concluída em{" "}
              {new Date(report!.generated_at!).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-left">
              <div className="text-[11px] uppercase text-muted-foreground">Conformidade</div>
              <div className="text-2xl font-bold text-brand">{pctConformidade}%</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-left">
              <div className="text-[11px] uppercase text-muted-foreground">Apontamentos</div>
              <div className="text-2xl font-bold text-foreground">{findings.length}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-left">
              <div className="text-[11px] uppercase text-muted-foreground">NCs Críticas</div>
              <div className="text-2xl font-bold text-[color:var(--severity-critical)]">
                {totalNCC}
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate({ to: "/auditorias" })}>
            Voltar ao programa
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-xl">
        <CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm">
          <span>
            Conformidade: <strong className="text-brand">{pctConformidade}%</strong>
          </span>
          <span>
            Apontamentos: <strong>{findings.length}</strong>
          </span>
          <span>
            NCs Críticas:{" "}
            <strong className="text-[color:var(--severity-critical)]">{totalNCC}</strong>
          </span>
          {!checklistCompleto && (
            <span className="ml-auto text-xs text-[color:var(--severity-high)]">
              Checklist ainda não concluído — {avaliados}/{checklist.length} itens avaliados.
            </span>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="min-h-[70px]"
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pontos fortes observados</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={positivePoints}
            onChange={(e) => setPositivePoints(e.target.value)}
            className="min-h-[70px]"
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conclusão da equipe auditora</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recomendação</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={recommendation}
            onValueChange={(v) => setRecommendation(v as ReportRecommendationDb)}
          >
            <label
              className={cn(
                "flex items-center gap-2 rounded-lg border border-border p-2 text-sm",
                bloqueiaManutencao && "cursor-not-allowed opacity-50",
              )}
            >
              <RadioGroupItem value="manutencao_certificacao" disabled={bloqueiaManutencao} />
              Manutenção da certificação
              {bloqueiaManutencao && <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
              <RadioGroupItem value="reauditoria" />
              Reauditoria necessária
            </label>
          </RadioGroup>
          {bloqueiaManutencao && (
            <p className="mt-2 text-xs text-muted-foreground">
              Manutenção bloqueada — há {totalNCC} não conformidade(s) crítica(s) em aberto.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={salvarRascunho} disabled={upsertReport.isPending}>
          Salvar rascunho
        </Button>
        <Button
          className="bg-brand hover:bg-brand/90"
          onClick={emitir}
          disabled={upsertReport.isPending || updateStatus.isPending}
        >
          Emitir relatório e concluir auditoria
        </Button>
      </div>
    </div>
  );
}
