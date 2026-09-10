import { useEffect, useState } from "react";
import { FilePlus2, History, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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
import { LockedDocumentBanner, VersionHistoryCard } from "@/components/estrategia/formal-document";
import {
  useCompanyPresentationCurrent,
  useCompanyPresentationHistory,
  useStartFirstCompanyPresentationDraft,
  useStartNewCompanyPresentationVersion,
  useFormalizeCompanyPresentation,
  useUpdateCompanyPresentationContent,
} from "@/lib/queries/identidade";
import { getErrorMessage } from "@/lib/utils";

/* ============================================================
 * Apresentação da Empresa (Bloco 2, item 10a).
 *
 * Mesmo ciclo de vida da Política da Qualidade: um rascunho por vez, editar
 * livre enquanto rascunho, formalizar congela, nova versão reabre. A única
 * diferença de regra está no banco — aqui quem elabora também formaliza,
 * enquanto a Política exige Administrador.
 * ============================================================ */

export function ApresentacaoEmpresaTab({ isQualityAuthorized }: { isQualityAuthorized: boolean }) {
  const { data, isLoading } = useCompanyPresentationCurrent();
  const { data: history } = useCompanyPresentationHistory();
  const startFirstDraft = useStartFirstCompanyPresentationDraft();
  const startNewVersion = useStartNewCompanyPresentationVersion();
  const formalize = useFormalizeCompanyPresentation();
  const updateContent = useUpdateCompanyPresentationContent();

  const [content, setContent] = useState("");
  const [formalizeOpen, setFormalizeOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");

  const presentation = data?.presentation ?? null;
  const isDraft = data?.isDraft ?? false;

  useEffect(() => {
    if (presentation) setContent(presentation.content);
  }, [presentation?.id]);

  const salvar = () => {
    if (!presentation) return;
    updateContent.mutate(
      { id: presentation.id, content },
      { onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }) },
    );
  };

  const confirmarFormalizacao = () => {
    if (!presentation || !versionLabel.trim()) {
      toast.error("Informe o rótulo da versão");
      return;
    }
    formalize.mutate(
      { id: presentation.id, versionLabel: versionLabel.trim() },
      {
        onSuccess: () => {
          toast.success("Apresentação formalizada", { description: versionLabel.trim() });
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

  if (!presentation) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <FilePlus2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Nenhuma Apresentação da Empresa ainda
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escreva quem é a organização, o que ela faz e para quem — é o texto que abre a
            identidade organizacional.
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
              Formalizar Apresentação
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
          Esta é a última versão formalizada ({presentation.versionLabel}) — somente leitura. Clique
          em "Nova versão" para editar.
        </LockedDocumentBanner>
      )}

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="p-6">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Texto da Apresentação
          </label>
          <Textarea
            value={content}
            disabled={!isDraft || !isQualityAuthorized}
            onChange={(e) => setContent(e.target.value)}
            onBlur={salvar}
            placeholder="Histórico da organização, área de atuação, porte, mercados atendidos…"
            className="mt-1.5 min-h-[200px] rounded-lg text-sm"
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
            <DialogTitle>Formalizar Apresentação da Empresa</DialogTitle>
            <DialogDescription>
              O texto fica somente leitura depois disso. Para alterar, crie uma nova versão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Rótulo da versão</label>
            <Input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="Ex.: Apresentação_01.2026"
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
