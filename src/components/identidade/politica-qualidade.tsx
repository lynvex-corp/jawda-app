import { useEffect, useState } from "react";
import { FilePlus2, History, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LockedDocumentBanner, VersionHistoryCard } from "@/components/estrategia/formal-document";
import {
  useQualityPolicyCurrent,
  useQualityPolicyHistory,
  useStartFirstQualityPolicyDraft,
  useStartNewQualityPolicyVersion,
  useFormalizeQualityPolicy,
  useUpdateQualityPolicyContent,
  useDiscardQualityPolicyDraft,
} from "@/lib/queries/documentos";
import { getErrorMessage } from "@/lib/utils";

/* ============================================================
 * Política da Qualidade.
 *
 * Vivia como função interna de components/documentos/page.tsx. Foi extraída
 * no Bloco 2 (item 10b) ao migrar para a seção Identidade Organizacional —
 * o conteúdo é o mesmo, só deixou de ser aba de Documentos.
 *
 * As queries continuam em lib/queries/documentos.ts de propósito: a tabela
 * quality_policy não mudou de lugar, e mover as queries junto criaria um
 * diff grande sem ganho e quebraria quem já as importa.
 *
 * Bloco 7: rótulo de versão não é mais digitado — o banco gera sozinho
 * ("Política da Qualidade_01.2026", incrementando por ano). Formalizar
 * continua exclusivo da Diretoria (já era antes). "Cancelar alteração"
 * descarta o rascunho aberto sem formalizar nada.
 * ============================================================ */

export function PoliticaQualidadeTab({ isDiretoria }: { isDiretoria: boolean }) {
  const { data, isLoading } = useQualityPolicyCurrent();
  const { data: history } = useQualityPolicyHistory();
  const startFirstDraft = useStartFirstQualityPolicyDraft();
  const startNewVersion = useStartNewQualityPolicyVersion();
  const formalize = useFormalizeQualityPolicy();
  const updateContent = useUpdateQualityPolicyContent();
  const discardDraft = useDiscardQualityPolicyDraft();

  const [content, setContent] = useState("");
  const [formalizeOpen, setFormalizeOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

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
    if (!policy) return;
    formalize.mutate(
      { id: policy.id },
      {
        onSuccess: (result) => {
          toast.success("Política da Qualidade formalizada", {
            description: result.version_label ?? undefined,
          });
          setFormalizeOpen(false);
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

  const confirmarDescarte = () => {
    if (!policy) return;
    discardDraft.mutate(policy.id, {
      onSuccess: () => {
        toast.success("Rascunho descartado");
        setDiscardOpen(false);
      },
      onError: (e) =>
        toast.error("Não foi possível descartar", { description: getErrorMessage(e) }),
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
        {isDiretoria && (
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
        {isDiretoria &&
          (isDraft ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDiscardOpen(true)}
                className="rounded-lg"
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Cancelar alteração
              </Button>
              <Button
                size="sm"
                onClick={() => setFormalizeOpen(true)}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                Formalizar Política da Qualidade
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
            disabled={!isDraft || !isDiretoria}
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
              leitura depois disso. O rótulo da versão é gerado automaticamente (ex.: "Política da
              Qualidade_01.2026").
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormalizeOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarFormalizacao}
              disabled={formalize.isPending || content.trim() === ""}
              className="bg-brand text-white hover:bg-brand/90"
            >
              Formalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar alteração</AlertDialogTitle>
            <AlertDialogDescription>
              O rascunho atual é descartado (fica registrado, mas não vira versão oficial) e a tela
              volta a mostrar a última versão formalizada. O texto não salvo desta edição se perde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmarDescarte}
            >
              Descartar rascunho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
