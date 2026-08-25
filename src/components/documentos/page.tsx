import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, FileText, History, FilePlus2, X, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useOrgMembers } from "@/lib/queries/action-plans";
import { LockedDocumentBanner, VersionHistoryCard } from "@/components/estrategia/formal-document";
import {
  DOCUMENT_TYPE_OPTIONS,
  useDocuments,
  useCreateDocument,
  useDocumentRevisions,
  useRegisterDocumentRevision,
  useUpdateDocumentStatus,
  useQualityPolicyCurrent,
  useQualityPolicyHistory,
  useStartFirstQualityPolicyDraft,
  useStartNewQualityPolicyVersion,
  useFormalizeQualityPolicy,
  useUpdateQualityPolicyContent,
  useMeetingMinutes,
  useCreateMeetingMinute,
  useAttendanceLists,
  useCreateAttendanceList,
  type DocumentItem,
  type DocumentStatus,
  type DocumentType,
  type MeetingParticipant,
  type AttendanceParticipant,
} from "@/lib/queries/documentos";

const statusLabel: Record<DocumentStatus, string> = {
  vigente: "Vigente",
  em_revisao: "Em revisão",
  inutilizado_revogado: "Inutilizado/Revogado",
};

const statusColor: Record<DocumentStatus, string> = {
  vigente:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  em_revisao:
    "bg-[color:var(--warning)]/20 text-[color:var(--severity-high)] border-[color:var(--warning)]/40",
  inutilizado_revogado: "bg-muted text-muted-foreground border-border",
};

const typeLabel: Record<DocumentType, string> = Object.fromEntries(
  DOCUMENT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DocumentType, string>;

/** Documentos "externos" — leis e normas vêm de fora da organização. O
 * modelo de dados (Parte 1 do prompt) não tem coluna própria pra
 * interno/externo; deriva-se do `type`, mantendo a divisão em abas do
 * protótipo original sem inventar uma coluna que a especificação não
 * pediu. */
const isExternalType = (t: DocumentType) => t === "lei" || t === "norma";

export function DocumentosPage() {
  const { currentOrg } = useAuth();
  const isQualityAuthorized =
    currentOrg?.role === "admin" || currentOrg?.role === "quality_manager";

  const { data: documents = [] } = useDocuments();
  const { data: members = [] } = useOrgMembers();
  const createDocument = useCreateDocument();

  const [busca, setBusca] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [novo, setNovo] = useState({
    code: "",
    title: "",
    type: "procedimento" as DocumentType,
    responsibleId: "",
    elaboradorId: "",
  });
  const [revisarDoc, setRevisarDoc] = useState<DocumentItem | null>(null);

  const internos = documents.filter((d) => !isExternalType(d.type));
  const externos = documents.filter((d) => isExternalType(d.type));
  const filt = (arr: DocumentItem[]) =>
    arr.filter((d) => (d.code + d.title).toLowerCase().includes(busca.toLowerCase()));

  const salvarNovo = () => {
    if (!novo.code.trim() || !novo.title.trim()) {
      toast.error("Informe código e título");
      return;
    }
    createDocument.mutate(
      {
        code: novo.code.trim(),
        title: novo.title.trim(),
        type: novo.type,
        responsibleId: novo.responsibleId || null,
        elaboradorId: novo.elaboradorId || null,
      },
      {
        onSuccess: () => {
          toast.success("Documento registrado");
          setNovo({
            code: "",
            title: "",
            type: "procedimento",
            responsibleId: "",
            elaboradorId: "",
          });
          setNovoOpen(false);
        },
        onError: (e) =>
          toast.error("Erro ao registrar documento", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Documentos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Informação documentada — controle de documentos, Política da Qualidade, atas e listas
              de frequência.
            </p>
          </div>
        </header>

        <Tabs defaultValue="int">
          <TabsList className="rounded-lg bg-muted/60 p-1">
            <TabsTrigger value="int" className="rounded-md text-xs">
              Internos ({internos.length})
            </TabsTrigger>
            <TabsTrigger value="ext" className="rounded-md text-xs">
              Externos ({externos.length})
            </TabsTrigger>
            <TabsTrigger value="politica" className="rounded-md text-xs">
              Política da Qualidade
            </TabsTrigger>
            <TabsTrigger value="atas" className="rounded-md text-xs">
              Atas de Reunião
            </TabsTrigger>
            <TabsTrigger value="frequencia" className="rounded-md text-xs">
              Lista de Frequência
            </TabsTrigger>
          </TabsList>

          <TabsContent value="int" className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-9 w-64 rounded-lg pl-8 text-xs"
                  placeholder="Buscar por código ou título…"
                />
              </div>
              {isQualityAuthorized && (
                <Button
                  size="sm"
                  onClick={() => setNovoOpen(true)}
                  className="rounded-lg bg-brand text-white hover:bg-brand/90"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Novo documento
                </Button>
              )}
            </div>
            <DocTable
              docs={filt(internos)}
              isQualityAuthorized={isQualityAuthorized}
              onRevisar={setRevisarDoc}
            />
          </TabsContent>

          <TabsContent value="ext" className="mt-4 space-y-3">
            <DocTable
              docs={filt(externos)}
              isQualityAuthorized={isQualityAuthorized}
              onRevisar={setRevisarDoc}
            />
          </TabsContent>

          <TabsContent value="politica" className="mt-4">
            <PoliticaQualidadeTab isQualityAuthorized={isQualityAuthorized} />
          </TabsContent>

          <TabsContent value="atas" className="mt-4">
            <AtasReuniaoTab isQualityAuthorized={isQualityAuthorized} />
          </TabsContent>

          <TabsContent value="frequencia" className="mt-4">
            <ListaFrequenciaTab isQualityAuthorized={isQualityAuthorized} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Novo documento</DialogTitle>
            <DialogDescription>
              Nasce na revisão 01. Revisões seguintes ficam preservadas no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Código</label>
                <Input
                  value={novo.code}
                  onChange={(e) => setNovo({ ...novo, code: e.target.value })}
                  placeholder="Ex.: PO.SGI.003"
                  className="rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Tipo</label>
                <Select
                  value={novo.type}
                  onValueChange={(v) => setNovo({ ...novo, type: v as DocumentType })}
                >
                  <SelectTrigger className="rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Título</label>
              <Input
                value={novo.title}
                onChange={(e) => setNovo({ ...novo, title: e.target.value })}
                className="rounded-md"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Responsável</label>
                <Select
                  value={novo.responsibleId}
                  onValueChange={(v) => setNovo({ ...novo, responsibleId: v })}
                >
                  <SelectTrigger className="rounded-md">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...members]
                      .sort((a, b) => a.fullName.localeCompare(b.fullName))
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fullName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Elaborador</label>
                <Select
                  value={novo.elaboradorId}
                  onValueChange={(v) => setNovo({ ...novo, elaboradorId: v })}
                >
                  <SelectTrigger className="rounded-md">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...members]
                      .sort((a, b) => a.fullName.localeCompare(b.fullName))
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fullName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarNovo} className="bg-brand text-white hover:bg-brand/90">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RevisaoDialog document={revisarDoc} onClose={() => setRevisarDoc(null)} />
    </AppShell>
  );
}

function DocTable({
  docs,
  isQualityAuthorized,
  onRevisar,
}: {
  docs: DocumentItem[];
  isQualityAuthorized: boolean;
  onRevisar: (doc: DocumentItem) => void;
}) {
  const updateStatus = useUpdateDocumentStatus();

  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <TableHead>Código</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Rev.</TableHead>
            <TableHead>Última revisão</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Elaborador</TableHead>
            <TableHead>Responsável</TableHead>
            {isQualityAuthorized && <TableHead className="text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((d) => (
            <TableRow key={d.id} className="text-xs">
              <TableCell className="font-mono text-[11px] font-semibold text-brand">
                {d.code}
              </TableCell>
              <TableCell className="max-w-[280px] text-foreground/85">{d.title}</TableCell>
              <TableCell>
                <Badge variant="outline" className="rounded-md text-[10px]">
                  {typeLabel[d.type]}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-[11px] text-foreground/85">
                {String(d.currentRevision).padStart(2, "0")}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {d.lastRevisionDate
                  ? new Date(d.lastRevisionDate).toLocaleDateString("pt-BR")
                  : "—"}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn("rounded-md border text-[10px]", statusColor[d.status])}
                >
                  {statusLabel[d.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{d.elaboradorName ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{d.responsibleName ?? "—"}</TableCell>
              {isQualityAuthorized && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-md px-2 text-[11px]"
                      disabled={d.status === "inutilizado_revogado"}
                      onClick={() => onRevisar(d)}
                    >
                      <History className="mr-1 h-3 w-3" /> Revisar
                    </Button>
                    {d.status !== "inutilizado_revogado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-md px-2 text-[11px] text-destructive hover:text-destructive"
                        onClick={() =>
                          updateStatus.mutate(
                            { id: d.id, status: "inutilizado_revogado" },
                            {
                              onError: (e) =>
                                toast.error("Erro ao inutilizar/revogar", {
                                  description: getErrorMessage(e),
                                }),
                            },
                          )
                        }
                      >
                        <ShieldOff className="mr-1 h-3 w-3" /> Inutilizar/Revogar
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {docs.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                Nenhum documento registrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RevisaoDialog({
  document: doc,
  onClose,
}: {
  document: DocumentItem | null;
  onClose: () => void;
}) {
  const { data: revisions = [] } = useDocumentRevisions(doc?.id ?? null);
  const registerRevision = useRegisterDocumentRevision();
  const [conteudo, setConteudo] = useState("");

  useEffect(() => {
    setConteudo("");
  }, [doc?.id]);

  if (!doc) return null;

  const salvar = () => {
    if (!conteudo.trim()) {
      toast.error("Informe o conteúdo ou o link do arquivo da nova revisão");
      return;
    }
    registerRevision.mutate(
      { documentId: doc.id, contentOrFileUrl: conteudo.trim() },
      {
        onSuccess: () => {
          toast.success(`Revisão ${String(doc.currentRevision + 1).padStart(2, "0")} registrada`);
          setConteudo("");
        },
        onError: (e) =>
          toast.error("Erro ao registrar revisão", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <Dialog open={!!doc} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            Revisar {doc.code} — {doc.title}
          </DialogTitle>
          <DialogDescription>
            Uma nova revisão nunca sobrescreve a anterior — o histórico fica preservado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">
            Conteúdo ou link do arquivo (revisão {String(doc.currentRevision + 1).padStart(2, "0")})
          </label>
          <Textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            className="min-h-[100px] rounded-md text-sm"
            placeholder="Cole o texto da revisão ou o link do arquivo"
          />
        </div>
        {revisions.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Histórico
            </div>
            <ol className="max-h-40 space-y-1.5 overflow-y-auto">
              {revisions.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-border/60 p-2 text-[11px] text-muted-foreground"
                >
                  <span className="font-mono font-semibold text-foreground">
                    Rev. {String(r.revisionNumber).padStart(2, "0")}
                  </span>{" "}
                  — {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  {r.createdByName ? ` — ${r.createdByName}` : ""}
                </li>
              ))}
            </ol>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={salvar} className="bg-brand text-white hover:bg-brand/90">
            Registrar revisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PoliticaQualidadeTab({ isQualityAuthorized }: { isQualityAuthorized: boolean }) {
  const { data, isLoading } = useQualityPolicyCurrent();
  const { data: history } = useQualityPolicyHistory();
  const startFirstDraft = useStartFirstQualityPolicyDraft();
  const startNewVersion = useStartNewQualityPolicyVersion();
  const formalize = useFormalizeQualityPolicy();
  const updateContent = useUpdateQualityPolicyContent();

  const [content, setContent] = useState("");
  const [formalizeOpen, setFormalizeOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");

  const policy = data?.policy ?? null;
  const isDraft = data?.isDraft ?? false;

  useEffect(() => {
    if (policy) setContent(policy.content);
  }, [policy?.id]);

  const salvar = () => {
    if (!policy) return;
    updateContent.mutate(
      { id: policy.id, content },
      { onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }) },
    );
  };

  const confirmarFormalizacao = () => {
    if (!policy || !versionLabel.trim()) {
      toast.error("Informe o rótulo da versão");
      return;
    }
    formalize.mutate(
      { id: policy.id, versionLabel: versionLabel.trim() },
      {
        onSuccess: () => {
          toast.success("Política da Qualidade formalizada", { description: versionLabel.trim() });
          setFormalizeOpen(false);
          setVersionLabel("");
        },
        onError: (e) =>
          toast.error("Não foi possível formalizar", { description: getErrorMessage(e) }),
      },
    );
  };

  const iniciarNovaVersao = () => {
    startNewVersion.mutate(undefined, {
      onSuccess: () => toast.success("Nova versão criada a partir da última formalizada"),
      onError: (e) =>
        toast.error("Não foi possível iniciar nova versão", { description: getErrorMessage(e) }),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <FilePlus2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Nenhuma Política da Qualidade ainda
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inicie o primeiro rascunho para começar o cadastro.
          </p>
        </div>
        {isQualityAuthorized && (
          <Button
            onClick={() => startFirstDraft.mutate()}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Iniciar rascunho
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isQualityAuthorized &&
          (isDraft ? (
            <Button
              size="sm"
              onClick={() => setFormalizeOpen(true)}
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
            >
              Formalizar Política da Qualidade
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={iniciarNovaVersao}
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
            >
              <History className="mr-1.5 h-4 w-4" /> Nova versão
            </Button>
          ))}
      </div>

      {!isDraft && (
        <LockedDocumentBanner>
          Esta é a última versão formalizada ({policy.versionLabel}) — somente leitura. Clique em
          "Nova versão" para editar.
        </LockedDocumentBanner>
      )}

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="p-6">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Texto da Política da Qualidade
          </label>
          <Textarea
            value={content}
            disabled={!isDraft || !isQualityAuthorized}
            onChange={(e) => setContent(e.target.value)}
            onBlur={salvar}
            className="mt-1.5 min-h-[160px] rounded-lg text-sm"
          />
        </CardContent>
      </Card>

      {history && history.length > 0 && (
        <VersionHistoryCard
          entries={history.map((h) => ({
            id: h.id,
            label: h.versionLabel ?? "",
            date: h.formalizedAt,
            byName: h.formalizedByName,
            snippet: h.content,
          }))}
        />
      )}

      <Dialog open={formalizeOpen} onOpenChange={setFormalizeOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Formalizar Política da Qualidade</DialogTitle>
            <DialogDescription>
              Só a Diretoria (Administrador do Cliente) pode formalizar. O texto fica somente
              leitura depois disso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Rótulo da versão</label>
            <Input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="Ex.: Política da Qualidade_01.2026"
              className="rounded-md"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormalizeOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarFormalizacao}
              className="bg-brand text-white hover:bg-brand/90"
            >
              Formalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AtasReuniaoTab({ isQualityAuthorized }: { isQualityAuthorized: boolean }) {
  const { data: atas = [], isLoading } = useMeetingMinutes();
  const createAta = useCreateMeetingMinute();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    meetingDate: "",
    agenda: "",
    deliberations: "",
  });
  const [participantes, setParticipantes] = useState<MeetingParticipant[]>([]);
  const [novoParticipante, setNovoParticipante] = useState("");

  const salvar = () => {
    if (!form.title.trim() || !form.meetingDate) {
      toast.error("Informe título e data da reunião");
      return;
    }
    createAta.mutate(
      { ...form, participants: participantes },
      {
        onSuccess: () => {
          toast.success("Ata registrada");
          setForm({ title: "", meetingDate: "", agenda: "", deliberations: "" });
          setParticipantes([]);
          setOpen(false);
        },
        onError: (e) => toast.error("Erro ao registrar ata", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {isQualityAuthorized && (
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nova Ata de Reunião
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {atas.map((a) => (
          <Card key={a.id} className="rounded-xl border-border/70 shadow-sm">
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{a.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(a.meetingDate).toLocaleDateString("pt-BR")} ·{" "}
                      {a.participants.length} participante(s)
                    </div>
                  </div>
                </div>
              </div>
              {a.agenda && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/80">Pauta: </span>
                  {a.agenda}
                </p>
              )}
              {a.deliberations && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/80">Deliberações: </span>
                  {a.deliberations}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && atas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
            Nenhuma ata registrada.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova Ata de Reunião</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-[1fr_140px] gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Título</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Data</label>
                <Input
                  type="date"
                  value={form.meetingDate}
                  onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
                  className="rounded-md"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Participantes</label>
              <div className="flex gap-2">
                <Input
                  value={novoParticipante}
                  onChange={(e) => setNovoParticipante(e.target.value)}
                  placeholder="Nome"
                  className="h-9 rounded-md text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novoParticipante.trim()) {
                      e.preventDefault();
                      setParticipantes([...participantes, { nome: novoParticipante.trim() }]);
                      setNovoParticipante("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!novoParticipante.trim()) return;
                    setParticipantes([...participantes, { nome: novoParticipante.trim() }]);
                    setNovoParticipante("");
                  }}
                >
                  Adicionar
                </Button>
              </div>
              {participantes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {participantes.map((p, i) => (
                    <Badge key={i} variant="outline" className="gap-1 rounded-md text-[10px]">
                      {p.nome}
                      <button
                        onClick={() => setParticipantes(participantes.filter((_, j) => j !== i))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Pauta</label>
              <Textarea
                value={form.agenda}
                onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                className="min-h-[70px] rounded-md text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Deliberações</label>
              <Textarea
                value={form.deliberations}
                onChange={(e) => setForm({ ...form, deliberations: e.target.value })}
                className="min-h-[70px] rounded-md text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} className="bg-brand text-white hover:bg-brand/90">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ListaFrequenciaTab({ isQualityAuthorized }: { isQualityAuthorized: boolean }) {
  const { data: listas = [], isLoading } = useAttendanceLists();
  const createLista = useCreateAttendanceList();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ eventTitle: "", eventDate: "" });
  const [participantes, setParticipantes] = useState<AttendanceParticipant[]>([]);
  const [novoParticipante, setNovoParticipante] = useState("");

  const salvar = () => {
    if (!form.eventTitle.trim() || !form.eventDate) {
      toast.error("Informe o evento e a data");
      return;
    }
    createLista.mutate(
      { ...form, participants: participantes },
      {
        onSuccess: () => {
          toast.success("Lista de frequência registrada");
          setForm({ eventTitle: "", eventDate: "" });
          setParticipantes([]);
          setOpen(false);
        },
        onError: (e) => toast.error("Erro ao registrar lista", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {isQualityAuthorized && (
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nova Lista de Frequência
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {listas.map((l) => {
          const confirmados = l.participants.filter((p) => p.confirmado).length;
          return (
            <Card key={l.id} className="rounded-xl border-border/70 shadow-sm">
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-foreground">{l.eventTitle}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(l.eventDate).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-md text-[10px]">
                    {confirmados}/{l.participants.length} confirmados
                  </Badge>
                </div>
                {l.participants.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {l.participants.map((p, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className={cn(
                          "rounded-md text-[10px]",
                          p.confirmado
                            ? "border-[color:var(--success)]/30 bg-[color:var(--success)]/15 text-[color:var(--success)]"
                            : "text-muted-foreground",
                        )}
                      >
                        {p.nome}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && listas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
            Nenhuma lista de frequência registrada.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova Lista de Frequência</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-[1fr_140px] gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Evento</label>
                <Input
                  value={form.eventTitle}
                  onChange={(e) => setForm({ ...form, eventTitle: e.target.value })}
                  className="rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Data</label>
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                  className="rounded-md"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Participantes</label>
              <div className="flex gap-2">
                <Input
                  value={novoParticipante}
                  onChange={(e) => setNovoParticipante(e.target.value)}
                  placeholder="Nome"
                  className="h-9 rounded-md text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && novoParticipante.trim()) {
                      e.preventDefault();
                      setParticipantes([
                        ...participantes,
                        { nome: novoParticipante.trim(), confirmado: false },
                      ]);
                      setNovoParticipante("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!novoParticipante.trim()) return;
                    setParticipantes([
                      ...participantes,
                      { nome: novoParticipante.trim(), confirmado: false },
                    ]);
                    setNovoParticipante("");
                  }}
                >
                  Adicionar
                </Button>
              </div>
              {participantes.length > 0 && (
                <div className="space-y-1 pt-1">
                  {participantes.map((p, i) => (
                    <label
                      key={i}
                      className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5 text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={p.confirmado}
                          onChange={(e) =>
                            setParticipantes(
                              participantes.map((x, j) =>
                                j === i ? { ...x, confirmado: e.target.checked } : x,
                              ),
                            )
                          }
                        />
                        {p.nome}
                      </span>
                      <button
                        onClick={() => setParticipantes(participantes.filter((_, j) => j !== i))}
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} className="bg-brand text-white hover:bg-brand/90">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
