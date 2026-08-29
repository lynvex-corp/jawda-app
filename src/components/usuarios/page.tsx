import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Search, UserPlus, ShieldCheck } from "lucide-react";

const usuarios = [
  {
    nome: "Ana Ribeiro",
    email: "ana.ribeiro@construtora.com.br",
    perfil: "Gestor da Qualidade",
    unidade: "Matriz — SP",
    ultimo: "há 5 min",
    ativo: true,
  },
  {
    nome: "Bruno Alves",
    email: "bruno@construtora.com.br",
    perfil: "Administrador",
    unidade: "Matriz — SP",
    ultimo: "há 1 h",
    ativo: true,
  },
  {
    nome: "Carla Menezes",
    email: "carla.m@construtora.com.br",
    perfil: "Auditor",
    unidade: "Filial — Campinas",
    ultimo: "há 2 h",
    ativo: true,
  },
  {
    nome: "Diego Farias",
    email: "diego@construtora.com.br",
    perfil: "Gestor de Área",
    unidade: "Obra Vila Nova",
    ultimo: "ontem",
    ativo: true,
  },
  {
    nome: "Eduarda Prado",
    email: "eduarda@construtora.com.br",
    perfil: "Colaborador",
    unidade: "Obra Vila Nova",
    ultimo: "há 3 dias",
    ativo: true,
  },
  {
    nome: "Felipe Rocha",
    email: "felipe.r@construtora.com.br",
    perfil: "Somente Leitura",
    unidade: "Filial — RJ",
    ultimo: "há 12 dias",
    ativo: false,
  },
  {
    nome: "Gabriela Souza",
    email: "gabi.souza@construtora.com.br",
    perfil: "Auditor",
    unidade: "Matriz — SP",
    ultimo: "há 4 h",
    ativo: true,
  },
  {
    nome: "Henrique Lima",
    email: "henrique@construtora.com.br",
    perfil: "Colaborador",
    unidade: "Obra Centro",
    ultimo: "há 1 dia",
    ativo: true,
  },
];

const modulos = [
  "Não Conformidades",
  "Planos de Ação",
  "Auditorias",
  "Documentos",
  "Indicadores",
  "Riscos",
  "Estratégia",
  "Configurações",
];
const perms = ["Ver", "Criar", "Editar", "Aprovar", "Excluir"] as const;

type Perm = (typeof perms)[number];

const perfis: {
  nome: string;
  descricao: string;
  usuarios: number;
  matriz: Record<string, Perm[]>;
}[] = [
  {
    nome: "Administrador",
    descricao: "Acesso total à plataforma e configurações.",
    usuarios: 2,
    matriz: Object.fromEntries(modulos.map((m) => [m, [...perms]])),
  },
  {
    nome: "Gestor da Qualidade",
    descricao: "Comanda o SGI, aprova ações e auditorias.",
    usuarios: 3,
    matriz: Object.fromEntries(
      modulos.map((m) => [m, ["Ver", "Criar", "Editar", "Aprovar"] as Perm[]]),
    ),
  },
  {
    nome: "Auditor",
    descricao: "Executa auditorias e registra apontamentos.",
    usuarios: 5,
    matriz: {
      "Não Conformidades": ["Ver", "Criar"],
      "Planos de Ação": ["Ver"],
      Auditorias: ["Ver", "Criar", "Editar"],
      Documentos: ["Ver"],
      Indicadores: ["Ver"],
      Riscos: ["Ver"],
      Estratégia: ["Ver"],
      Configurações: [],
    },
  },
  {
    nome: "Gestor de Área",
    descricao: "Responsável pelas ações do seu processo/setor.",
    usuarios: 8,
    matriz: {
      "Não Conformidades": ["Ver", "Criar", "Editar"],
      "Planos de Ação": ["Ver", "Criar", "Editar"],
      Auditorias: ["Ver"],
      Documentos: ["Ver"],
      Indicadores: ["Ver", "Editar"],
      Riscos: ["Ver", "Criar"],
      Estratégia: ["Ver"],
      Configurações: [],
    },
  },
  {
    nome: "Colaborador",
    descricao: "Executa ações e registra ocorrências.",
    usuarios: 42,
    matriz: {
      "Não Conformidades": ["Ver", "Criar"],
      "Planos de Ação": ["Ver"],
      Auditorias: [],
      Documentos: ["Ver"],
      Indicadores: ["Ver"],
      Riscos: [],
      Estratégia: [],
      Configurações: [],
    },
  },
  {
    nome: "Somente Leitura",
    descricao: "Consulta dados sem realizar alterações.",
    usuarios: 6,
    matriz: Object.fromEntries(modulos.map((m) => [m, ["Ver"] as Perm[]])),
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

export function UsuariosPage() {
  const [selectedPerfil, setSelectedPerfil] = useState(perfis[1].nome);
  const perfil = perfis.find((p) => p.nome === selectedPerfil)!;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Usuários e Permissões</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Controle de acesso e perfis operacionais da plataforma.
            </p>
          </div>
          <Button className="gap-2 bg-brand text-brand-foreground hover:bg-brand/90">
            <UserPlus className="h-4 w-4" /> Novo usuário
          </Button>
        </div>

        <Tabs defaultValue="usuarios">
          <TabsList>
            <TabsTrigger value="usuarios">Usuários ({usuarios.length})</TabsTrigger>
            <TabsTrigger value="perfis">Perfis de acesso ({perfis.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="mt-4 space-y-4">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar usuário, e-mail ou perfil…" className="h-9 pl-9" />
            </div>
            <Card className="rounded-xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.email} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-brand-soft text-brand text-xs font-semibold">
                              {initials(u.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-sm font-medium leading-tight">{u.nome}</div>
                            <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.perfil}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.unidade}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.ultimo}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            u.ativo
                              ? "bg-[color:var(--severity-low)]/15 text-[color:var(--severity-low)] hover:bg-[color:var(--severity-low)]/15"
                              : "bg-muted text-muted-foreground hover:bg-muted"
                          }
                        >
                          {u.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="perfis" className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {perfis.map((p) => (
                <button
                  key={p.nome}
                  onClick={() => setSelectedPerfil(p.nome)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selectedPerfil === p.nome
                      ? "border-brand bg-brand-soft/50 ring-1 ring-brand"
                      : "border-border bg-card hover:border-brand/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-brand" />
                    <div className="text-sm font-semibold">{p.nome}</div>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{p.descricao}</p>
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    {p.usuarios} usuários
                  </div>
                </button>
              ))}
            </div>

            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base">Matriz de permissões — {perfil.nome}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Módulo</TableHead>
                      {perms.map((p) => (
                        <TableHead key={p} className="text-center">
                          {p}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modulos.map((m) => (
                      <TableRow key={m}>
                        <TableCell className="font-medium">{m}</TableCell>
                        {perms.map((p) => {
                          const has = perfil.matriz[m]?.includes(p) ?? false;
                          return (
                            <TableCell key={p} className="text-center">
                              <div className="flex justify-center">
                                <Switch checked={has} />
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
