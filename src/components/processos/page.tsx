import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Truck,
  HardHat,
  Users,
  ShieldCheck,
  Server,
  ArrowRight,
  FileText,
} from "lucide-react";

/** Hub de navegação dos Processos de Suporte (Parte 5 do prompt desta
 * aba) — só isso. O construtor de fluxo genérico (BPMN editável vs.
 * passo a passo) continua indefinido, decisão do Rachid pendente de
 * validação com a empresa SERHUM. Por isso esta tela mostra ícone e
 * navegação para cada processo, mas só implementa de fato o que já
 * existe em produção: o link para Fornecedores, dentro de Suprimentos.
 * Os outros 5 processos não têm tela própria — não inventar RACI,
 * indicadores ou documentos fictícios para eles. */
const processos = [
  { id: "com", nome: "Comercial", icon: ShoppingCart },
  { id: "sup", nome: "Suprimentos", icon: Truck, to: "/aquisicao" as const },
  { id: "pro", nome: "Produção / Obras", icon: HardHat },
  { id: "rh", nome: "Recursos Humanos", icon: Users },
  { id: "qua", nome: "Qualidade / SGI", icon: ShieldCheck },
  { id: "ti", nome: "Tecnologia da Informação", icon: Server },
];

export function ProcessosPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Processos e Fluxos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Índice de navegação dos processos de suporte — requisito 4.4.
          </p>
        </header>

        <Link to="/documentos">
          <Card className="rounded-2xl border-brand/20 bg-brand-soft/40 shadow-sm transition hover:border-brand/40">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-brand">Política da Qualidade</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Ver e formalizar em Documentos
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-brand" />
            </CardContent>
          </Card>
        </Link>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {processos.map((p) => {
            const Icon = p.icon;
            const content = (
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{p.nome}</h3>
                  {p.to ? (
                    <p className="mt-0.5 text-[11px] text-brand">Ver Fornecedores →</p>
                  ) : (
                    <Badge
                      variant="outline"
                      className="mt-1 rounded-md text-[10px] text-muted-foreground"
                    >
                      Sem tela própria ainda
                    </Badge>
                  )}
                </div>
              </CardContent>
            );
            return p.to ? (
              <Link key={p.id} to={p.to}>
                <Card className="rounded-2xl border-border/80 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
                  {content}
                </Card>
              </Link>
            ) : (
              <Card key={p.id} className="rounded-2xl border-border/80 opacity-70 shadow-sm">
                {content}
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
