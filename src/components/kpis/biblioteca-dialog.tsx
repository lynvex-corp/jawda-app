import { Library, PlusCircle, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { bibliotecaIndicadores, type BibliotecaItem } from "@/lib/kpi-data";

/* ---------- Escolha: do zero ou biblioteca ---------- */

export function EscolhaCriacaoDialog({
  open,
  onOpenChange,
  onDoZero,
  onBiblioteca,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDoZero: () => void;
  onBiblioteca: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Como deseja criar o indicador?</DialogTitle>
          <DialogDescription>
            Comece do zero ou adote indicadores prontos da biblioteca Jáwda.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={onDoZero}
            className="rounded-xl border border-border/80 p-4 text-left transition hover:border-brand/50 hover:bg-brand-soft/40"
          >
            <PlusCircle className="mb-2 h-5 w-5 text-brand" />
            <p className="text-sm font-semibold text-foreground">Criar do zero</p>
            <p className="text-[11px] text-muted-foreground">
              Wizard em 3 passos com preview em tempo real.
            </p>
          </button>
          <button
            onClick={onBiblioteca}
            className="rounded-xl border border-border/80 p-4 text-left transition hover:border-brand/50 hover:bg-brand-soft/40"
          >
            <Library className="mb-2 h-5 w-5 text-brand" />
            <p className="text-sm font-semibold text-foreground">Escolher da biblioteca</p>
            <p className="text-[11px] text-muted-foreground">
              Indicadores sugeridos por categoria.
            </p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Biblioteca ---------- */

export function BibliotecaDialog({
  open,
  onOpenChange,
  onAdotar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdotar: (item: BibliotecaItem) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Biblioteca de indicadores sugeridos</DialogTitle>
          <DialogDescription>
            Adote um indicador pronto e ajuste no wizard antes de salvar.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[58vh] overflow-y-auto pr-1">
          <Accordion type="multiple" defaultValue={["Cliente"]}>
            {bibliotecaIndicadores.map((g) => (
              <AccordionItem key={g.categoria} value={g.categoria}>
                <AccordionTrigger className="text-sm font-semibold">
                  {g.categoria}
                  <Badge variant="outline" className="ml-2 rounded-md text-[10px]">
                    {g.itens.length}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {g.itens.map((i) => (
                      <Card key={i.nome} className="rounded-xl border-border/80">
                        <CardContent className="space-y-2 p-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{i.nome}</p>
                            <p className="text-[11px] text-muted-foreground">{i.descricao}</p>
                          </div>
                          <p className="rounded-md bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
                            {i.formula}
                          </p>
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            <Badge variant="outline" className="rounded-md">
                              {i.unidade}
                            </Badge>
                            <Badge variant="outline" className="rounded-md">
                              {i.frequencia}
                            </Badge>
                            <Badge variant="outline" className="rounded-md">
                              {i.polaridade === "menor_melhor"
                                ? "Menor é melhor"
                                : i.polaridade === "faixa_ideal"
                                  ? "Faixa ideal"
                                  : "Maior é melhor"}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full rounded-lg text-[11px]"
                            onClick={() => onAdotar(i)}
                          >
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Adotar este indicador
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
