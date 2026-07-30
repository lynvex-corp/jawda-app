import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AUDIT_EVENT_LABEL,
  AUDIT_STATUS_LABEL,
  AUDIT_TYPE_LABEL,
  type AuditRow,
} from "@/lib/queries/audits";

export function Cabecalho({
  audit,
  progresso,
  onGoTab,
}: {
  audit: AuditRow;
  /** % do checklist concluído — só relevante (e exibido) para interna. */
  progresso?: number;
  onGoTab?: (tab: string) => void;
}) {
  const externa = audit.type === "externa";
  return (
    <div>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="mb-2 h-8 gap-1 px-2 text-muted-foreground"
      >
        <Link to="/auditorias">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{audit.code}</span>
            <span>·</span>
            <span>
              {AUDIT_TYPE_LABEL[audit.type]}
              {externa && audit.external_certifier ? ` — ${audit.external_certifier}` : ""}
            </span>
            {audit.lead_auditor && (
              <>
                <span>·</span>
                <span>Líder: {audit.lead_auditor.full_name}</span>
              </>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {externa
              ? audit.event
                ? AUDIT_EVENT_LABEL[audit.event]
                : "Auditoria Externa"
              : "Auditoria Interna — ISO 9001"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{audit.scope}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="inline-flex items-center rounded-full border border-brand/20 bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
              ISO 9001
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge variant="outline" className="border-brand/40 bg-brand-soft text-brand">
            {AUDIT_STATUS_LABEL[audit.status]}
          </Badge>
          {externa ? (
            <span className="text-[11px] text-muted-foreground">
              Registro externo — executada pela certificadora
            </span>
          ) : (
            <button
              onClick={() => onGoTab?.("checklist")}
              className="text-[11px] text-muted-foreground hover:text-brand"
              title="Ir para checklist"
            >
              Checklist {progresso ?? 0}% concluído
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
