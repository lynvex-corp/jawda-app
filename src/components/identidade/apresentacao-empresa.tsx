import { useEffect, useState } from "react";
import { FilePlus2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useCompanyPresentationCurrent,
  useStartFirstCompanyPresentationDraft,
  useFormalizeCompanyPresentation,
  useUpdateCompanyPresentationContent,
} from "@/lib/queries/identidade";
import { getErrorMessage } from "@/lib/utils";

/* ============================================================
 * Apresentação da Empresa (Bloco 2, item 10a; simplificada no Bloco 7,
 * item 1).
 *
 * Sem rótulo de versão e sem histórico — não é exigido pela norma, é só
 * identidade institucional. Fluxo: escreve, clica Formalizar (ação direta,
 * sem dialog), e a partir daí o texto some da edição só até clicar
 * "Editar" de novo — nunca cria uma versão nova.
 * ============================================================ */

export function ApresentacaoEmpresaTab({ isDiretoria }: { isDiretoria: boolean }) {
  const { data, isLoading } = useCompanyPresentationCurrent();
  const startFirstDraft = useStartFirstCompanyPresentationDraft();
  const formalize = useFormalizeCompanyPresentation();
  const updateContent = useUpdateCompanyPresentationContent();

  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);

  const presentation = data?.presentation ?? null;
  const isFormalized = presentation?.status === "formalizada";

  useEffect(() => {
    if (presentation) setContent(presentation.content);
    setEditing(false);
  }, [presentation?.id]);

  const salvar = () => {
    if (!presentation) return;
    updateContent.mutate(
      { id: presentation.id, content },
      { onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }) },
    );
  };

  const formalizar = () => {
    if (!presentation) return;
    formalize.mutate(
      { id: presentation.id },
      {
        onSuccess: () => toast.success("Apresentação formalizada"),
        onError: (e) =>
          toast.error("Não foi possível formalizar", { description: getErrorMessage(e) }),
      },
    );
  };

  const concluirEdicao = () => {
    salvar();
    setEditing(false);
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
        {isDiretoria && (
          <Button
            onClick={() => startFirstDraft.mutate()}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Iniciar
          </Button>
        )}
      </div>
    );
  }

  const podeEditarTexto = isDiretoria && (!isFormalized || editing);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {isFormalized &&
            (presentation.formalizedByName
              ? `Formalizada em ${new Date(presentation.formalizedAt!).toLocaleDateString("pt-BR")} por ${presentation.formalizedByName}`
              : "Formalizada")}
        </div>
        {isDiretoria && (
          <div className="flex gap-2">
            {!isFormalized && (
              <Button
                size="sm"
                onClick={formalizar}
                disabled={formalize.isPending || content.trim() === ""}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                Formalizar
              </Button>
            )}
            {isFormalized && !editing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                className="rounded-lg"
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
              </Button>
            )}
            {isFormalized && editing && (
              <Button
                size="sm"
                onClick={concluirEdicao}
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                Concluir edição
              </Button>
            )}
          </div>
        )}
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="p-6">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Texto da Apresentação
          </label>
          <Textarea
            value={content}
            disabled={!podeEditarTexto}
            onChange={(e) => setContent(e.target.value)}
            onBlur={salvar}
            placeholder="Histórico da organização, área de atuação, porte, mercados atendidos…"
            className="mt-1.5 min-h-[200px] rounded-lg text-sm"
          />
        </CardContent>
      </Card>
    </div>
  );
}
