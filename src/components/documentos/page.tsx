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
import {
  Plus,
  Search,
  FileText,
  History,
  ShieldOff,
  Check,
  Paperclip,
  Undo2,
  FolderOpen,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { ParticipantesPicker } from "@/components/documentos/participantes-picker";
import { AnaliseCriticaPage } from "@/components/estrategia/analise-critica/page";
import { useOrgMembers } from "@/lib/queries/action-plans";
import {
  DOCUMENT_TYPE_OPTIONS,
  useDocuments,
  useCreateDocument,
  useDocumentRevisions,
  useRegisterDocumentRevision,
  useUpdateDocumentStatus,
  useMeetingMinutes,
  useCreateMeetingMinute,
  useAttendanceLists,
  useCreateAttendanceList,
  type DocumentItem,
  type DocumentStatus,
  type DocumentType,
  useUploadDocumentFile,
  useSetDocumentFile,
  useDocumentFileUrl,
  useReverseDocumentRevocation,
  useDocumentRevocationReversals,
  isStoredFile,
  storedFileName,
  useConfirmMeetingAttendance,
  useConfirmAttendanceListPresence,
  type EventParticipant,
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
  // A notificação de confirmação de presença aponta para
  // /documentos?aba=atas|frequencia — sem honrar isso, o clique cairia na
  // aba padrão (Internos) e o botão de confirmar ficaria escondido.
  const abaInicial = useRouterState({
    select: (state) => (state.location.search as { aba?: string })?.aba,
  });
  const isQualityAuthorized =
    currentOrg?.role === "admin" || currentOrg?.role === "quality_manager";

  const { data: documents = [] } = useDocuments();
  const { data: members = [] } = useOrgMembers();
  const createDocument = useCreateDocument();
  const uploadFile = useUploadDocumentFile();
  const setDocumentFile = useSetDocumentFile();

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
  const [reverterDoc, setReverterDoc] = useState<DocumentItem | null>(null);
  // Arquivo da revisão 01 (Bloco 3, item 2). Vale para interno E externo —
  // antes nenhum dos dois subia arquivo de verdade.
  const [novoArquivo, setNovoArquivo] = useState<File | null>(null);
  const [subindo, setSubindo] = useState(false);

  const internos = documents.filter((d) => !isExternalType(d.type));
  const externos = documents.filter((d) => isExternalType(d.type));
  const filt = (arr: DocumentItem[]) =>
    arr.filter((d) => (d.code + d.title).toLowerCase().includes(busca.toLowerCase()));

  const salvarNovo = () => {
    if (!novo.code.trim() || !novo.title.trim()) {
      toast.error("Informe código e título");
      return;
    }
    setSubindo(true);
    createDocument.mutate(
      {
        code: novo.code.trim(),
        title: novo.title.trim(),
        type: novo.type,
        responsibleId: novo.responsibleId || null,
        elaboradorId: novo.elaboradorId || null,
      },
      {
        onSuccess: async (documentId) => {
          // Upload depois da criação porque o path do Storage precisa do id
          // do documento. Se o upload falhar, o documento continua válido —
          // o arquivo pode entrar depois por uma revisão.
          if (novoArquivo && currentOrg?.org_id) {
            try {
              const stored = await uploadFile.mutateAsync({
                orgId: currentOrg.org_id,
                documentId,
                revision: 1,
                file: novoArquivo,
              });
              await setDocumentFile.mutateAsync({ documentId, storedValue: stored });
            } catch (err) {
              toast.error("Documento criado, mas o arquivo não subiu", {
                description: getErrorMessage(err),
              });
            }
          }
          setSubindo(false);
          setNovoArquivo(null);
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
        onError: (e) => {
          setSubindo(false);
          toast.error("Erro ao registrar documento", { description: getErrorMessage(e) });
        },
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
              Publique documentos com controle de revisão e acompanhe o que está aguardando
              aprovação.
            </p>
          </div>
        </header>

        <Tabs defaultValue={abaInicial ?? "int"}>
          <TabsList className="rounded-lg bg-muted/60 p-1">
            <TabsTrigger value="int" className="rounded-md text-xs">
              Internos ({internos.length})
            </TabsTrigger>
            <TabsTrigger value="ext" className="rounded-md text-xs">
              Externos ({externos.length})
            </TabsTrigger>
            <TabsTrigger value="atas" className="rounded-md text-xs">
              Atas de Reunião
            </TabsTrigger>
            <TabsTrigger value="frequencia" className="rounded-md text-xs">
              Lista de Frequência
            </TabsTrigger>
            <TabsTrigger value="analise-critica" className="rounded-md text-xs">
              Análise Crítica
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
              onReverter={setReverterDoc}
            />
          </TabsContent>

          <TabsContent value="ext" className="mt-4 space-y-3">
            <DocTable
              docs={filt(externos)}
              isQualityAuthorized={isQualityAuthorized}
              onRevisar={setRevisarDoc}
              onReverter={setReverterDoc}
            />
          </TabsContent>

          <TabsContent value="atas" className="mt-4">
            <AtasReuniaoTab isQualityAuthorized={isQualityAuthorized} />
          </TabsContent>

          <TabsContent value="frequencia" className="mt-4">
            <ListaFrequenciaTab isQualityAuthorized={isQualityAuthorized} />
          </TabsContent>

          {/* Bloco 3, item 5: a Análise Crítica pela Direção saiu de
              Estratégia e passou a viver aqui. O detalhe fica em rota
              própria (/documentos/analise-critica/$id) porque é
              master-detail, não cabe dentro de uma aba. */}
          <TabsContent value="analise-critica" className="mt-4">
            <AnaliseCriticaPage embedded />
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
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Arquivo (revisão 01)</label>
              <Input
                type="file"
                onChange={(e) => setNovoArquivo(e.target.files?.[0] ?? null)}
                className="rounded-md text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Opcional. Vale tanto para documento interno quanto externo.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={salvarNovo}
              disabled={subindo}
              className="bg-brand text-white hover:bg-brand/90"
            >
              {subindo ? "Registrando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RevisaoDialog document={revisarDoc} onClose={() => setRevisarDoc(null)} />

      <ReverterRevogacaoDialog document={reverterDoc} onClose={() => setReverterDoc(null)} />
    </AppShell>
  );
}

function DocTable({
  docs,
  isQualityAuthorized,
  onRevisar,
  onReverter,
}: {
  docs: DocumentItem[];
  isQualityAuthorized: boolean;
  onRevisar: (doc: DocumentItem) => void;
  onReverter: (doc: DocumentItem) => void;
}) {
  const updateStatus = useUpdateDocumentStatus();
  const fileUrl = useDocumentFileUrl();

  // Bucket privado: não há URL pública, então o link é assinado na hora do
  // clique e vale 60s. Mesmo padrão do dossiê de Pessoas.
  const abrirArquivo = async (stored: string) => {
    try {
      const url = await fileUrl.mutateAsync(stored);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error("Não foi possível abrir o arquivo", { description: getErrorMessage(e) });
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <TableHead>Código</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Rev.</TableHead>
            <TableHead>Arquivo</TableHead>
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
              <TableCell>
                {isStoredFile(d.fileUrl) ? (
                  <button
                    type="button"
                    onClick={() => abrirArquivo(d.fileUrl as string)}
                    className="inline-flex max-w-[160px] items-center gap-1 truncate text-[11px] text-brand hover:underline"
                    title={storedFileName(d.fileUrl as string)}
                  >
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="truncate">{storedFileName(d.fileUrl as string)}</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
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
                    {d.status === "inutilizado_revogado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-md px-2 text-[11px]"
                        onClick={() => onReverter(d)}
                      >
                        <Undo2 className="mr-1 h-3 w-3" /> Reverter revogação
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {docs.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center text-xs text-muted-foreground">
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
  const uploadFile = useUploadDocumentFile();
  const fileUrl = useDocumentFileUrl();
  const { currentOrg } = useAuth();
  const [conteudo, setConteudo] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setConteudo("");
    setArquivo(null);
  }, [doc?.id]);

  const abrirArquivo = async (stored: string) => {
    try {
      const url = await fileUrl.mutateAsync(stored);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error("Não foi possível abrir o arquivo", { description: getErrorMessage(e) });
    }
  };

  if (!doc) return null;

  const proxima = doc.currentRevision + 1;

  const salvar = async () => {
    // Arquivo OU texto — a revisão precisa de um dos dois.
    if (!arquivo && !conteudo.trim()) {
      toast.error("Anexe um arquivo ou descreva o conteúdo da nova revisão");
      return;
    }
    setSalvando(true);
    try {
      let valor = conteudo.trim();
      if (arquivo) {
        if (!currentOrg?.org_id) throw new Error("Organização não identificada");
        valor = await uploadFile.mutateAsync({
          orgId: currentOrg.org_id,
          documentId: doc.id,
          revision: proxima,
          file: arquivo,
        });
      }
      await registerRevision.mutateAsync({ documentId: doc.id, contentOrFileUrl: valor });
      toast.success(`Revisão ${String(proxima).padStart(2, "0")} registrada`);
      setConteudo("");
      setArquivo(null);
    } catch (e) {
      toast.error("Erro ao registrar revisão", { description: getErrorMessage(e) });
    } finally {
      setSalvando(false);
    }
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
            Arquivo da revisão {String(proxima).padStart(2, "0")}
          </label>
          <Input
            type="file"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="rounded-md text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">
            {arquivo ? "Observação (opcional)" : "Ou descreva o conteúdo / cole um link"}
          </label>
          <Textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            disabled={!!arquivo}
            className="min-h-[80px] rounded-md text-sm"
            placeholder={
              arquivo ? "O arquivo anexado será o conteúdo desta revisão" : "Texto ou link"
            }
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
                  {isStoredFile(r.contentOrFileUrl) && (
                    <button
                      type="button"
                      onClick={() => abrirArquivo(r.contentOrFileUrl as string)}
                      className="ml-2 inline-flex items-center gap-1 text-brand hover:underline"
                    >
                      <Paperclip className="h-3 w-3" />
                      {storedFileName(r.contentOrFileUrl as string)}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button
            onClick={salvar}
            disabled={salvando}
            className="bg-brand text-white hover:bg-brand/90"
          >
            {salvando ? "Registrando…" : "Registrar revisão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * Lista de participantes com confirmação individual (Bloco 3, item 4).
 *
 * Compartilhada por Ata e Lista de Frequência — o comportamento é o mesmo
 * nas duas, só muda a RPC de confirmação.
 * ============================================================ */
function ParticipantesConfirmacao({
  participantes,
  onConfirmar,
  confirmando,
}: {
  participantes: EventParticipant[];
  onConfirmar: (participantId: string) => void;
  confirmando: boolean;
}) {
  const { user } = useAuth();
  if (participantes.length === 0) return null;

  const confirmados = participantes.filter((p) => p.confirmed).length;

  return (
    <div className="space-y-1.5 border-t border-border/60 pt-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Participantes — {confirmados} de {participantes.length} confirmaram
      </div>
      <div className="flex flex-wrap gap-1.5">
        {participantes.map((p) => {
          const souEu = !!user && p.linkedUserId === user.id;
          return (
            <Badge
              key={p.id}
              variant="outline"
              className={cn(
                "gap-1 rounded-md py-1 text-[11px] font-normal",
                p.confirmed
                  ? "border-[color:var(--success)]/30 bg-[color:var(--success)]/10"
                  : "border-border",
              )}
            >
              {p.confirmed && <Check className="h-3 w-3 text-[color:var(--success)]" />}
              <span className="text-foreground">{p.employeeName}</span>
              {p.jobPositionName && (
                <span className="text-muted-foreground">· {p.jobPositionName}</span>
              )}
              {souEu && !p.confirmed && (
                <button
                  type="button"
                  disabled={confirmando}
                  onClick={() => onConfirmar(p.id)}
                  className="ml-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-brand/90 disabled:opacity-60"
                >
                  Confirmar minha presença
                </button>
              )}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

/** Campos comuns aos dois formulários (item 1): horário, palestrante e
 * pasta de destino. `folder` é texto livre — não existe entidade de pasta
 * no sistema, é só o rótulo de arquivamento. */
function CamposEvento({
  time,
  speaker,
  folder,
  onChange,
}: {
  time: string;
  speaker: string;
  folder: string;
  onChange: (campo: "time" | "speaker" | "folder", valor: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Horário</label>
          <Input
            type="time"
            value={time}
            onChange={(e) => onChange("time", e.target.value)}
            className="rounded-md"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Palestrante</label>
          <Input
            value={speaker}
            onChange={(e) => onChange("speaker", e.target.value)}
            placeholder="Nome de quem conduziu"
            className="rounded-md"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Pasta de destino</label>
        <Input
          value={folder}
          onChange={(e) => onChange("folder", e.target.value)}
          placeholder="Ex.: Treinamentos 2026"
          className="rounded-md"
        />
      </div>
    </>
  );
}

function AtasReuniaoTab({ isQualityAuthorized }: { isQualityAuthorized: boolean }) {
  const { data: atas = [], isLoading } = useMeetingMinutes();
  const createAta = useCreateMeetingMinute();
  const confirmar = useConfirmMeetingAttendance();

  const [open, setOpen] = useState(false);
  const vazio = {
    title: "",
    meetingDate: "",
    meetingTime: "",
    speakerName: "",
    folder: "",
    agenda: "",
    deliberations: "",
  };
  const [form, setForm] = useState(vazio);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);

  const salvar = () => {
    if (!form.title.trim() || !form.meetingDate) {
      toast.error("Informe título e data da reunião");
      return;
    }
    createAta.mutate(
      {
        title: form.title,
        meetingDate: form.meetingDate,
        meetingTime: form.meetingTime || null,
        speakerName: form.speakerName.trim() || null,
        folder: form.folder.trim() || null,
        agenda: form.agenda,
        deliberations: form.deliberations,
        employeeIds,
      },
      {
        onSuccess: () => {
          toast.success("Ata registrada", {
            description:
              employeeIds.length > 0
                ? "Os participantes com conta foram notificados para confirmar presença."
                : undefined,
          });
          setForm(vazio);
          setEmployeeIds([]);
          setOpen(false);
        },
        onError: (e) => toast.error("Erro ao registrar ata", { description: getErrorMessage(e) }),
      },
    );
  };

  const confirmarPresenca = (participantId: string) =>
    confirmar.mutate(participantId, {
      onSuccess: () => toast.success("Presença confirmada"),
      onError: (e) =>
        toast.error("Não foi possível confirmar", { description: getErrorMessage(e) }),
    });

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
                      {new Date(a.meetingDate + "T00:00:00").toLocaleDateString("pt-BR")}
                      {a.meetingTime ? ` às ${a.meetingTime.slice(0, 5)}` : ""}
                      {a.speakerName ? ` · ${a.speakerName}` : ""}
                      {" · "}
                      {a.participantRows.length > 0
                        ? `${a.participantRows.length} participante(s)`
                        : `${a.participants.length} participante(s)`}
                    </div>
                  </div>
                </div>
                {a.folder && (
                  <Badge variant="outline" className="rounded-md text-[10px]">
                    <FolderOpen className="mr-1 h-3 w-3" /> {a.folder}
                  </Badge>
                )}
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
              <ParticipantesConfirmacao
                participantes={a.participantRows}
                onConfirmar={confirmarPresenca}
                confirmando={confirmar.isPending}
              />
              {a.participantRows.length === 0 && a.participants.length > 0 && (
                <p className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  Registro anterior à confirmação individual — participantes anotados como texto:{" "}
                  {a.participants.map((p) => p.nome).join(", ")}
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
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova Ata de Reunião</DialogTitle>
            <DialogDescription>
              Os participantes saem de Cargos e Perfis. Quem tem usuário vinculado recebe uma
              notificação para confirmar a própria presença.
            </DialogDescription>
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
            <CamposEvento
              time={form.meetingTime}
              speaker={form.speakerName}
              folder={form.folder}
              onChange={(campo, valor) =>
                setForm((f) => ({
                  ...f,
                  ...(campo === "time"
                    ? { meetingTime: valor }
                    : campo === "speaker"
                      ? { speakerName: valor }
                      : { folder: valor }),
                }))
              }
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Participantes</label>
              <ParticipantesPicker selectedIds={employeeIds} onChange={setEmployeeIds} />
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
            <Button
              onClick={salvar}
              disabled={createAta.isPending}
              className="bg-brand text-white hover:bg-brand/90"
            >
              {createAta.isPending ? "Registrando…" : "Registrar"}
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
  const confirmar = useConfirmAttendanceListPresence();

  const [open, setOpen] = useState(false);
  const vazio = { eventTitle: "", eventDate: "", eventTime: "", speakerName: "", folder: "" };
  const [form, setForm] = useState(vazio);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);

  const salvar = () => {
    if (!form.eventTitle.trim() || !form.eventDate) {
      toast.error("Informe o evento e a data");
      return;
    }
    createLista.mutate(
      {
        eventTitle: form.eventTitle,
        eventDate: form.eventDate,
        eventTime: form.eventTime || null,
        speakerName: form.speakerName.trim() || null,
        folder: form.folder.trim() || null,
        employeeIds,
      },
      {
        onSuccess: () => {
          toast.success("Lista de frequência registrada", {
            description:
              employeeIds.length > 0
                ? "Os participantes com conta foram notificados para confirmar presença."
                : undefined,
          });
          setForm(vazio);
          setEmployeeIds([]);
          setOpen(false);
        },
        onError: (e) => toast.error("Erro ao registrar lista", { description: getErrorMessage(e) }),
      },
    );
  };

  const confirmarPresenca = (participantId: string) =>
    confirmar.mutate(participantId, {
      onSuccess: () => toast.success("Presença confirmada"),
      onError: (e) =>
        toast.error("Não foi possível confirmar", { description: getErrorMessage(e) }),
    });

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
        {listas.map((l) => (
          <Card key={l.id} className="rounded-xl border-border/70 shadow-sm">
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{l.eventTitle}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(l.eventDate + "T00:00:00").toLocaleDateString("pt-BR")}
                      {l.eventTime ? ` às ${l.eventTime.slice(0, 5)}` : ""}
                      {l.speakerName ? ` · ${l.speakerName}` : ""}
                    </div>
                  </div>
                </div>
                {l.folder && (
                  <Badge variant="outline" className="rounded-md text-[10px]">
                    <FolderOpen className="mr-1 h-3 w-3" /> {l.folder}
                  </Badge>
                )}
              </div>
              <ParticipantesConfirmacao
                participantes={l.participantRows}
                onConfirmar={confirmarPresenca}
                confirmando={confirmar.isPending}
              />
              {l.participantRows.length === 0 && l.participants.length > 0 && (
                <p className="border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  Registro anterior à confirmação individual — participantes anotados como texto:{" "}
                  {l.participants.map((p) => p.nome).join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && listas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
            Nenhuma lista de frequência registrada.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova Lista de Frequência</DialogTitle>
            <DialogDescription>
              Os participantes saem de Cargos e Perfis. Quem tem usuário vinculado recebe uma
              notificação para confirmar a própria presença.
            </DialogDescription>
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
            <CamposEvento
              time={form.eventTime}
              speaker={form.speakerName}
              folder={form.folder}
              onChange={(campo, valor) =>
                setForm((f) => ({
                  ...f,
                  ...(campo === "time"
                    ? { eventTime: valor }
                    : campo === "speaker"
                      ? { speakerName: valor }
                      : { folder: valor }),
                }))
              }
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Participantes</label>
              <ParticipantesPicker selectedIds={employeeIds} onChange={setEmployeeIds} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={createLista.isPending}
              className="bg-brand text-white hover:bg-brand/90"
            >
              {createLista.isPending ? "Registrando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================================================
 * Reverter revogação (Bloco 3, item 3).
 *
 * A justificativa é obrigatória e fica registrada com autor e data — é a
 * etapa adicional que o item pedia. A validação existe aqui e também na
 * RPC: a do banco é a que vale, esta só evita a ida à rede.
 * ============================================================ */
function ReverterRevogacaoDialog({
  document: doc,
  onClose,
}: {
  document: DocumentItem | null;
  onClose: () => void;
}) {
  const reverter = useReverseDocumentRevocation();
  const { data: historico = [] } = useDocumentRevocationReversals(doc?.id ?? null);
  const [justificativa, setJustificativa] = useState("");

  useEffect(() => {
    setJustificativa("");
  }, [doc?.id]);

  if (!doc) return null;

  const confirmar = () => {
    if (!justificativa.trim()) {
      toast.error("A justificativa é obrigatória para reverter a revogação");
      return;
    }
    reverter.mutate(
      { documentId: doc.id, justification: justificativa.trim() },
      {
        onSuccess: () => {
          toast.success("Revogação revertida", {
            description: `${doc.code} voltou a vigente.`,
          });
          onClose();
        },
        onError: (e) =>
          toast.error("Não foi possível reverter", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <Dialog open={!!doc} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Reverter revogação — {doc.code}</DialogTitle>
          <DialogDescription>
            O documento volta a vigente. A justificativa fica registrada com seu nome e a data, e
            não pode ser editada depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Justificativa *</label>
          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Por que este documento volta a valer?"
            className="min-h-[90px] rounded-md text-sm"
            autoFocus
          />
        </div>
        {historico.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Reversões anteriores
            </div>
            <ol className="max-h-32 space-y-1.5 overflow-y-auto">
              {historico.map((h) => (
                <li
                  key={h.id}
                  className="rounded-lg border border-border/60 p-2 text-[11px] text-muted-foreground"
                >
                  <div className="text-foreground">{h.justification}</div>
                  <div className="mt-0.5">
                    {h.reversedByName ?? "Autor não identificado"} ·{" "}
                    {new Date(h.reversedAt).toLocaleDateString("pt-BR")}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={reverter.isPending}
            className="bg-brand text-white hover:bg-brand/90"
          >
            {reverter.isPending ? "Revertendo…" : "Reverter revogação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
