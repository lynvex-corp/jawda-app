import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, History, FilePlus2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  useStrategicDirectivesCurrent,
  useStrategicDirectivesHistory,
  useStartFirstStrategicDirectivesDraft,
  useStartNewStrategicDirectivesVersion,
  useFormalizeStrategicDirectives,
  useUpdateStrategicDirectivesText,
  useCreateStrategicValue,
  useUpdateStrategicValue,
} from "@/lib/queries/estrategia";
import { LockedDocumentBanner, VersionHistoryCard } from "@/components/estrategia/formal-document";
import { getErrorMessage } from "@/lib/utils";

export function DiretrizesEstrategicasPage() {
  const { data, isLoading } = useStrategicDirectivesCurrent();
  const { data: history } = useStrategicDirectivesHistory();
  const startFirstDraft = useStartFirstStrategicDirectivesDraft();
  const startNewVersion = useStartNewStrategicDirectivesVersion();
  const formalize = useFormalizeStrategicDirectives();
  const updateText = useUpdateStrategicDirectivesText();
  const createValue = useCreateStrategicValue();
  const updateValue = useUpdateStrategicValue();

  const [missao, setMissao] = useState("");
  const [visao, setVisao] = useState("");
  const [proposito, setProposito] = useState("");
  const [novoValor, setNovoValor] = useState({ nome: "", descricao: "" });
  const [formalizeOpen, setFormalizeOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");

  const directive = data?.directive ?? null;
  const values = data?.values ?? [];
  const isDraft = data?.isDraft ?? false;

  useEffect(() => {
    if (directive) {
      setMissao(directive.missao);
      setVisao(directive.visao);
      setProposito(directive.proposito);
    }
  }, [directive?.id]);

  const salvarTextos = () => {
    if (!directive) return;
    updateText.mutate(
      { id: directive.id, missao, visao, proposito },
      { onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }) },
    );
  };

  const adicionarValor = () => {
    if (!novoValor.nome.trim() || !directive) {
      toast.error("Informe o nome do valor");
      return;
    }
    createValue.mutate(
      {
        directiveId: directive.id,
        nome: novoValor.nome,
        descricao: novoValor.descricao,
        itemOrder: values.length,
      },
      {
        onSuccess: () => {
          toast.success("Valor adicionado");
          setNovoValor({ nome: "", descricao: "" });
        },
        onError: (e) => toast.error("Erro ao adicionar", { description: getErrorMessage(e) }),
      },
    );
  };

  const confirmarFormalizacao = () => {
    if (!directive || !versionLabel.trim()) {
      toast.error("Informe o rótulo da versão");
      return;
    }
    formalize.mutate(
      { id: directive.id, versionLabel: versionLabel.trim() },
      {
        onSuccess: () => {
          toast.success("Diretrizes estratégicas formalizadas", {
            description: versionLabel.trim(),
          });
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
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Carregando…
        </div>
      </AppShell>
    );
  }

  if (!directive) {
    return (
      <AppShell>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <FilePlus2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Nenhuma diretriz estratégica ainda
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Inicie o primeiro rascunho de Missão, Visão, Valores e Propósito.
            </p>
          </div>
          <Button
            onClick={() => startFirstDraft.mutate()}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Iniciar rascunho
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Missão, Visão, Valores e Propósito
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Diretrizes estratégicas da organização — base do contexto para a Alta Direção e para o
              sistema de gestão.
            </p>
          </div>
          <div className="flex gap-2">
            {isDraft ? (
              <Button
                size="sm"
                onClick={() => setFormalizeOpen(true)}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                Formalizar Diretrizes Estratégicas
              </Button>
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
          <LockedDocumentBanner>
            Esta é a última versão formalizada ({directive.versionLabel}) — somente leitura. Clique
            em "Nova versão" para editar.
          </LockedDocumentBanner>
        )}

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Missão
              </label>
              <Textarea
                value={missao}
                disabled={!isDraft}
                onChange={(e) => setMissao(e.target.value)}
                onBlur={salvarTextos}
                className="min-h-[80px] rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Visão
              </label>
              <Textarea
                value={visao}
                disabled={!isDraft}
                onChange={(e) => setVisao(e.target.value)}
                onBlur={salvarTextos}
                className="min-h-[80px] rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Propósito
              </label>
              <Textarea
                value={proposito}
                disabled={!isDraft}
                onChange={(e) => setProposito(e.target.value)}
                onBlur={salvarTextos}
                className="min-h-[80px] rounded-lg text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-sm font-semibold text-foreground">Valores</h2>
            <div className="space-y-2">
              {values.map((v) => (
                <div
                  key={v.id}
                  className="grid gap-2 rounded-lg border border-border/60 p-3 md:grid-cols-[200px_1fr]"
                >
                  <Input
                    defaultValue={v.nome}
                    disabled={!isDraft}
                    onBlur={(e) =>
                      updateValue.mutate({ id: v.id, patch: { nome: e.target.value } })
                    }
                    className="h-9 rounded-md text-sm font-medium"
                  />
                  <Textarea
                    defaultValue={v.descricao}
                    disabled={!isDraft}
                    onBlur={(e) =>
                      updateValue.mutate({ id: v.id, patch: { descricao: e.target.value } })
                    }
                    className="min-h-[52px] rounded-md text-xs"
                  />
                </div>
              ))}
              {values.length === 0 && (
                <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                  Nenhum valor cadastrado nesta versão.
                </p>
              )}
            </div>
            {isDraft && (
              <div className="flex flex-wrap gap-2 rounded-lg border border-dashed border-border/60 p-3">
                <Input
                  value={novoValor.nome}
                  onChange={(e) => setNovoValor({ ...novoValor, nome: e.target.value })}
                  placeholder="Nome do valor"
                  className="h-9 max-w-[200px] rounded-md text-sm"
                />
                <Input
                  value={novoValor.descricao}
                  onChange={(e) => setNovoValor({ ...novoValor, descricao: e.target.value })}
                  placeholder="Descrição curta"
                  className="h-9 flex-1 rounded-md text-sm"
                />
                <Button
                  size="sm"
                  onClick={adicionarValor}
                  className="rounded-md bg-brand text-white hover:bg-brand/90"
                >
                  <Plus className="mr-1 h-3 w-3" /> Adicionar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {history && history.length > 0 && (
          <VersionHistoryCard
            entries={history.map((h) => ({
              id: h.id,
              label: h.versionLabel ?? "",
              date: h.formalizedAt,
              byName: h.formalizedByName,
            }))}
          />
        )}

        <div className="flex items-start gap-2 rounded-xl border border-brand/20 bg-brand-soft/40 p-4 text-[11px] text-foreground/80">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          Estas diretrizes orientam o tom das sugestões geradas pela inteligência artificial em todo
          o sistema.
        </div>
      </div>

      <Dialog open={formalizeOpen} onOpenChange={setFormalizeOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Formalizar Diretrizes Estratégicas</DialogTitle>
            <DialogDescription>
              Só a Alta Direção pode formalizar. Os campos ficam somente leitura depois disso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Rótulo da versão</label>
            <Input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="Ex.: Missão, Visão, Valores e Propósito_01.2026"
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
