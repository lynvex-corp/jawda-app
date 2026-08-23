import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Lock, History, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import {
  useStakeholderCurrent,
  useStakeholderHistory,
  useStartFirstStakeholderDraft,
  useStartNewStakeholderVersion,
  useFormalizeStakeholderAnalysis,
  useCreateStakeholder,
  useUpdateStakeholder,
} from "@/lib/queries/estrategia";

export function PartesInteressadasPage() {
  const { data, isLoading } = useStakeholderCurrent();
  const { data: history } = useStakeholderHistory();
  const startFirstDraft = useStartFirstStakeholderDraft();
  const startNewVersion = useStartNewStakeholderVersion();
  const formalize = useFormalizeStakeholderAnalysis();
  const createStakeholder = useCreateStakeholder();
  const updateStakeholder = useUpdateStakeholder();

  const [busca, setBusca] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);
  const [nova, setNova] = useState({ nome: "", requisitos: "", expectativas: "" });
  const [formalizeOpen, setFormalizeOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");

  const analysis = data?.analysis ?? null;
  const stakeholders = data?.stakeholders ?? [];
  const isDraft = data?.isDraft ?? false;

  const rows = stakeholders.filter((p) =>
    (p.nome + p.requisitos + p.expectativas).toLowerCase().includes(busca.toLowerCase()),
  );

  const salvarNova = () => {
    if (!nova.nome.trim() || !analysis) {
      toast.error("Informe o nome");
      return;
    }
    createStakeholder.mutate(
      { analysisId: analysis.id, ...nova },
      {
        onSuccess: () => {
          toast.success("Parte interessada adicionada");
          setNova({ nome: "", requisitos: "", expectativas: "" });
          setNovaOpen(false);
        },
        onError: (e) => toast.error("Erro ao adicionar", { description: String(e) }),
      },
    );
  };

  const confirmarFormalizacao = () => {
    if (!analysis || !versionLabel.trim()) {
      toast.error("Informe o rótulo da versão");
      return;
    }
    formalize.mutate(
      { analysisId: analysis.id, versionLabel: versionLabel.trim() },
      {
        onSuccess: () => {
          toast.success("Análise formalizada", { description: versionLabel.trim() });
          setFormalizeOpen(false);
          setVersionLabel("");
        },
        onError: (e) => toast.error("Não foi possível formalizar", { description: String(e) }),
      },
    );
  };

  const iniciarNovaVersao = () => {
    startNewVersion.mutate(undefined, {
      onSuccess: () => toast.success("Nova versão criada a partir da última formalizada"),
      onError: (e) =>
        toast.error("Não foi possível iniciar nova versão", { description: String(e) }),
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

  if (!analysis) {
    return (
      <AppShell>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <FilePlus2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Nenhum mapeamento de Partes Interessadas ainda
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Inicie o primeiro rascunho para começar o cadastro (requisito 4.2 da ISO 9001).
            </p>
          </div>
          <Button
            onClick={() => startFirstDraft.mutate()}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Iniciar cadastro
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Partes Interessadas
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Requisito 4.2 da ISO 9001.</p>
          </div>
          <div className="flex gap-2">
            {isDraft ? (
              <>
                <Button
                  size="sm"
                  onClick={() => setNovaOpen(true)}
                  variant="outline"
                  className="rounded-lg"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Nova parte
                </Button>
                <Button
                  size="sm"
                  onClick={() => setFormalizeOpen(true)}
                  className="rounded-lg bg-brand text-white hover:bg-brand/90"
                >
                  Formalizar análise
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={iniciarNovaVersao}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                <History className="mr-1.5 h-4 w-4" /> Nova versão
              </Button>
            )}
          </div>
        </header>

        {!isDraft && (
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Esta é a última versão formalizada ({analysis.versionLabel}) — somente leitura. Clique
            em "Nova versão" para editar.
          </div>
        )}

        <Card className="rounded-2xl border-dashed border-border/80 shadow-sm">
          <CardContent className="flex items-center gap-3 p-5 text-muted-foreground">
            <Lock className="h-5 w-5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-foreground">
                Mapa de Influência × Interesse
              </div>
              <p className="text-xs">
                Disponível na versão 2.0. Nesta versão, o cadastro cobre nome, requisitos e
                expectativas.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                Cadastro completo — edição inline
              </h2>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar…"
                className="h-8 max-w-xs rounded-lg text-xs"
              />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-[220px]">Nome</TableHead>
                    <TableHead>Requisitos</TableHead>
                    <TableHead>Expectativas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p, idx) => (
                    <TableRow key={p.id} className="align-top text-xs">
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={p.nome}
                          disabled={!isDraft}
                          onChange={(e) =>
                            updateStakeholder.mutate({ id: p.id, patch: { nome: e.target.value } })
                          }
                          className="h-8 rounded-md text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={p.requisitos}
                          disabled={!isDraft}
                          onChange={(e) =>
                            updateStakeholder.mutate({
                              id: p.id,
                              patch: { requisitos: e.target.value },
                            })
                          }
                          className="min-h-[52px] rounded-md text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={p.expectativas}
                          disabled={!isDraft}
                          onChange={(e) =>
                            updateStakeholder.mutate({
                              id: p.id,
                              patch: { expectativas: e.target.value },
                            })
                          }
                          className="min-h-[52px] rounded-md text-xs"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        Nenhuma parte interessada cadastrada nesta versão.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {history && history.length > 0 && (
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <History className="h-4 w-4 text-brand" /> Versões formalizadas
              </div>
              <div className="space-y-1">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">{h.versionLabel}</span>
                    <span>
                      {h.formalizedAt ? new Date(h.formalizedAt).toLocaleDateString("pt-BR") : ""}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal Nova */}
      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova parte interessada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Nome</label>
              <Input
                value={nova.nome}
                onChange={(e) => setNova({ ...nova, nome: e.target.value })}
                className="mt-1 rounded-md"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Requisitos</label>
              <Textarea
                value={nova.requisitos}
                onChange={(e) => setNova({ ...nova, requisitos: e.target.value })}
                className="mt-1 rounded-md"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Expectativas</label>
              <Textarea
                value={nova.expectativas}
                onChange={(e) => setNova({ ...nova, expectativas: e.target.value })}
                className="mt-1 rounded-md"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarNova} className="bg-brand text-white hover:bg-brand/90">
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Formalizar */}
      <Dialog open={formalizeOpen} onOpenChange={setFormalizeOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Formalizar Partes Interessadas</DialogTitle>
            <DialogDescription>
              A análise vira somente leitura. Para editar de novo, crie uma nova versão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Rótulo da versão</label>
            <Input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="Ex.: Partes Interessadas_01.2026"
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
    </AppShell>
  );
}
