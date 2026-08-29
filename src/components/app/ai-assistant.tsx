import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Sparkles, Send, X } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useJawda } from "@/lib/jawda-store";
import {
  getAssistantContext,
  respondTo,
  type AssistantAction,
  type AssistantResponse,
} from "@/lib/ai-assistant-context";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  action?: AssistantAction;
  applied?: boolean;
}

export function AIAssistant() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const ctx = getAssistantContext(pathname);
  const { addNC, addPlano, addAuditoria, addRisco } = useJawda();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset chat when module context changes
  useEffect(() => {
    setMessages([
      {
        id: "greeting",
        role: "assistant",
        content: ctx.greeting,
      },
    ]);
  }, [ctx.greeting]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const resp: AssistantResponse = respondTo(trimmed, ctx.moduleName);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: resp.markdown,
          action: resp.action,
        },
      ]);
      setThinking(false);
    }, 1500);
  };

  const applyAction = (msgId: string, action: AssistantAction) => {
    let codigo = "";
    try {
      if (action.kind === "create_nc") {
        const nc = addNC(action.payload as { descricao: string });
        codigo = nc.codigo;
      } else if (action.kind === "create_plano") {
        const p = addPlano(action.payload as { descricao: string });
        codigo = p.codigo;
      } else if (action.kind === "create_auditoria") {
        const a = addAuditoria(action.payload as { escopo: string });
        codigo = a.codigo;
      } else if (action.kind === "create_risco") {
        const r = addRisco(action.payload as { descricao: string });
        codigo = r.codigo;
      }
      toast.success("Sugestão aplicada", {
        description: codigo ? `Registro ${codigo} criado com sucesso.` : "Registro criado.",
      });
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m)));
    } catch (e) {
      toast.error("Não foi possível aplicar a sugestão");
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        aria-label="Abrir Assistente IA Jáwda"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-brand text-brand-foreground shadow-lg shadow-brand/30 transition-all",
          "hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-brand/30",
        )}
      >
        <Sparkles className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-soft opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-soft border-2 border-background" />
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 flex flex-col gap-0 [&>button]:hidden"
        >
          <SheetHeader className="border-b border-border px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle className="text-base">Assistente IA Jáwda</SheetTitle>
                  <SheetDescription className="text-xs">
                    Contexto: {ctx.moduleName}
                  </SheetDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="space-y-4 px-5 py-4">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onApply={(action) => applyAction(m.id, action)}
                />
              ))}
              {thinking && <ThinkingBubble />}
            </div>
          </div>

          {/* Chips */}
          {messages.length <= 1 && !thinking && (
            <div className="border-t border-border bg-muted/30 px-5 py-3">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Sugestões rápidas
              </div>
              <div className="flex flex-wrap gap-2">
                {ctx.chips.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => send(chip.prompt)}
                    className="rounded-full border border-brand/30 bg-brand-soft/60 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand-soft"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Pergunte à IA Jáwda…"
                rows={2}
                className="min-h-[52px] resize-none rounded-lg"
                disabled={thinking}
              />
              <Button
                type="submit"
                size="icon"
                disabled={thinking || !input.trim()}
                className="h-10 w-10 shrink-0 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
                aria-label="Enviar mensagem"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MessageBubble({
  message,
  onApply,
}: {
  message: ChatMessage;
  onApply: (action: AssistantAction) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-brand text-brand-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-1 prose-headings:mb-1.5 prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-table:my-2 prose-th:px-2 prose-td:px-2">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.action && !message.applied && (
          <Button
            size="sm"
            className="mt-3 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={() => onApply(message.action!)}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {message.action.label}
          </Button>
        )}
        {message.applied && (
          <div className="mt-3 rounded-md border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 px-2.5 py-1.5 text-xs text-[color:var(--success)]">
            ✓ Sugestão aplicada
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Jáwda IA está analisando</span>
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:300ms]" />
          </span>
        </div>
      </div>
    </div>
  );
}
