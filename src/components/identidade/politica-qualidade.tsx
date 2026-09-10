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
  useQualityPolicyCurrent,
  useQualityPolicyHistory,
  useStartFirstQualityPolicyDraft,
  useStartNewQualityPolicyVersion,
  useFormalizeQualityPolicy,
  useUpdateQualityPolicyContent,
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
 * ============================================================ */

export function PoliticaQualidadeTab({ isQualityAuthorized }: { isQualityAuthorized: boolean }) {
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
