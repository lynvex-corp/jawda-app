import { createContext, useContext, useState, useRef, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { JawdaLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { Repeat, Lightbulb, Languages, Fingerprint, Wrench } from "lucide-react";

/** Modal "Sobre a Jáwda" — identidade da Jáwda como produto/empresa
 * (estática, igual para todo cliente, sem org_id). NÃO confundir com a
 * sub-aba "Missão, Visão, Valores e Propósito" (strategic_directives),
 * que é o documento formal versionado de CADA empresa cliente — essa
 * tabela não é tocada nem referenciada aqui.
 *
 * Dois gatilhos abrem este mesmo modal: clique no logo (SidebarHeader em
 * app-sidebar.tsx) e clique na frase de rodapé (SobreJawdaTrigger,
 * renderizada em AppShell — presente em toda tela logada). */

type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const SobreCtx = createContext<Ctx>({ open: false, setOpen: () => {} });

export function useSobreJawda() {
  return useContext(SobreCtx);
}

const pilares = [
  {
    titulo: "Propósito",
    texto:
      "Ajudar organizações a construir sistemas de gestão mais maduros com o DNA de cada uma delas, não um modelo importado que se impõe sobre a cultura.",
  },
  {
    titulo: "Missão",
    texto:
      "Transformar sistemas de gestão da qualidade em experiências que as pessoas queiram usar, para que cumprir a norma deixe de ser um evento anual e vire um hábito vivido todos os dias.",
  },
  {
    titulo: "Visão",
    texto:
      'Ser a razão pela qual empresas param de perguntar só "estamos em conformidade?" e passam a perguntar "nossa gente vive isso de verdade?"',
  },
];

const valores = [
  {
    icon: Repeat,
    titulo: "Cultura não é decreto, é prática",
    texto: "Pequenas ações repetidas mudam comportamento, não um manual guardado na gaveta.",
  },
  {
    icon: Lightbulb,
    titulo: "Ninguém protege o que não entende",
    texto: "Um sistema que ensina o porquê gera gente que decide contribuir, não só obedece.",
  },
  {
    icon: Languages,
    titulo: "O topo e a base precisam da mesma linguagem",
    texto:
      "Diretoria e operação enxergando o mesmo painel é o que transforma conformidade em maturidade.",
  },
  {
    icon: Fingerprint,
    titulo: "Todo processo carrega o DNA de quem o executa",
    texto: "Não existe padrão universal; existe adaptação inteligente.",
  },
  {
    icon: Wrench,
    titulo: "Sistema é meio, não fim",
    texto: "A tecnologia existe para facilitar comportamento humano, nunca para substituí-lo.",
  },
];

export function SobreJawdaProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <SobreCtx.Provider value={{ open, setOpen }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            closeRef.current?.focus();
          }}
          className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-2xl p-0"
        >
          <DialogClose ref={closeRef} className="sr-only">
            Fechar
          </DialogClose>
          <div className="flex flex-col items-center gap-2 border-b border-border/70 bg-brand-soft/30 px-6 py-8 text-center">
            <JawdaLogo showWordmark={false} size={52} />
            <DialogTitle className="text-lg font-semibold tracking-[0.18em] text-foreground">
              JÁWDA
            </DialogTitle>
            <DialogDescription className="max-w-md text-sm font-medium text-brand">
              Qualidade como cultura, sistema como facilitador.
            </DialogDescription>
          </div>

          <div className="space-y-8 px-6 py-6 md:px-8">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                De onde viemos
              </h3>
              <p className="text-sm leading-relaxed text-foreground/90">
                Toda empresa que já passou por uma auditoria ISO 9001 conhece a cena: a planilha
                atualizada às pressas, o procedimento lido pela primeira vez no dia da visita, e no
                dia seguinte tudo voltando a ser como era antes. A certificação fica pendurada na
                parede — mas a cultura não muda.
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">
                Foi observando essa cena se repetir que nasceu a pergunta que deu origem à Jáwda: e
                se o sistema de gestão da qualidade não fosse feito para o auditor, mas para as
                pessoas que vivem o processo todos os dias?
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">
                Jáwda significa qualidade, em árabe. Uma escolha de origem: qualidade como algo que
                se enraíza, não que se decreta uma vez por ano numa sala de reunião.
              </p>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              {pilares.map((p) => (
                <div
                  key={p.titulo}
                  className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
                >
                  <div className="text-sm font-semibold text-brand">{p.titulo}</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.texto}</p>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                O que acreditamos
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {valores.map((v) => (
                  <div
                    key={v.titulo}
                    className="flex gap-3 rounded-xl border border-border/70 bg-muted/30 p-3"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <v.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground">{v.titulo}</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {v.texto}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <p className="border-t border-border/60 pt-4 text-[11px] leading-relaxed text-muted-foreground">
              O "J" representa identidade que não muda; o "W", conexão e maturidade em construção —
              juntos, um selo de cultura consolidada e evolução constante.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </SobreCtx.Provider>
  );
}

export function SobreJawdaTrigger({ className }: { className?: string }) {
  const { setOpen } = useSobreJawda();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "cursor-pointer text-xs text-muted-foreground transition-colors hover:text-brand hover:underline",
        className,
      )}
    >
      Qualidade como cultura, sistema como facilitador.
    </button>
  );
}
