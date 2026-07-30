import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Paperclip } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { AUDIT_CHECKLIST_TEMPLATE_ISO_9001 } from "@/lib/audit-checklist-template";
import {
  CLASSIFICATION_META,
  useChecklistItems,
  useEvaluateChecklistItem,
  useSeedAuditChecklist,
  useAttachChecklistEvidence,
  type AuditChecklistItemRow,
  type ChecklistClassificationDb,
} from "@/lib/queries/audits";

const SECTIONS = [
  ...new Map(
    AUDIT_CHECKLIST_TEMPLATE_ISO_9001.map((t) => [t.sectionNumero, t.sectionTitulo]),
  ).entries(),
];
const ITEMS_BY_SECTION = new Map<string, { numero: string; titulo: string }[]>();
for (const t of AUDIT_CHECKLIST_TEMPLATE_ISO_9001) {
  const list = ITEMS_BY_SECTION.get(t.sectionNumero) ?? [];
  if (!list.some((i) => i.numero === t.itemNumero))
    list.push({ numero: t.itemNumero, titulo: t.itemTitulo });
  ITEMS_BY_SECTION.set(t.sectionNumero, list);
}

const CLASSIFICATIONS: ChecklistClassificationDb[] = ["C", "OPM", "NCS", "NCM", "NCC"];

export function AbaChecklist({
  auditId,
  orgId,
  onGoTab,
}: {
  auditId: string;
  orgId: string;
  onGoTab?: (tab: string) => void;
}) {
  const { data: rows = [], isLoading } = useChecklistItems(auditId);
  const seed = useSeedAuditChecklist();
  const [selectedItem, setSelectedItem] = useState("4.3");

  useEffect(() => {
    if (!isLoading && rows.length === 0) {
      seed.mutate(auditId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, rows.length, auditId]);

  const byCode = useMemo(() => new Map(rows.map((r) => [r.requirement_code, r])), [rows]);
  const avaliados = rows.filter((r) => r.classification).length;
  const progresso = rows.length ? Math.round((avaliados / rows.length) * 100) : 0;

  const perguntasDoItem = AUDIT_CHECKLIST_TEMPLATE_ISO_9001.filter(
    (t) => t.itemNumero === selectedItem,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="rounded-xl">
        <CardContent className="space-y-3 p-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Progresso</span>
              <span className="font-semibold text-foreground">{progresso}%</span>
            </div>
            <Progress value={progresso} className="h-1.5" />
          </div>
          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {SECTIONS.map(([numero, titulo]) => (
              <div key={numero}>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {numero}. {titulo}
                </div>
                <div className="space-y-0.5">
                  {(ITEMS_BY_SECTION.get(numero) ?? []).map((item) => {
                    const codesForItem = AUDIT_CHECKLIST_TEMPLATE_ISO_9001.filter(
                      (t) => t.itemNumero === item.numero,
                    );
                    const done = codesForItem.every(
                      (t) => byCode.get(t.requirementCode)?.classification,
                    );
                    return (
                      <button
                        key={item.numero}
                        onClick={() => setSelectedItem(item.numero)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs",
                          selectedItem === item.numero
                            ? "bg-brand-soft text-brand"
                            : "text-foreground hover:bg-muted/50",
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[color:var(--success)]" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">
                          {item.numero} {item.titulo}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {perguntasDoItem.map((t) => {
          const row = byCode.get(t.requirementCode);
          if (!row) return null;
          return (
            <PerguntaCard
              key={t.requirementCode}
              auditId={auditId}
              orgId={orgId}
              template={t}
              row={row}
              onGoTab={onGoTab}
            />
          );
        })}
      </div>
    </div>
  );
}

function PerguntaCard({
  auditId,
  orgId,
  template,
  row,
  onGoTab,
}: {
  auditId: string;
  orgId: string;
  template: (typeof AUDIT_CHECKLIST_TEMPLATE_ISO_9001)[number];
  row: AuditChecklistItemRow;
  onGoTab?: (tab: string) => void;
}) {
  const [nota, setNota] = useState(row.evidence_notes ?? "");
  const evaluate = useEvaluateChecklistItem();
  const attachEvidence = useAttachChecklistEvidence();

  async function verEvidencia(path: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir a evidência");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  function anexar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    attachEvidence.mutate(
      { itemId: row.id, auditId, orgId, file, currentFiles: row.evidence_files },
      { onSuccess: () => toast.success("Evidência anexada") },
    );
    e.target.value = "";
  }

  useEffect(() => {
    setNota(row.evidence_notes ?? "");
  }, [row.evidence_notes]);

  function classificar(classification: ChecklistClassificationDb) {
    evaluate.mutate(
      {
        id: row.id,
        auditId,
        requirementCode: row.requirement_code,
        requirementTitle: row.requirement_title,
        classification,
        evidenceNotes: nota,
      },
      {
        onSuccess: () => {
          if (classification !== "C") {
            toast.success(`Apontamento gerado (${classification})`, {
              action: onGoTab
                ? { label: "Ver apontamentos", onClick: () => onGoTab("apontamentos") }
                : undefined,
            });
          }
        },
      },
    );
  }

  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-3 p-4">
        <div>
          <span className="font-mono text-xs text-muted-foreground">{row.requirement_code}</span>
          <p className="text-sm font-medium text-foreground">{row.requirement_title}</p>
          {template.guidance && (
            <p className="mt-0.5 text-xs text-muted-foreground">{template.guidance}</p>
          )}
        </div>
        <Textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onBlur={() => {
            if (row.classification) classificar(row.classification);
          }}
          placeholder="Registre a evidência observada…"
          className="min-h-[64px] resize-none text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          {row.evidence_files.map((f) => (
            <button
              key={f.path}
              onClick={() => verEvidencia(f.path)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="h-3 w-3" /> {f.name}
            </button>
          ))}
          <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-brand hover:underline">
            <input
              type="file"
              className="hidden"
              onChange={anexar}
              disabled={attachEvidence.isPending}
            />
            <Paperclip className="h-3 w-3" /> Anexar evidência
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CLASSIFICATIONS.map((c) => (
            <button
              key={c}
              onClick={() => classificar(c)}
              disabled={evaluate.isPending}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                row.classification === c
                  ? CLASSIFICATION_META[c].badge
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
              title={CLASSIFICATION_META[c].long}
            >
              {CLASSIFICATION_META[c].label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
