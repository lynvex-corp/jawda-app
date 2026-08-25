import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
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
  AlertTriangle,
  FileText,
  Upload,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  useJobPositions,
  useCreateJobPosition,
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
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
  const isHrAuthorized = currentOrg?.role === "admin" || currentOrg?.role === "quality_manager";
  const isAdmin = currentOrg?.role === "admin";
  const { data: myRecord, isLoading: myRecordLoading } = useMyEmployeeRecord();

  if (!isHrAuthorized) {
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
            Cargos e Perfis é visível apenas para Administrador do Cliente, Gestor da Qualidade, ou
            o próprio colaborador (vendo o próprio registro).
          </p>
        </div>
      </AppShell>
    );
  }

  return <HrView isAdmin={isAdmin} />;
}

function HrView({ isAdmin }: { isAdmin: boolean }) {
  const { data: positions = [] } = useJobPositions();
  const { data: employees = [], isLoading } = useEmployees();
  const createPosition = useCreateJobPosition();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();

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

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Cargos e Perfis
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Descrições de cargo, competências e colaboradores associados.
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

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-border/70 px-5 py-3 text-sm font-semibold text-foreground">
              Cargos
            </div>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <TableHead>Cargo</TableHead>
                  <TableHead>Requisitos técnicos</TableHead>
                  <TableHead>Requisitos desejáveis</TableHead>
                  <TableHead>Treinamentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((p) => (
                  <TableRow key={p.id} className="align-top text-xs">
                    <TableCell className="font-semibold text-foreground">{p.nome}</TableCell>
                    <TableCell className="max-w-[220px] text-foreground/80">
                      {p.requisitosTecnicos}
                    </TableCell>
                    <TableCell className="max-w-[220px] text-foreground/80">
                      {p.requisitosDesejaveis}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.trainings.map((t) => (
                          <Badge key={t.id} variant="outline" className="rounded-md text-[10px]">
                            {t.trainingName}
                            {!t.isRequired && " (opcional)"}
                          </Badge>
                        ))}
                        {p.trainings.length === 0 && (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {positions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
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

        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-border/70 px-5 py-3 text-sm font-semibold text-foreground">
              Pessoas
            </div>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Situação de competência</TableHead>
                  <TableHead>Pendência</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isLoading && employees.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 6 : 5}
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
                      {e.hasOpenCompetencyAction ? (
                        <Badge
                          variant="outline"
                          className="rounded-md border-[color:var(--severity-high)]/40 bg-[color:var(--severity-high)]/10 text-[10px] text-[color:var(--severity-high)]"
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" /> Ação de competência aberta
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {isAdmin && (
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
              <Select
                value={novaPessoa.jobPositionId}
                onValueChange={(v) => setNovaPessoa({ ...novaPessoa, jobPositionId: v })}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Editar pessoa (admin) */}
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
    </AppShell>
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
          <Select
            value={form.jobPositionId}
            onValueChange={(v) => setForm({ ...form, jobPositionId: v })}
          >
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  {a.methodology} · prev.{" "}
                  {new Date(a.expectedDate + "T00:00:00").toLocaleDateString("pt-BR")}
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
