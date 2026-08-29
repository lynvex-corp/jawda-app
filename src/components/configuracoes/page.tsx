import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JawdaLogo } from "@/components/brand/logo";
import { Upload, Plug, CheckCircle2, ArrowRight } from "lucide-react";

const normas = [
  { nome: "ISO 9001", desc: "Gestão da Qualidade", ativa: true, cor: "bg-brand" },
  {
    nome: "ISO 14001",
    desc: "Gestão Ambiental",
    ativa: false,
    cor: "bg-[color:var(--severity-low)]",
  },
  {
    nome: "ISO 45001",
    desc: "Saúde e Segurança Ocupacional",
    ativa: false,
    cor: "bg-[color:var(--severity-high)]",
  },
];

const slas = [
  { grav: "Crítica", cor: "var(--severity-critical)", prazo: 24, unidade: "horas" },
  { grav: "Alta", cor: "var(--severity-high)", prazo: 72, unidade: "horas" },
  { grav: "Média", cor: "var(--severity-medium)", prazo: 7, unidade: "dias" },
  { grav: "Baixa", cor: "var(--severity-low)", prazo: 15, unidade: "dias" },
];

const integracoes = [
  {
    nome: "RH — Senior Sistemas",
    desc: "Sincroniza cargos, colaboradores e treinamentos.",
    status: "conectado",
  },
  {
    nome: "ERP / Suprimentos — TOTVS",
    desc: "Ordens de compra e cadastro de fornecedores.",
    status: "conectado",
  },
  {
    nome: "Controle de Frota — Cobli",
    desc: "Manutenções e checklist de veículos.",
    status: "disponivel",
  },
  {
    nome: "Requisitos Legais — Verde Ghaia",
    desc: "Consultoria de obrigações legais aplicáveis.",
    status: "disponivel",
  },
  {
    nome: "BI — Power BI",
    desc: "Exporta indicadores para dashboards corporativos.",
    status: "disponivel",
  },
  { nome: "SSO — Microsoft Entra ID", desc: "Login corporativo unificado.", status: "conectado" },
];

export function ConfiguracoesPage() {
  const [contratadas, setContratadas] = useState<Record<string, boolean>>({
    "ISO 9001": true,
    "ISO 14001": false,
    "ISO 45001": false,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personalização da plataforma, normas contratadas, SLAs e integrações.
          </p>
        </div>

        <Tabs defaultValue="identidade">
          <TabsList>
            <TabsTrigger value="identidade">Identidade</TabsTrigger>
            <TabsTrigger value="normas">Normas contratadas</TabsTrigger>
            <TabsTrigger value="sla">Notificações e SLAs</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          </TabsList>

          <TabsContent value="identidade" className="mt-4">
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="text-base">Marca da empresa cliente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <Label>Logo</Label>
                    <div className="mt-2 flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
                        <JawdaLogo showWordmark={false} size={40} />
                      </div>
                      <Button variant="outline" className="gap-2">
                        <Upload className="h-4 w-4" /> Enviar logo
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      PNG ou SVG, fundo transparente, até 1 MB.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nome fantasia</Label>
                      <Input defaultValue="Construtora Alfa" className="mt-2" />
                    </div>
                    <div>
                      <Label>Razão social</Label>
                      <Input defaultValue="Alfa Engenharia e Construções LTDA" className="mt-2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Cor primária</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <div
                          className="h-9 w-9 rounded-lg border border-border"
                          style={{ background: "#1F4E8C" }}
                        />
                        <Input defaultValue="#1F4E8C" className="h-9" />
                      </div>
                    </div>
                    <div>
                      <Label>Cor de destaque</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <div
                          className="h-9 w-9 rounded-lg border border-border"
                          style={{ background: "#DCE6F5" }}
                        />
                        <Input defaultValue="#DCE6F5" className="h-9" />
                      </div>
                    </div>
                    <div>
                      <Label>Cor de texto</Label>
                      <div className="mt-2 flex items-center gap-2">
                        <div
                          className="h-9 w-9 rounded-lg border border-border"
                          style={{ background: "#1A1A1A" }}
                        />
                        <Input defaultValue="#1A1A1A" className="h-9" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="text-base">Prévia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="flex items-center justify-between border-b border-border bg-brand px-4 py-3 text-brand-foreground">
                      <div className="flex items-center gap-2">
                        <JawdaLogo showWordmark size={22} />
                      </div>
                      <span className="text-xs opacity-80">Construtora Alfa</span>
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="h-3 w-2/3 rounded bg-muted" />
                      <div className="h-3 w-1/2 rounded bg-muted" />
                      <Button className="mt-2 bg-brand text-brand-foreground">
                        Botão de exemplo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="normas" className="mt-4">
            <p className="mb-4 text-sm text-muted-foreground">
              Cada norma é um módulo independente — contrate no modelo add-on conforme a maturidade
              do seu sistema de gestão.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {normas.map((n) => (
                <Card key={n.nome} className="rounded-xl">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl ${n.cor} text-white text-xs font-bold`}
                      >
                        {n.nome.split(" ")[1]}
                      </div>
                      {contratadas[n.nome] && (
                        <Badge className="bg-[color:var(--severity-low)]/15 text-[color:var(--severity-low)] hover:bg-[color:var(--severity-low)]/15">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Ativa
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-3 text-base">{n.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                      <span className="text-xs font-medium">
                        {contratadas[n.nome] ? "Módulo contratado" : "Contratar módulo"}
                      </span>
                      <Switch
                        checked={contratadas[n.nome]}
                        onCheckedChange={(v) => setContratadas((s) => ({ ...s, [n.nome]: v }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sla" className="mt-4">
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base">Prazos padrão de resposta por gravidade</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gravidade</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Notificar responsável</TableHead>
                      <TableHead>Escalar ao gestor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slas.map((s) => (
                      <TableRow key={s.grav}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: s.cor }}
                            />
                            <span className="font-medium">{s.grav}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input defaultValue={s.prazo} className="h-8 w-20" />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.unidade}</TableCell>
                        <TableCell>
                          <Switch defaultChecked />
                        </TableCell>
                        <TableCell>
                          <Switch defaultChecked={s.grav === "Crítica" || s.grav === "Alta"} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integracoes" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {integracoes.map((i) => (
                <Card key={i.nome} className="rounded-xl">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                        <Plug className="h-5 w-5" />
                      </div>
                      <Badge
                        className={
                          i.status === "conectado"
                            ? "bg-[color:var(--severity-low)]/15 text-[color:var(--severity-low)] hover:bg-[color:var(--severity-low)]/15"
                            : "bg-muted text-muted-foreground hover:bg-muted"
                        }
                      >
                        {i.status === "conectado" ? "Conectado" : "Disponível"}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{i.nome}</div>
                      <p className="mt-1 text-xs text-muted-foreground">{i.desc}</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <Switch defaultChecked={i.status === "conectado"} />
                      <Button variant="ghost" size="sm" className="gap-1 text-xs text-brand">
                        Configurar <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
