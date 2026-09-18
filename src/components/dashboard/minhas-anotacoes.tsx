import { StickyNote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useMyNote, useAutosaveNote } from "@/lib/queries/user-notes";

/** Card de anotações livres (item 3, Bloco 6) — rascunho pessoal, não
 * compartilhado, persistido por usuário (autosave, mesmo padrão de debounce
 * usado noutros campos de texto livre do sistema). */
export function MinhasAnotacoesCard() {
  const { data: nota } = useMyNote();
  const { content, status, mudar } = useAutosaveNote(nota);

  return (
    <Card className="rounded-xl border-border/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-[color:var(--warning)]" />
          <CardTitle className="text-base font-semibold">Minhas anotações</CardTitle>
        </div>
        {status !== "ocioso" && (
          <span className="text-[11px] text-muted-foreground">
            {status === "salvando" ? "Salvando…" : "Salvo"}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <Textarea
          value={content}
          onChange={(e) => mudar(e.target.value)}
          placeholder="Anotações rápidas, só suas — ninguém mais vê isto."
          className="min-h-[100px] resize-none border-dashed bg-[color:var(--warning)]/5"
        />
      </CardContent>
    </Card>
  );
}
