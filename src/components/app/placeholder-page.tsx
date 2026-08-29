import { AppShell } from "./app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        <Card className="rounded-xl border-dashed border-border/80 bg-card/50 shadow-none">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Construction className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Módulo em construção</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Esta área faz parte do protótipo Jáwda. As telas serão liberadas nos próximos ciclos.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
