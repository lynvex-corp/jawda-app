import { Bell, Circle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJawda, formatRelative } from "@/lib/jawda-store";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";

const toneClasses = {
  info: "text-brand bg-brand-soft",
  success: "text-[color:var(--success)] bg-[color:var(--success)]/10",
  warning: "text-[color:var(--severity-high)] bg-[color:var(--severity-high)]/10",
  danger: "text-[color:var(--severity-critical)] bg-[color:var(--severity-critical)]/10",
};

export function NotificationsDrawer() {
  const { notificacoes, logAtividades, unreadCount, markNotificationsRead } = useJawda();
  const [open, setOpen] = useState(false);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setTimeout(() => markNotificationsRead(), 600);
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notificações (${unreadCount} não lidas)`}
          className="relative h-9 w-9 rounded-lg"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--severity-critical)] px-1 text-[10px] font-semibold text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="text-base">Atividades recentes</SheetTitle>
          <SheetDescription className="text-xs">
            Notificações do sistema e trilha de auditoria da sessão.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="notifs" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-5 mt-3 grid w-auto grid-cols-2">
            <TabsTrigger value="notifs">
              Notificações
              {unreadCount > 0 && (
                <Badge className="ml-2 h-4 rounded-full bg-[color:var(--severity-critical)] px-1.5 text-[10px] text-white">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="log">Trilha</TabsTrigger>
          </TabsList>

          <TabsContent value="notifs" className="flex-1 overflow-hidden mt-3">
            <ScrollArea className="h-full px-5 pb-6">
              {notificacoes.length === 0 ? (
                <EmptyState label="Sem notificações no momento." />
              ) : (
                <ul className="space-y-2">
                  {notificacoes.map((n) => {
                    const body = (
                      <div
                        className={cn(
                          "flex gap-3 rounded-lg border border-border p-3 transition-colors hover:border-brand/40",
                          !n.read && "bg-brand-soft/30",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            toneClasses[n.tone],
                          )}
                        >
                          <Bell className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-medium text-foreground">{n.title}</div>
                            {!n.read && <Circle className="h-2 w-2 fill-brand text-brand mt-1.5" />}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {n.description}
                          </p>
                          <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {formatRelative(n.at)}
                          </div>
                        </div>
                      </div>
                    );
                    return (
                      <li key={n.id}>
                        {n.link ? (
                          <Link to={n.link} onClick={() => setOpen(false)} className="block">
                            {body}
                          </Link>
                        ) : (
                          body
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="log" className="flex-1 overflow-hidden mt-3">
            <ScrollArea className="h-full px-5 pb-6">
              {logAtividades.length === 0 ? (
                <EmptyState label="Nenhuma atividade registrada nesta sessão." />
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-4">
                  {logAtividades.slice(0, 40).map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-background bg-brand" />
                      <div className="text-sm text-foreground">
                        <span className="font-medium">{a.actor.nome}</span>{" "}
                        <span className="text-muted-foreground">{a.verb}</span>{" "}
                        <span className="font-mono text-xs text-brand">{a.target}</span>
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {a.actor.cargo} · {formatRelative(a.at)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Bell className="h-5 w-5" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
