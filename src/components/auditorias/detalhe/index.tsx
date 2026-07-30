import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  ListChecks,
  ClipboardList,
  FileCheck2,
  Info,
  Paperclip,
  MapPin,
  Play,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  useAudit,
  useChecklistItems,
  useUpdateAuditStatus,
  AUDIT_EVENT_LABEL,
} from "@/lib/queries/audits";
import { Cabecalho } from "./cabecalho";
import { AbaPlano } from "./aba-plano";
import { AbaChecklist } from "./aba-checklist";
import { AbaApontamentos } from "./aba-apontamentos";
import { AbaRelatorio } from "./aba-relatorio";

export function AuditoriaDetailPage() {
  const params = useParams({ from: "/auditorias/$id" });
  const { data: audit, isLoading } = useAudit(params.id);
  const [tab, setTab] = useState("checklist");
  const { data: checklist = [] } = useChecklistItems(
    audit?.type === "interna" ? audit.id : undefined,
  );
  const updateStatus = useUpdateAuditStatus();

  if (isLoading || !audit) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1100px] py-10 text-sm text-muted-foreground">
          Carregando auditoria…
        </div>
      </AppShell>
    );
  }

  const avaliados = checklist.filter((c) => c.classification).length;
  const progresso = checklist.length ? Math.round((avaliados / checklist.length) * 100) : 0;

  if (audit.type === "externa") {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1100px] space-y-5">
          <Cabecalho audit={audit} />
          <AuditoriaExternaPanel auditId={audit.id} orgId={audit.org_id} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TooltipProvider>
        <div className="mx-auto max-w-[1400px] space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Cabecalho audit={audit} progresso={progresso} onGoTab={setTab} />
            {audit.status === "programada" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() =>
                  updateStatus.mutate(
                    { id: audit.id, status: "em_andamento" },
                    { onSuccess: () => toast.success("Auditoria iniciada") },
                  )
                }
              >
                <Play className="h-3.5 w-3.5" /> Iniciar auditoria
              </Button>
            )}
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="plano">
                <MapPin className="mr-1.5 h-4 w-4" /> Plano
              </TabsTrigger>
              <TabsTrigger value="checklist">
                <ListChecks className="mr-1.5 h-4 w-4" /> Checklist
              </TabsTrigger>
              <TabsTrigger value="apontamentos">
                <ClipboardList className="mr-1.5 h-4 w-4" /> Apontamentos
              </TabsTrigger>
              <TabsTrigger value="relatorio">
                <FileCheck2 className="mr-1.5 h-4 w-4" /> Relatório
              </TabsTrigger>
            </TabsList>
            <TabsContent value="plano" className="mt-4">
              <AbaPlano auditId={audit.id} />
            </TabsContent>
            <TabsContent value="checklist" className="mt-4">
              <AbaChecklist auditId={audit.id} orgId={audit.org_id} onGoTab={setTab} />
            </TabsContent>
            <TabsContent value="apontamentos" className="mt-4">
              <AbaApontamentos auditId={audit.id} unitId={audit.unit_id} />
            </TabsContent>
            <TabsContent value="relatorio" className="mt-4">
              <AbaRelatorio audit={audit} />
            </TabsContent>
          </Tabs>
        </div>
      </TooltipProvider>
    </AppShell>
  );
}

// ============================================================
// AUDITORIA EXTERNA — casca leve (datas, auditores, escopo, relatório)
// ============================================================
function AuditoriaExternaPanel({ auditId, orgId }: { auditId: string; orgId: string }) {
  const { data: audit } = useAudit(auditId);
  const reportPrefix = `${orgId}/audits/${auditId}/report`;
  const { data: files = [], refetch } = useQuery({
    queryKey: ["audit-external-report-files", auditId],
    queryFn: async (): Promise<{ name: string }[]> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.storage.from("evidencias").list(reportPrefix);
      if (error) throw error;
      return data.filter((f: { name: string }) => f.name !== ".emptyFolderPlaceholder");
    },
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.storage
      .from("evidencias")
      .upload(`${reportPrefix}/${file.name}`, file);
    if (error) {
      toast.error("Falha ao anexar relatório");
      return;
    }
    toast.success("Relatório da certificadora anexado");
    refetch();
    e.target.value = "";
  }

  async function abrir(name: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.storage
      .from("evidencias")
      .createSignedUrl(`${reportPrefix}/${name}`, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir o arquivo");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  if (!audit) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-brand/30 bg-brand-soft/40 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p className="text-muted-foreground">
          Auditorias externas são conduzidas no sistema da própria certificadora. Aqui a Jáwda
          mantém apenas o registro programado — datas, auditores, escopo e o relatório recebido. Não
          há plano detalhado, checklist ou apontamentos internos.
        </p>
      </div>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registro da auditoria externa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">Certificadora</div>
            <div className="text-sm text-foreground">{audit.external_certifier ?? "—"}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">Evento</div>
            <div className="text-sm text-foreground">
              {audit.event ? AUDIT_EVENT_LABEL[audit.event] : "—"}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">Datas programadas</div>
            <div className="text-sm text-foreground">
              {new Date(audit.start_date).toLocaleDateString("pt-BR")} —{" "}
              {new Date(audit.end_date).toLocaleDateString("pt-BR")}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">Líder</div>
            <div className="text-sm text-foreground">{audit.lead_auditor?.full_name ?? "—"}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-[11px] uppercase text-muted-foreground">Escopo</div>
            <div className="text-sm text-foreground">{audit.scope}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Relatório da certificadora</CardTitle>
          <p className="text-xs text-muted-foreground">
            Anexe o relatório emitido pela certificadora para arquivamento e rastreabilidade.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {files.length > 0 && (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {files.map((f) => (
                <button
                  key={f.name}
                  onClick={() => abrir(f.name)}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-left text-xs hover:bg-muted/50"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded bg-brand-soft text-brand">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {f.name}
                  </div>
                </button>
              ))}
            </div>
          )}
          <label className="inline-flex cursor-pointer">
            <input type="file" className="hidden" onChange={handleFile} accept="application/pdf" />
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand/90">
              <Paperclip className="h-4 w-4" /> Anexar relatório
            </span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
