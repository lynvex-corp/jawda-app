import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, UserPlus, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/utils";
import {
  PERMISSION_MATRIX,
  ROLE_OPTIONS,
  useOrgUsers,
  useInviteOrgUser,
  type OrgRole,
  type Perm,
} from "@/lib/queries/usuarios";

const PERMS: Perm[] = ["Ver", "Criar", "Editar", "Aprovar", "Excluir"];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

function formatUltimoAcesso(iso: string | null) {
  if (!iso) return "Nunca acessou";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 2) return "ontem";
  return `há ${d} dias`;
}

export function UsuariosPage() {
  const { currentOrg } = useAuth();
  const { data: usuarios = [], isLoading } = useOrgUsers();
  const [busca, setBusca] = useState("");
  const [selectedRole, setSelectedRole] = useState<OrgRole>(ROLE_OPTIONS[1].value);
  const [inviteOpen, setInviteOpen] = useState(false);

  const contagemPorPapel = useMemo(() => {
    const map = new Map<OrgRole, number>();
    for (const u of usuarios) map.set(u.role, (map.get(u.role) ?? 0) + 1);
    return map;
  }, [usuarios]);

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter(
      (u) =>
        u.fullName.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo) ||
        ROLE_OPTIONS.find((r) => r.value === u.role)
          ?.label.toLowerCase()
          .includes(termo),
    );
  }, [usuarios, busca]);

  const roleInfo = ROLE_OPTIONS.find((r) => r.value === selectedRole)!;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Usuários e Permissões</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Convide pessoas, defina o perfil de acesso de cada uma e controle o que podem ver e
              fazer.
            </p>
          </div>
          <Button
            className="gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus className="h-4 w-4" /> Novo usuário
          </Button>
        </div>

        <Tabs defaultValue="usuarios">
          <TabsList>
            <TabsTrigger value="usuarios">Usuários ({usuarios.length})</TabsTrigger>
            <TabsTrigger value="perfis">Perfis de acesso ({ROLE_OPTIONS.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="mt-4 space-y-4">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário, e-mail ou perfil…"
                className="h-9 pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Carregando usuários…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && usuariosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Nenhum usuário encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {usuariosFiltrados.map((u) => (
                    <TableRow key={u.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-brand-soft text-brand text-xs font-semibold">
                              {initials(u.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-sm font-medium leading-tight">{u.fullName}</div>
                            <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ROLE_OPTIONS.find((r) => r.value === u.role)?.label ?? u.role}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.unidade}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatUltimoAcesso(u.lastActivityAt)}
                      </TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="perfis" className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setSelectedRole(r.value)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selectedRole === r.value
                      ? "border-brand bg-brand-soft/50 ring-1 ring-brand"
                      : "border-border bg-card hover:border-brand/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-brand" />
                    <div className="text-sm font-semibold">{r.label}</div>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{r.descricao}</p>
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    {contagemPorPapel.get(r.value) ?? 0} usuários
                  </div>
                </button>
              ))}
            </div>

            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base">Matriz de permissões — {roleInfo.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Os perfis de acesso da Jáwda são fixos e não podem ser configurados. Esta matriz é
                  somente para consulta.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Módulo</TableHead>
                      {PERMS.map((p) => (
                        <TableHead key={p} className="text-center">
                          {p}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERMISSION_MATRIX.map((row) => (
                      <TableRow key={row.modulo}>
                        <TableCell className="font-medium">
                          {row.modulo}
                          {row.nota && (
                            <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                              {row.nota}
                            </p>
                          )}
                        </TableCell>
                        {PERMS.map((p) => {
                          const has = row.matriz[selectedRole]?.includes(p) ?? false;
                          return (
                            <TableCell key={p} className="text-center">
                              <div className="flex justify-center">
                                <Switch checked={has} disabled />
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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <InviteUserForm orgId={currentOrg?.org_id ?? ""} onDone={() => setInviteOpen(false)} />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function InviteUserForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const inviteUser = useInviteOrgUser();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("collaborator");

  const enviar = () => {
    if (!orgId || !fullName.trim() || !email.trim()) {
      toast.error("Preencha nome e e-mail para convidar.");
      return;
    }
    inviteUser.mutate(
      { orgId, email: email.trim(), fullName: fullName.trim(), role },
      {
        onSuccess: () => {
          toast.success("Convite enviado", {
            description: `${fullName} recebeu um e-mail para definir a senha.`,
          });
          onDone();
        },
        onError: (e) => toast.error("Erro ao convidar", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Novo usuário</DialogTitle>
        <DialogDescription>
          Um e-mail é enviado com o link de definição de senha. O perfil escolhido decide o que a
          pessoa poderá ver e fazer no sistema.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <div>
          <label className="text-xs font-medium">Nome completo</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium">E-mail</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Perfil de acesso</label>
          <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Ordem alfabética pelo rótulo — regra 21.7 do Guia. */}
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="auditor">Auditor</SelectItem>
              <SelectItem value="collaborator">Colaborador</SelectItem>
              <SelectItem value="quality_manager">Gestor da Qualidade</SelectItem>
              <SelectItem value="area_manager">Gestor de Área</SelectItem>
              <SelectItem value="viewer">Somente Leitura</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          onClick={enviar}
          disabled={inviteUser.isPending}
          className="bg-brand text-white hover:bg-brand/90"
        >
          {inviteUser.isPending ? "Enviando…" : "Enviar convite"}
        </Button>
      </DialogFooter>
    </>
  );
}
