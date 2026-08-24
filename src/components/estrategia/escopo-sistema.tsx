import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Pencil,
  Plus,
  History,
  Wrench,
  X,
  Check,
  Send,
  FilePlus2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useScopeCurrent,
  useScopeHistory,
  useStartFirstScopeDraft,
  useStartNewScopeRevision,
  useUpdateScopeText,
  useSubmitScopeForApproval,
  useApproveScopeDocument,
  useCreateScopeNotApplicableItem,
  useUpdateScopeItemJustification,
} from "@/lib/queries/estrategia";
import { LockedDocumentBanner, VersionHistoryCard } from "@/components/estrategia/formal-document";

const normas = [
  { codigo: "ISO 9001:2015", titulo: "Sistemas de Gestão da Qualidade" },
  { codigo: "ISO 14001:2015", titulo: "Sistemas de Gestão Ambiental" },
  { codigo: "ISO 45001:2018", titulo: "Sistemas de Gestão de SST" },
];

const statusLabel: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  vigente: "Vigente",
};

export function EscopoSistemaPage() {
  const { data, isLoading } = useScopeCurrent();
  const { data: history } = useScopeHistory();
  const startFirstDraft = useStartFirstScopeDraft();
  const startNewRevision = useStartNewScopeRevision();
  const updateText = useUpdateScopeText();
  const submitForApproval = useSubmitScopeForApproval();
  const approve = useApproveScopeDocument();
  const createItem = useCreateScopeNotApplicableItem();
  const updateJustification = useUpdateScopeItemJustification();

  const [editOpen, setEditOpen] = useState(false);
  const [novoTexto, setNovoTexto] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);
  const [nova, setNova] = useState({ requisito: "", descricao: "", justificativa: "" });
  const [tratando, setTratando] = useState<string | null>(null);
  const [justif, setJustif] = useState("");
  const [firstText, setFirstText] = useState("");

  const document = data?.document ?? null;
  const items = data?.items ?? [];
  const isDraft = document?.status === "rascunho";
  const semJust = items.filter((i) => !i.justification.trim());

  useEffect(() => {
    if (document) setNovoTexto(document.declaracaoTexto);
  }, [document?.id]);

  const salvarEscopo = () => {
    if (!document || !novoTexto.trim()) return;
    updateText.mutate(
      { id: document.id, declaracaoTexto: novoTexto },
      {
        onSuccess: () => {
          toast.success("Declaração atualizada");
          setEditOpen(false);
        },
        onError: (e) => toast.error("Erro ao salvar", { description: String(e) }),
      },
    );
  };

  const salvarItem = () => {
    if (!nova.requisito.trim() || !nova.descricao.trim() || !document) {
      toast.error("Item da norma e descrição obrigatórios");
      return;
    }
    const requirementDescription = `${nova.requisito.trim()} — ${nova.descricao.trim()}`;
    createItem.mutate(
      { scopeDocumentId: document.id, requirementDescription, justification: nova.justificativa },
      {
        onSuccess: () => {
          if (!nova.justificativa.trim())
            toast.warning("Item não aplicável sem justificativa — trate para evitar NC");
          else toast.success("Item não aplicável registrado");
          setNova({ requisito: "", descricao: "", justificativa: "" });
          setNovaOpen(false);
        },
        onError: (e) => toast.error("Erro ao registrar", { description: String(e) }),
      },
    );
  };

  const salvarJustif = () => {
    if (!tratando || !justif.trim()) return;
    updateJustification.mutate(
      { id: tratando, justification: justif },
      {
        onSuccess: () => {
          toast.success("Justificativa registrada");
          setTratando(null);
          setJustif("");
        },
        onError: (e) => toast.error("Erro ao salvar", { description: String(e) }),
      },
    );
  };

  const enviarParaAprovacao = () => {
    if (!document) return;
    submitForApproval.mutate(
      { id: document.id },
      {
        onSuccess: () => toast.success("Enviado para aprovação da Alta Direção"),
        onError: (e) => toast.error("Não foi possível enviar", { description: String(e) }),
      },
    );
  };

  const aprovar = () => {
    if (!document) return;
    approve.mutate(
      { id: document.id },
      {
        onSuccess: () => toast.success("Escopo aprovado — agora é a versão vigente"),
        onError: (e) => toast.error("Não foi possível aprovar", { description: String(e) }),
      },
    );
  };

  const iniciarNovaRevisao = () => {
    startNewRevision.mutate(undefined, {
      onSuccess: () => toast.success("Nova revisão criada a partir da última vigente"),
      onError: (e) =>
        toast.error("Não foi possível iniciar nova revisão", { description: String(e) }),
    });
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Carregando…
        </div>
      </AppShell>
    );
  }

  if (!document) {
    return (
      <AppShell>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <FilePlus2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Nenhum Escopo do Sistema ainda
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Redija a primeira declaração de escopo (requisito 4.3 da ISO 9001).
            </p>
          </div>
          <Textarea
            value={firstText}
            onChange={(e) => setFirstText(e.target.value)}
            className="min-h-[140px] w-full rounded-lg text-sm"
            placeholder="Descreva o escopo do sistema de gestão…"
          />
          <Button
            disabled={!firstText.trim()}
            onClick={() => startFirstDraft.mutate({ declaracaoTexto: firstText })}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Criar rascunho
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Escopo do Sistema de Gestão
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Requisito 4.3 da ISO 9001:2015 — cada revisão aprovada passa a ser a vigente.
            </p>
          </div>
          <div className="flex gap-2">
            {isDraft && (
              <>
                <Button
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  variant="outline"
                  className="rounded-lg"
                >
                  <Pencil className="mr-1.5 h-4 w-4" /> Editar declaração
                </Button>
                <Button
                  size="sm"
                  onClick={enviarParaAprovacao}
                  className="rounded-lg bg-brand text-white hover:bg-brand/90"
                >
                  <Send className="mr-1.5 h-4 w-4" /> Enviar para aprovação
                </Button>
              </>
            )}
            {document.status === "aguardando_aprovacao" && (
              <Button
                size="sm"
                onClick={aprovar}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                <Check className="mr-1.5 h-4 w-4" /> Aprovar (Alta Direção)
              </Button>
            )}
            {document.status === "vigente" && (
              <Button
                size="sm"
                onClick={iniciarNovaRevisao}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                <History className="mr-1.5 h-4 w-4" /> Nova revisão
              </Button>
            )}
          </div>
        </header>

        {document.status !== "rascunho" && (
          <LockedDocumentBanner>
            {document.status === "aguardando_aprovacao"
              ? "Revisão aguardando aprovação da Alta Direção — somente leitura até a decisão."
              : 'Esta é a versão vigente — somente leitura. Clique em "Nova revisão" para editar.'}
          </LockedDocumentBanner>
        )}

        {isDraft && semJust.length > 0 && (
          <Alert
            variant="destructive"
            className="rounded-xl border-[color:var(--severity-critical)]/40 bg-[color:var(--severity-critical)]/10"
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              Item Não Aplicável sem justificativa registrada — bloqueia o envio para aprovação
            </AlertTitle>
            <AlertDescription className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {semJust.map((i) => (
                <Badge
                  key={i.id}
                  variant="outline"
                  className="rounded-md border-[color:var(--severity-critical)]/40 bg-background text-[color:var(--severity-critical)]"
                >
                  {i.requirementDescription.slice(0, 40)}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTratando(i.id);
                      setJustif("");
                    }}
                    className="ml-1 h-5 rounded px-1 text-[10px] text-[color:var(--severity-critical)] hover:bg-[color:var(--severity-critical)]/20"
                  >
                    <Wrench className="mr-1 h-3 w-3" /> Tratar agora
                  </Button>
                </Badge>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardContent className="space-y-4 p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                    Declaração de escopo
                  </div>
                  <div className="text-lg font-semibold text-foreground">
                    {statusLabel[document.status]}
                  </div>
                </div>
                <Badge variant="outline" className="ml-auto rounded-md text-[10px]">
                  Rev. {document.revisionNumber}
                  {document.approvedAt &&
                    ` · ${new Date(document.approvedAt).toLocaleDateString("pt-BR")}`}
                </Badge>
              </div>

              <Separator />

              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                {document.declaracaoTexto}
              </p>

              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-brand" /> Normas aplicáveis
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {normas.map((n) => (
                    <div key={n.codigo} className="rounded-lg border border-border/60 bg-card p-3">
                      <div className="font-mono text-[11px] font-semibold text-brand">
                        {n.codigo}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{n.titulo}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <VersionHistoryCard
            title="Histórico de revisões vigentes"
            emptyMessage="Nenhuma revisão vigente ainda."
            entries={(history ?? []).map((r) => ({
              id: r.id,
              label: `Rev. ${r.revisionNumber}`,
              date: r.approvedAt,
              byName: r.approvedByName,
              snippet: r.declaracaoTexto,
            }))}
          />
        </div>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Itens Não Aplicáveis</h2>
                <p className="text-[11px] text-muted-foreground">
                  Requisitos não aplicáveis ao escopo definido acima.
                </p>
              </div>
              {isDraft && (
                <Button
                  size="sm"
                  onClick={() => setNovaOpen(true)}
                  variant="outline"
                  className="rounded-lg"
                >
                  <Plus className="mr-1 h-3 w-3" /> Novo Item Não Aplicável
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <TableHead>Requisito</TableHead>
                  <TableHead>Justificativa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id} className="align-top text-xs">
                    <TableCell className="text-foreground/85">{i.requirementDescription}</TableCell>
                    <TableCell className="text-foreground/70">
                      {i.justification ||
                        (isDraft ? (
                          <button
                            onClick={() => {
                              setTratando(i.id);
                              setJustif("");
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-[color:var(--severity-critical)]/10 px-2 py-0.5 text-[11px] text-[color:var(--severity-critical)] hover:bg-[color:var(--severity-critical)]/20"
                          >
                            <AlertTriangle className="h-3 w-3" /> Preencher justificativa
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        ))}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="py-8 text-center text-xs text-muted-foreground"
                    >
                      Nenhum Item Não Aplicável registrado nesta revisão.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Editar declaração */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar declaração de escopo</DialogTitle>
            <DialogDescription>
              Válido apenas enquanto a revisão está em rascunho.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            className="min-h-[220px] rounded-lg text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              <X className="mr-1 h-3 w-3" /> Cancelar
            </Button>
            <Button onClick={salvarEscopo} className="bg-brand text-white hover:bg-brand/90">
              <Check className="mr-1 h-3 w-3" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo Item Não Aplicável */}
      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Novo Item Não Aplicável</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Item da norma</label>
              <Input
                placeholder="Ex.: ISO 9001 · 8.3"
                value={nova.requisito}
                onChange={(e) => setNova({ ...nova, requisito: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Descrição do requisito</label>
              <Textarea
                value={nova.descricao}
                onChange={(e) => setNova({ ...nova, descricao: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Justificativa</label>
              <Textarea
                placeholder="Deixe em branco para gerar alerta"
                value={nova.justificativa}
                onChange={(e) => setNova({ ...nova, justificativa: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarItem} className="bg-brand text-white hover:bg-brand/90">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tratar justificativa */}
      <Dialog
        open={tratando !== null}
        onOpenChange={(o) => {
          if (!o) setTratando(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Registrar justificativa</DialogTitle>
            <DialogDescription>
              {items.find((i) => i.id === tratando)?.requirementDescription}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={justif}
            onChange={(e) => setJustif(e.target.value)}
            className="min-h-[120px] rounded-lg text-sm"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTratando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarJustif} className="bg-brand text-white hover:bg-brand/90">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
