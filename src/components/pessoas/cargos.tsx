import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { SearchableSelect } from "@/components/app/searchable-select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  GraduationCap,
  IdCard,
  CheckCircle2,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  AlertTriangle,
  FileText,
  Upload,
  ShieldAlert,
  Lock,
  Users2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  useJobPositions,
  useCreateJobPosition,
  useUpdateJobPosition,
  useDeactivateJobPosition,
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeactivateEmployee,
  useInviteEmployeeLogin,
  useEmployeeDossie,
  useUploadEmployeeAttachment,
  useEmployeeAttachmentSignedUrl,
  useCreateCompetencyAction,
  useCompleteCompetencyAction,
  useLgpdAcceptance,
  useAcceptLgpd,
  useMyEmployeeRecord,
  useLatestAwarenessTermSignature,
  useSignAwarenessTerm,
  ATTACHMENT_CATEGORY_OPTIONS,
  SITUATION_OPTIONS,
  type AttachmentCategory,
  type Employee,
  type JobPosition,
} from "@/lib/queries/pessoas";

const situationColor: Record<string, string> = {
  atende:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  atende_parcialmente:
    "bg-[color:var(--warning)]/20 text-[color:var(--severity-high)] border-[color:var(--warning)]/40",
  nao_atende:
    "bg-[color:var(--severity-critical)]/10 text-[color:var(--severity-critical)] border-[color:var(--severity-critical)]/30",
};

const TERMO_CIENCIA_TEXTO = `Declaro estar ciente das políticas de qualidade, segurança e conduta da organização, e que li e compreendi os documentos do sistema de gestão aplicáveis à minha função. Este termo é renovado anualmente.`;

function LgpdGate({ children }: { children: React.ReactNode }) {
  const { data: accepted, isLoading } = useLgpdAcceptance();
  const acceptLgpd = useAcceptLgpd();

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Carregando…
        </div>
      </AppShell>
    );
  }

  return (
    <>
      <Dialog open={accepted === false}>
        <DialogContent
          className="max-w-lg rounded-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-brand" /> Aviso de proteção de dados (LGPD)
            </DialogTitle>
            <DialogDescription>
              Este submódulo contém dados pessoais sensíveis de colaboradores, incluindo Atestado de
              Saúde Ocupacional (ASO) e documentos pessoais. O acesso é restrito e toda leitura fica
              registrada na trilha de auditoria, com autor e data. Ao continuar, você confirma que
              tratará esses dados exclusivamente para as finalidades de gestão de pessoas e
              conformidade previstas no sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() =>
                acceptLgpd.mutate(undefined, {
                  onError: (e) =>
                    toast.error("Erro ao registrar aceite", { description: getErrorMessage(e) }),
                })
              }
              className="bg-brand text-white hover:bg-brand/90"
            >
              Li e estou ciente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {accepted ? children : null}
    </>
  );
}

export function CargosPage() {
  return (
    <LgpdGate>
      <CargosContent />
    </LgpdGate>
  );
}

function CargosContent() {
  const { currentOrg } = useAuth();
  // Bloco 4, item 4: Gestor de Área entra na mesma visão de gestão que
  // Administrador e Gestor da Qualidade (espelha can_manage_hr_structure no
  // banco — RLS e UI têm que dizer a mesma coisa, senão a tela mostra um
  // botão que a escrita real recusa).
  const canManage =
    currentOrg?.role === "admin" ||
    currentOrg?.role === "quality_manager" ||
    currentOrg?.role === "area_manager";
  // Item 3: criar login é mais restrito que gerenciar cargo/pessoa — só
  // quem o item nomeia explicitamente, não o Gestor de Área.
  const canCreateLogin = currentOrg?.role === "admin" || currentOrg?.role === "quality_manager";
  const { data: myRecord, isLoading: myRecordLoading } = useMyEmployeeRecord();

  if (!canManage) {
    if (myRecordLoading) {
      return (
        <AppShell>
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Carregando…
          </div>
        </AppShell>
      );
    }
    if (myRecord) {
      return <SelfServiceView employee={myRecord} />;
    }
    return (
      <AppShell>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Cargos e Perfis é visível apenas para Administrador do Cliente, Gestor da Qualidade,
            Gestor de Área, ou o próprio colaborador (vendo o próprio registro).
          </p>
        </div>
      </AppShell>
    );
  }

  return <HrView canManage={canManage} canCreateLogin={canCreateLogin} />;
}

function HrView({ canManage, canCreateLogin }: { canManage: boolean; canCreateLogin: boolean }) {
  const { currentOrg } = useAuth();
  const { data: positions = [] } = useJobPositions();
  const { data: employees = [], isLoading } = useEmployees();
  const createPosition = useCreateJobPosition();
  const updatePosition = useUpdateJobPosition();
  const deactivatePosition = useDeactivateJobPosition();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deactivateEmployee = useDeactivateEmployee();

  // Bloco 4, item 1: abas em vez de duas tabelas empilhadas.
  const [tab, setTab] = useState<"pessoas" | "cargos">("pessoas");

  const [novoCargoOpen, setNovoCargoOpen] = useState(false);
  const [novoCargo, setNovoCargo] = useState({
    nome: "",
    requisitosTecnicos: "",
    requisitosDesejaveis: "",
    responsabilidadesAutoridades: "",
  });
  const [novosTreinamentos, setNovosTreinamentos] = useState<
    { trainingName: string; isRequired: boolean }[]
  >([]);
  const [novoTreinamentoNome, setNovoTreinamentoNome] = useState("");

  const [editingPosition, setEditingPosition] = useState<JobPosition | null>(null);
  const [editPosition, setEditPosition] = useState({
    nome: "",
    requisitosTecnicos: "",
    requisitosDesejaveis: "",
    responsabilidadesAutoridades: "",
  });
  const [editPositionTrainings, setEditPositionTrainings] = useState<
    { trainingName: string; isRequired: boolean }[]
  >([]);
  const [editPositionTrainingNome, setEditPositionTrainingNome] = useState("");

  const [novaPessoaOpen, setNovaPessoaOpen] = useState(false);
  const [novaPessoa, setNovaPessoa] = useState({
    nome: "",
    matricula: "",
    email: "",
    admissao: "",
    jobPositionId: "",
    setor: "",
  });

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [deactivatingEmployee, setDeactivatingEmployee] = useState<Employee | null>(null);
  const [deactivatingPosition, setDeactivatingPosition] = useState<JobPosition | null>(null);
  const [inviteFor, setInviteFor] = useState<Employee | null>(null);

  const salvarCargo = () => {
    if (!novoCargo.nome.trim()) {
      toast.error("Informe o nome do cargo");
      return;
    }
    createPosition.mutate(
      { ...novoCargo, trainings: novosTreinamentos },
      {
        onSuccess: () => {
          toast.success("Cargo cadastrado");
          setNovoCargoOpen(false);
          setNovoCargo({
            nome: "",
            requisitosTecnicos: "",
            requisitosDesejaveis: "",
            responsabilidadesAutoridades: "",
          });
          setNovosTreinamentos([]);
        },
        onError: (e) => toast.error("Erro ao cadastrar cargo", { description: getErrorMessage(e) }),
      },
    );
  };

  const abrirEdicaoCargo = (p: JobPosition) => {
    setEditingPosition(p);
    setEditPosition({
      nome: p.nome,
      requisitosTecnicos: p.requisitosTecnicos,
      requisitosDesejaveis: p.requisitosDesejaveis,
      responsabilidadesAutoridades: p.responsabilidadesAutoridades,
    });
    setEditPositionTrainings(
      p.trainings.map((t) => ({ trainingName: t.trainingName, isRequired: t.isRequired })),
    );
  };

  const salvarEdicaoCargo = () => {
    if (!editingPosition) return;
    if (!editPosition.nome.trim()) {
      toast.error("Informe o nome do cargo");
      return;
    }
    updatePosition.mutate(
      { id: editingPosition.id, ...editPosition, trainings: editPositionTrainings },
      {
        onSuccess: () => {
          toast.success("Cargo atualizado");
          setEditingPosition(null);
        },
        onError: (e) => toast.error("Erro ao atualizar cargo", { description: getErrorMessage(e) }),
      },
    );
  };

  const salvarPessoa = () => {
    if (!novaPessoa.nome.trim()) {
      toast.error("Informe o nome");
      return;
    }
    createEmployee.mutate(novaPessoa, {
      onSuccess: () => {
        toast.success("Pessoa cadastrada");
        setNovaPessoaOpen(false);
        setNovaPessoa({
          nome: "",
          matricula: "",
          email: "",
          admissao: "",
          jobPositionId: "",
          setor: "",
        });
      },
      onError: (e) => toast.error("Erro ao cadastrar pessoa", { description: getErrorMessage(e) }),
    });
  };

  const salvarSituacao = (employee: Employee, situacao: string) => {
    updateEmployee.mutate(
      {
        id: employee.id,
        patch: { situacao_competencia: situacao as Employee["situacaoCompetencia"] },
      },
      {
        onSuccess: () => toast.success("Situação atualizada"),
        onError: (e) => toast.error("Erro ao atualizar", { description: getErrorMessage(e) }),
      },
    );
  };

  // Item 1: "Excluir" é inativação (employees/job_positions têm DELETE
  // bloqueado no banco — nada apaga, seção 20 do Guia).
  const confirmarInativarPessoa = () => {
    if (!deactivatingEmployee) return;
    deactivateEmployee.mutate(deactivatingEmployee.id, {
      onSuccess: () => {
        toast.success(`${deactivatingEmployee.nome} inativado(a)`);
        setDeactivatingEmployee(null);
      },
      onError: (e) => toast.error("Erro ao inativar", { description: getErrorMessage(e) }),
    });
  };

  const confirmarInativarCargo = () => {
    if (!deactivatingPosition) return;
    deactivatePosition.mutate(deactivatingPosition.id, {
      onSuccess: () => {
        toast.success(`Cargo "${deactivatingPosition.nome}" inativado`);
        setDeactivatingPosition(null);
      },
      onError: (e) => toast.error("Erro ao inativar cargo", { description: getErrorMessage(e) }),
    });
  };

  const peopleForPosition = (positionId: string) =>
    employees.filter((e) => e.jobPositionId === positionId);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Cargos e Perfis
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Registre o cargo com seu perfil de requisitos e, depois, as pessoas que ocupam cada
              cargo.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNovoCargoOpen(true)}
              className="rounded-lg"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Novo Registro de Cargo
            </Button>
            <Button
              size="sm"
              onClick={() => setNovaPessoaOpen(true)}
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Novo Registro de Pessoa
            </Button>
          </div>
        </header>

        <div className="flex gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
          <button
            onClick={() => setTab("pessoas")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition",
              tab === "pessoas"
                ? "bg-white text-brand shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Pessoas ({employees.length})
          </button>
          <button
            onClick={() => setTab("cargos")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition",
              tab === "cargos"
                ? "bg-white text-brand shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Cargos ({positions.length})
          </button>
        </div>

        {tab === "pessoas" && (
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Situação da Competência</TableHead>
                    <TableHead>Pendência</TableHead>
                    <TableHead>Ação de Competência</TableHead>
                    {canCreateLogin && <TableHead className="w-10">Login</TableHead>}
                    {canManage && <TableHead className="w-10">Editar</TableHead>}
                    {canManage && <TableHead className="w-10">Excluir</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isLoading && employees.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        Nenhuma pessoa cadastrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {employees.map((e) => (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer text-xs"
                      onClick={() => setSelectedEmployeeId(e.id)}
                    >
                      <TableCell className="font-medium text-foreground">{e.nome}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.jobPositionNome ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.setor || "—"}</TableCell>
                      <TableCell onClick={(ev) => ev.stopPropagation()}>
                        <Select
                          value={e.situacaoCompetencia}
                          onValueChange={(v) => salvarSituacao(e, v)}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-7 w-[190px] rounded-md border text-[11px]",
                              situationColor[e.situacaoCompetencia],
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SITUATION_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {e.pendingRequiredTrainings > 0 ? (
                          <Badge
                            variant="outline"
                            className="rounded-md border-[color:var(--severity-high)]/40 bg-[color:var(--severity-high)]/10 text-[10px] text-[color:var(--severity-high)]"
                          >
                            {e.pendingRequiredTrainings}{" "}
                            {e.pendingRequiredTrainings === 1 ? "pendência" : "pendências"}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-md border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[10px] text-[color:var(--success)]"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Completo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {e.openCompetencyActionCount > 0 ? (
                          <Badge
                            variant="outline"
                            className="rounded-md border-[color:var(--severity-high)]/40 bg-[color:var(--severity-high)]/10 text-[10px] text-[color:var(--severity-high)]"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {e.openCompetencyActionCount} ação(ões) · em andamento
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {canCreateLogin && (
                        <TableCell onClick={(ev) => ev.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!!e.linkedUserId || !e.email}
                            onClick={() => setInviteFor(e)}
                            title={
                              e.linkedUserId
                                ? "Já tem login"
                                : !e.email
                                  ? "Cadastre um e-mail para criar login"
                                  : "Criar login"
                            }
                            className="h-7 w-7 p-0"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                      {canManage && (
                        <TableCell onClick={(ev) => ev.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingEmployee(e)}
                            className="h-7 w-7 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                      {canManage && (
                        <TableCell onClick={(ev) => ev.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeactivatingEmployee(e)}
                            className="h-7 w-7 p-0 text-[color:var(--severity-critical)] hover:text-[color:var(--severity-critical)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "cargos" && (
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <TableHead>Cargo</TableHead>
                    <TableHead>Requisitos técnicos</TableHead>
                    <TableHead>Treinamentos necessários</TableHead>
                    <TableHead>Pessoas no cargo</TableHead>
                    {canManage && <TableHead className="w-10">Editar</TableHead>}
                    {canManage && <TableHead className="w-10">Excluir</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((p) => {
                    // Contagem de linhas não vazias — requisitos_tecnicos é
                    // texto livre no banco (parágrafo), sem estrutura de
                    // lista. Convenção adotada: uma exigência por linha.
                    const reqCount = p.requisitosTecnicos
                      .split("\n")
                      .filter((l) => l.trim()).length;
                    return (
                      <TableRow key={p.id} className="text-xs">
                        <TableCell className="font-semibold text-foreground">{p.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{reqCount}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.trainings.length}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1 rounded-md text-[10px]">
                            <Users2 className="h-3 w-3" /> {p.peopleCount ?? 0}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirEdicaoCargo(p)}
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                        {canManage && (
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={(p.peopleCount ?? 0) > 0}
                              title={
                                (p.peopleCount ?? 0) > 0
                                  ? "Ainda há pessoas neste cargo — mova-as antes de inativar"
                                  : "Inativar cargo"
                              }
                              onClick={() => setDeactivatingPosition(p)}
                              className="h-7 w-7 p-0 text-[color:var(--severity-critical)] hover:text-[color:var(--severity-critical)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {positions.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        Nenhum cargo cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Novo cargo */}
      <Dialog open={novoCargoOpen} onOpenChange={setNovoCargoOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Novo Registro de Cargo</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-3 overflow-y-auto text-sm">
            <div>
              <label className="text-xs font-medium">Cargo</label>
              <Input
                value={novoCargo.nome}
                onChange={(e) => setNovoCargo({ ...novoCargo, nome: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Requisitos técnicos</label>
              <Textarea
                value={novoCargo.requisitosTecnicos}
                onChange={(e) => setNovoCargo({ ...novoCargo, requisitosTecnicos: e.target.value })}
                placeholder={"Uma exigência por linha"}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Requisitos desejáveis</label>
              <Textarea
                value={novoCargo.requisitosDesejaveis}
                onChange={(e) =>
                  setNovoCargo({ ...novoCargo, requisitosDesejaveis: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Responsabilidades e autoridades</label>
              <Textarea
                value={novoCargo.responsabilidadesAutoridades}
                onChange={(e) =>
                  setNovoCargo({ ...novoCargo, responsabilidadesAutoridades: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Treinamentos necessários</label>
              <div className="space-y-1">
                {novosTreinamentos.map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1 text-xs"
                  >
                    <span>{t.trainingName}</span>
                    <button
                      onClick={() =>
                        setNovosTreinamentos((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-[10px] text-muted-foreground hover:text-[color:var(--severity-critical)]"
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={novoTreinamentoNome}
                  onChange={(e) => setNovoTreinamentoNome(e.target.value)}
                  placeholder="Nome do treinamento"
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (!novoTreinamentoNome.trim()) return;
                    setNovosTreinamentos((prev) => [
                      ...prev,
                      { trainingName: novoTreinamentoNome.trim(), isRequired: true },
                    ]);
                    setNovoTreinamentoNome("");
                  }}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoCargoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarCargo} className="bg-brand text-white hover:bg-brand/90">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar cargo (item 1) */}
      <Dialog open={!!editingPosition} onOpenChange={(o) => !o && setEditingPosition(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar Cargo</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-3 overflow-y-auto text-sm">
            <div>
              <label className="text-xs font-medium">Cargo</label>
              <Input
                value={editPosition.nome}
                onChange={(e) => setEditPosition({ ...editPosition, nome: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Requisitos técnicos</label>
              <Textarea
                value={editPosition.requisitosTecnicos}
                onChange={(e) =>
                  setEditPosition({ ...editPosition, requisitosTecnicos: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Requisitos desejáveis</label>
              <Textarea
                value={editPosition.requisitosDesejaveis}
                onChange={(e) =>
                  setEditPosition({ ...editPosition, requisitosDesejaveis: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Responsabilidades e autoridades</label>
              <Textarea
                value={editPosition.responsabilidadesAutoridades}
                onChange={(e) =>
                  setEditPosition({ ...editPosition, responsabilidadesAutoridades: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Treinamentos necessários</label>
              <div className="space-y-1">
                {editPositionTrainings.map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1 text-xs"
                  >
                    <span>{t.trainingName}</span>
                    <button
                      onClick={() =>
                        setEditPositionTrainings((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-[10px] text-muted-foreground hover:text-[color:var(--severity-critical)]"
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={editPositionTrainingNome}
                  onChange={(e) => setEditPositionTrainingNome(e.target.value)}
                  placeholder="Nome do treinamento"
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (!editPositionTrainingNome.trim()) return;
                    setEditPositionTrainings((prev) => [
                      ...prev,
                      { trainingName: editPositionTrainingNome.trim(), isRequired: true },
                    ]);
                    setEditPositionTrainingNome("");
                  }}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPosition(null)}>
              Cancelar
            </Button>
            <Button
              onClick={salvarEdicaoCargo}
              disabled={updatePosition.isPending}
              className="bg-brand text-white hover:bg-brand/90"
            >
              {updatePosition.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova pessoa */}
      <Dialog open={novaPessoaOpen} onOpenChange={setNovaPessoaOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Novo Registro de Pessoa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Nome</label>
              <Input
                value={novaPessoa.nome}
                onChange={(e) => setNovaPessoa({ ...novaPessoa, nome: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Matrícula</label>
                <Input
                  value={novaPessoa.matricula}
                  onChange={(e) => setNovaPessoa({ ...novaPessoa, matricula: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">E-mail</label>
                <Input
                  value={novaPessoa.email}
                  onChange={(e) => setNovaPessoa({ ...novaPessoa, email: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Admissão</label>
                <Input
                  type="date"
                  value={novaPessoa.admissao}
                  onChange={(e) => setNovaPessoa({ ...novaPessoa, admissao: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Setor</label>
                <Input
                  value={novaPessoa.setor}
                  onChange={(e) => setNovaPessoa({ ...novaPessoa, setor: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Cargo</label>
              <SearchableSelect
                value={novaPessoa.jobPositionId}
                onValueChange={(v) => setNovaPessoa({ ...novaPessoa, jobPositionId: v })}
                placeholder="Selecione um cargo"
                searchPlaceholder="Buscar cargo…"
                emptyMessage="Nenhum cargo encontrado."
                className="mt-1 h-9 text-sm"
                options={[...positions]
                  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                  .map((p) => ({ value: p.id, label: p.nome }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaPessoaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarPessoa} className="bg-brand text-white hover:bg-brand/90">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar pessoa */}
      <Dialog open={!!editingEmployee} onOpenChange={(o) => !o && setEditingEmployee(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar {editingEmployee?.nome}</DialogTitle>
          </DialogHeader>
          {editingEmployee && (
            <EditEmployeeForm
              employee={editingEmployee}
              positions={positions}
              onSaved={() => setEditingEmployee(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dossiê */}
      <Dialog open={!!selectedEmployeeId} onOpenChange={(o) => !o && setSelectedEmployeeId(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          {selectedEmployeeId && <EmployeeDossieView employeeId={selectedEmployeeId} />}
        </DialogContent>
      </Dialog>

      {/* Inativar pessoa (item 1 — "excluir" é soft delete) */}
      <Dialog
        open={!!deactivatingEmployee}
        onOpenChange={(o) => !o && setDeactivatingEmployee(null)}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Inativar {deactivatingEmployee?.nome}?</DialogTitle>
            <DialogDescription>
              O registro sai das listagens de trabalho, mas o histórico (ações de competência,
              anexos, avaliações) continua preservado. Não é possível apagar de verdade — só
              inativar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivatingEmployee(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarInativarPessoa}
              disabled={deactivateEmployee.isPending}
              className="bg-[color:var(--severity-critical)] text-white hover:bg-[color:var(--severity-critical)]/90"
            >
              {deactivateEmployee.isPending ? "Inativando…" : "Inativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inativar cargo */}
      <Dialog
        open={!!deactivatingPosition}
        onOpenChange={(o) => !o && setDeactivatingPosition(null)}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Inativar cargo "{deactivatingPosition?.nome}"?</DialogTitle>
            <DialogDescription>
              O cargo sai da listagem e da matriz de treinamentos, mas o histórico de quem já o
              ocupou é preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivatingPosition(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarInativarCargo}
              disabled={deactivatePosition.isPending}
              className="bg-[color:var(--severity-critical)] text-white hover:bg-[color:var(--severity-critical)]/90"
            >
              {deactivatePosition.isPending ? "Inativando…" : "Inativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar login (item 3) */}
      <Dialog open={!!inviteFor} onOpenChange={(o) => !o && setInviteFor(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          {inviteFor && currentOrg && (
            <InviteLoginForm
              employee={inviteFor}
              orgId={currentOrg.org_id}
              onDone={() => setInviteFor(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/** Item 3 do Bloco 4: Gestor da Qualidade e Administrador criam o login a
 * partir do próprio registro da pessoa em Cargos e Perfis. Usa
 * inviteOrgUser (server function nova, service_role) e depois linka o
 * usuário criado ao employee (linked_user_id) — sem esse segundo passo, a
 * conta existiria mas ficaria desconectada da pessoa cadastrada, e nenhuma
 * política de self-service (linked_user_id = auth.uid()) reconheceria essa
 * pessoa como dona da própria conta. */
function InviteLoginForm({
  employee,
  orgId,
  onDone,
}: {
  employee: Employee;
  orgId: string;
  onDone: () => void;
}) {
  const inviteLogin = useInviteEmployeeLogin();
  const [role, setRole] = useState<
    "admin" | "quality_manager" | "auditor" | "area_manager" | "collaborator" | "viewer"
  >("collaborator");

  const enviar = () => {
    inviteLogin.mutate(
      { employeeId: employee.id, orgId, email: employee.email, fullName: employee.nome, role },
      {
        onSuccess: () => {
          toast.success("Login criado", {
            description: `${employee.nome} recebeu um e-mail para definir a senha.`,
          });
          onDone();
        },
        onError: (e) => toast.error("Erro ao criar login", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Criar login para {employee.nome}</DialogTitle>
        <DialogDescription>
          Um e-mail é enviado para {employee.email} com o link de definição de senha. O papel
          escolhido decide o que a pessoa poderá ver e fazer no sistema.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5 text-sm">
        <label className="text-xs font-medium">Perfil de acesso</label>
        <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
          <SelectTrigger className="mt-1 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Ordem alfabética pelo rótulo — regra 21.7 do Guia. */}
            <SelectItem value="admin">Administrador do Cliente</SelectItem>
            <SelectItem value="auditor">Auditor</SelectItem>
            <SelectItem value="collaborator">Colaborador</SelectItem>
            <SelectItem value="quality_manager">Gestor da Qualidade</SelectItem>
            <SelectItem value="area_manager">Gestor de Área</SelectItem>
            <SelectItem value="viewer">Somente Leitura</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          onClick={enviar}
          disabled={inviteLogin.isPending}
          className="bg-brand text-white hover:bg-brand/90"
        >
          {inviteLogin.isPending ? "Enviando…" : "Enviar convite"}
        </Button>
      </DialogFooter>
    </>
  );
}

function EditEmployeeForm({
  employee,
  positions,
  onSaved,
}: {
  employee: Employee;
  positions: { id: string; nome: string }[];
  onSaved: () => void;
}) {
  const updateEmployee = useUpdateEmployee();
  const [form, setForm] = useState({
    nome: employee.nome,
    matricula: employee.matricula,
    email: employee.email,
    setor: employee.setor,
    jobPositionId: employee.jobPositionId ?? "",
  });

  const salvar = () => {
    updateEmployee.mutate(
      {
        id: employee.id,
        patch: {
          nome: form.nome,
          matricula: form.matricula,
          email: form.email,
          setor: form.setor,
          job_position_id: form.jobPositionId || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Registro atualizado");
          onSaved();
        },
        onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="text-xs font-medium">Nome</label>
        <Input
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Matrícula</label>
          <Input
            value={form.matricula}
            onChange={(e) => setForm({ ...form, matricula: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium">E-mail</label>
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Setor</label>
          <Input
            value={form.setor}
            onChange={(e) => setForm({ ...form, setor: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Cargo</label>
          <SearchableSelect
            value={form.jobPositionId}
            onValueChange={(v) => setForm({ ...form, jobPositionId: v })}
            searchPlaceholder="Buscar cargo…"
            emptyMessage="Nenhum cargo encontrado."
            className="mt-1 h-9 text-sm"
            options={[...positions]
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
              .map((p) => ({ value: p.id, label: p.nome }))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onSaved}>
          Cancelar
        </Button>
        <Button onClick={salvar} className="bg-brand text-white hover:bg-brand/90">
          Salvar
        </Button>
      </DialogFooter>
    </div>
  );
}

function EmployeeDossieView({ employeeId }: { employeeId: string }) {
  const { currentOrg } = useAuth();
  const { data: dossie, isLoading } = useEmployeeDossie(employeeId);
  const upload = useUploadEmployeeAttachment();
  const getSignedUrl = useEmployeeAttachmentSignedUrl();
  const createAction = useCreateCompetencyAction();
  const completeAction = useCompleteCompetencyAction();
  const [category, setCategory] = useState<AttachmentCategory>("aso");
  const [novaAcao, setNovaAcao] = useState({ methodology: "", expectedDate: "" });
  const [acaoOpen, setAcaoOpen] = useState(false);

  if (isLoading || !dossie) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentOrg) return;
    upload.mutate(
      { employeeId, orgId: currentOrg.org_id, category, source: "dossie", file },
      {
        onSuccess: () => toast.success("Anexo enviado"),
        onError: (err) => toast.error("Erro ao enviar", { description: getErrorMessage(err) }),
      },
    );
    e.target.value = "";
  };

  const abrirAnexo = (path: string) => {
    getSignedUrl.mutate(path, {
      onSuccess: (url) => window.open(url, "_blank"),
      onError: (err) => toast.error("Erro ao abrir anexo", { description: getErrorMessage(err) }),
    });
  };

  const salvarAcao = () => {
    if (!novaAcao.methodology.trim() || !novaAcao.expectedDate) {
      toast.error("Preencha metodologia e data prevista");
      return;
    }
    createAction.mutate(
      { employeeId, methodology: novaAcao.methodology, expectedDate: novaAcao.expectedDate },
      {
        onSuccess: () => {
          toast.success("Ação de competência registrada");
          setAcaoOpen(false);
          setNovaAcao({ methodology: "", expectedDate: "" });
        },
        onError: (e) => toast.error("Erro ao registrar", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">
            {dossie.employee.nome.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div>{dossie.employee.nome}</div>
            <div className="text-[11px] font-normal text-muted-foreground">
              {dossie.employee.jobPositionNome ?? "Sem cargo"}
            </div>
          </div>
        </DialogTitle>
      </DialogHeader>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <IdCard className="h-3 w-3" /> Setor
            </div>
            <div className="mt-1 text-xs text-foreground/85">{dossie.employee.setor || "—"}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <GraduationCap className="h-3 w-3" /> Situação de competência
            </div>
            <div className="mt-1 text-xs text-foreground/85">
              {
                SITUATION_OPTIONS.find((o) => o.value === dossie.employee.situacaoCompetencia)
                  ?.label
              }
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ações de competência
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAcaoOpen(true)}
              className="h-6 rounded-md text-[10px] text-brand"
            >
              <Plus className="mr-1 h-3 w-3" /> Nova
            </Button>
          </div>
          <div className="space-y-1">
            {dossie.competencyActions.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-xs"
              >
                <span className="text-foreground/85">
                  {/* Item 2 do Bloco 4: concluída mostra a data REALIZADA
                      (completionDate), não a prevista congelada para
                      sempre — antes ficava mostrando "prev." mesmo depois
                      de a ação já ter acontecido. */}
                  {a.methodology} ·{" "}
                  {a.status === "concluida" && a.completionDate
                    ? `real. ${new Date(a.completionDate + "T00:00:00").toLocaleDateString("pt-BR")}`
                    : `prev. ${new Date(a.expectedDate + "T00:00:00").toLocaleDateString("pt-BR")}`}
                </span>
                {a.status === "concluida" ? (
                  <Badge
                    variant="outline"
                    className="rounded-md border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[10px] text-[color:var(--success)]"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Concluída
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => completeAction.mutate({ id: a.id, employeeId })}
                    className="h-6 rounded-md text-[10px]"
                  >
                    Concluir
                  </Button>
                )}
              </div>
            ))}
            {dossie.competencyActions.length === 0 && (
              <p className="text-[11px] text-muted-foreground">Nenhuma ação de competência.</p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Anexos do dossiê
            </div>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <Select value={category} onValueChange={(v) => setCategory(v as AttachmentCategory)}>
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTACHMENT_CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-[11px] text-muted-foreground hover:border-brand/40 hover:text-brand">
              <Upload className="h-3.5 w-3.5" /> Enviar arquivo
              <input type="file" className="hidden" onChange={handleFile} />
            </label>
          </div>
          <div className="space-y-1">
            {dossie.attachments.map((a) => (
              <button
                key={a.id}
                onClick={() => abrirAnexo(a.filePath)}
                className="flex w-full items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-left text-xs hover:border-brand/40"
              >
                <span className="flex items-center gap-1.5 text-foreground/85">
                  <FileText className="h-3.5 w-3.5 text-brand" />
                  {ATTACHMENT_CATEGORY_OPTIONS.find((o) => o.value === a.category)?.label}
                  {a.category === "aso" && (
                    <ShieldCheck className="h-3 w-3 text-[color:var(--success)]" />
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(a.uploadedAt).toLocaleDateString("pt-BR")}
                  {a.source === "acao_competencia" && " · via ação de competência"}
                </span>
              </button>
            ))}
            {dossie.attachments.length === 0 && (
              <p className="text-[11px] text-muted-foreground">Nenhum anexo.</p>
            )}
          </div>
        </div>

        {/* Aditivo ao Bloco 4 — Avaliação de Eficácia do Treinamento, item
            1b: "resultado deve ficar salvo no dossiê do empregado". Fica no
            mesmo lugar visual dos anexos, mas em tabela própria — é texto
            estruturado (método + resultado), não arquivo, então não força
            employee_attachments (que exige upload). */}
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Avaliações de eficácia de treinamento
          </div>
          <div className="space-y-1">
            {dossie.effectivenessEvaluations.map((ev) => (
              <div
                key={ev.sessionId}
                className="rounded-md border border-border/60 px-3 py-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground/85">{ev.trainingNome}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(ev.avaliadoEm).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{ev.resultado}</p>
              </div>
            ))}
            {dossie.effectivenessEvaluations.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Nenhuma avaliação de eficácia registrada.
              </p>
            )}
          </div>
        </div>
      </div>

      <Dialog open={acaoOpen} onOpenChange={setAcaoOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova ação de competência</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Metodologia</label>
              <Textarea
                value={novaAcao.methodology}
                onChange={(e) => setNovaAcao({ ...novaAcao, methodology: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Data prevista</label>
              <Input
                type="date"
                value={novaAcao.expectedDate}
                onChange={(e) => setNovaAcao({ ...novaAcao, expectedDate: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcaoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarAcao} className="bg-brand text-white hover:bg-brand/90">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SelfServiceView({ employee }: { employee: Employee }) {
  const { data: signature } = useLatestAwarenessTermSignature(employee.id);
  const signTerm = useSignAwarenessTerm();

  const needsSignature = !signature || new Date(signature.validUntil) < new Date();

  return (
    <AppShell>
      <div className="mx-auto max-w-[700px] space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Meu Registro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão individual — só você vê estes dados.
          </p>
        </header>

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="space-y-3 p-6">
            <div className="text-lg font-semibold text-foreground">{employee.nome}</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Cargo:</span>{" "}
                {employee.jobPositionNome ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Setor:</span> {employee.setor || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Situação de competência:</span>{" "}
                {SITUATION_OPTIONS.find((o) => o.value === employee.situacaoCompetencia)?.label}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "rounded-2xl shadow-sm",
            needsSignature
              ? "border-[color:var(--warning)]/50 bg-[color:var(--warning)]/5"
              : "border-border/80",
          )}
        >
          <CardContent className="space-y-3 p-6">
            <div className="text-sm font-semibold text-foreground">Termo de Ciência</div>
            <p className="whitespace-pre-line text-xs leading-relaxed text-foreground/80">
              {TERMO_CIENCIA_TEXTO}
            </p>
            {signature && !needsSignature && (
              <p className="text-[11px] text-muted-foreground">
                Assinado em {new Date(signature.signedAt).toLocaleDateString("pt-BR")} · válido até{" "}
                {new Date(signature.validUntil + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
            {needsSignature && (
              <Button
                size="sm"
                onClick={() =>
                  signTerm.mutate(
                    { employeeId: employee.id, contentSnapshot: TERMO_CIENCIA_TEXTO },
                    {
                      onSuccess: () => toast.success("Termo assinado"),
                      onError: (e) =>
                        toast.error("Erro ao assinar", { description: getErrorMessage(e) }),
                    },
                  )
                }
                className="rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                Assinar Termo de Ciência
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
