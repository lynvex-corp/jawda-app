import { useMemo, useState } from "react";
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
  CheckCircle2,
  Users,
  TrendingUp,
  Plus,
  Megaphone,
  HelpCircle,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useJobPositions } from "@/lib/queries/pessoas";
import {
  useTrainings,
  useCreateTraining,
  useTrainingApplicability,
  useSetTrainingApplicability,
  useTrainingSessions,
  useCreateTrainingSession,
  useTrainingSessionParticipants,
  useUpdateTrainingParticipant,
  useEmployees,
  useMyEmployeeRecord,
  useAwarenessPublications,
  useCreateAwarenessPublication,
  useAcknowledgeAwarenessPublication,
  MODALITY_OPTIONS,
  type TrainingModality,
  type AwarenessPublicationType,
} from "@/lib/queries/pessoas";

export function AprendizagemPage() {
  const { currentOrg } = useAuth();
  const isHrAuthorized = currentOrg?.role === "admin" || currentOrg?.role === "quality_manager";
  const [tab, setTab] = useState<"matriz" | "execucao" | "conscientizacao">("matriz");

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Gestão de Aprendizagem
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Matriz de treinamentos por cargo — requisito 7.2.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
            {(["matriz", "execucao", "conscientizacao"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition",
                  tab === t
                    ? "bg-white text-brand shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "matriz" ? "Matriz" : t === "execucao" ? "Execução" : "Conscientização"}
              </button>
            ))}
          </div>
        </header>

        {tab === "matriz" && <MatrizTab isHrAuthorized={isHrAuthorized} />}
        {tab === "execucao" && <ExecucaoTab isHrAuthorized={isHrAuthorized} />}
        {tab === "conscientizacao" && <ConscientizacaoTab isHrAuthorized={isHrAuthorized} />}
      </div>
    </AppShell>
  );
}

function MatrizTab({ isHrAuthorized }: { isHrAuthorized: boolean }) {
  const { data: trainings = [] } = useTrainings();
  const { data: positions = [] } = useJobPositions();
  const { data: applicability = [] } = useTrainingApplicability();
  const { data: employees = [] } = useEmployees();
  const setApplicability = useSetTrainingApplicability();
  const createTraining = useCreateTraining();

  const [novoOpen, setNovoOpen] = useState(false);
  const [novo, setNovo] = useState({
    nome: "",
    cargaHoraria: "",
    instrutorFornecedor: "",
    modalidade: "interno" as TrainingModality,
  });
  const [peopleFor, setPeopleFor] = useState<string | null>(null);

  const applicableSet = useMemo(
    () => new Set(applicability.map((a) => `${a.trainingId}:${a.jobPositionId}`)),
    [applicability],
  );

  const toggle = (trainingId: string, jobPositionId: string) => {
    if (!isHrAuthorized) return;
    const applicable = applicableSet.has(`${trainingId}:${jobPositionId}`);
    setApplicability.mutate({ trainingId, jobPositionId, applicable: !applicable });
  };

  const salvarTreinamento = () => {
    if (!novo.nome.trim()) {
      toast.error("Informe o nome do treinamento");
      return;
    }
    createTraining.mutate(
      {
        nome: novo.nome,
        cargaHoraria: novo.cargaHoraria ? Number(novo.cargaHoraria) : null,
        instrutorFornecedor: novo.instrutorFornecedor,
        modalidade: novo.modalidade,
      },
      {
        onSuccess: () => {
          toast.success("Treinamento cadastrado");
          setNovoOpen(false);
          setNovo({ nome: "", cargaHoraria: "", instrutorFornecedor: "", modalidade: "interno" });
        },
        onError: (e) => toast.error("Erro ao cadastrar", { description: getErrorMessage(e) }),
      },
    );
  };

  const peopleForPosition = peopleFor ? employees.filter((e) => e.jobPositionId === peopleFor) : [];

  return (
    <>
      {isHrAuthorized && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => setNovoOpen(true)}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Novo treinamento
          </Button>
        </div>
      )}
      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40">
                  <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Cargo
                  </th>
                  {trainings.map((t) => (
                    <th
                      key={t.id}
                      className="px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground"
                    >
                      <div className="mx-auto max-w-[90px] leading-tight">{t.nome}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="sticky left-0 z-10 flex items-center gap-1.5 bg-card px-3 py-2 font-medium text-foreground">
                      {p.nome}
                      <button
                        onClick={() => setPeopleFor(p.id)}
                        title="Ver colaboradores"
                        className="text-muted-foreground hover:text-brand"
                      >
                        <Users className="h-3.5 w-3.5" />
                      </button>
                    </td>
                    {trainings.map((t) => {
                      const applicable = applicableSet.has(`${t.id}:${p.id}`);
                      return (
                        <td key={t.id} className="px-1 py-1 text-center">
                          <button
                            onClick={() => toggle(t.id, p.id)}
                            disabled={!isHrAuthorized}
                            className={cn(
                              "mx-auto flex h-7 w-full max-w-[60px] items-center justify-center rounded-md text-[10px] font-semibold transition",
                              applicable
                                ? "bg-brand text-white"
                                : "bg-muted text-muted-foreground/50",
                              isHrAuthorized && "hover:opacity-80",
                            )}
                          >
                            {applicable && <CheckCircle2 className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {positions.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground">
                      Cadastre cargos em Cargos e Perfis primeiro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Novo treinamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Nome</label>
              <Input
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Carga horária</label>
                <Input
                  type="number"
                  value={novo.cargaHoraria}
                  onChange={(e) => setNovo({ ...novo, cargaHoraria: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Modalidade</label>
                <Select
                  value={novo.modalidade}
                  onValueChange={(v) => setNovo({ ...novo, modalidade: v as TrainingModality })}
                >
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Instrutor/fornecedor</label>
              <Input
                value={novo.instrutorFornecedor}
                onChange={(e) => setNovo({ ...novo, instrutorFornecedor: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarTreinamento} className="bg-brand text-white hover:bg-brand/90">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!peopleFor} onOpenChange={(o) => !o && setPeopleFor(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Colaboradores neste cargo</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {peopleForPosition.map((e) => (
              <div key={e.id} className="rounded-md border border-border/60 px-3 py-1.5 text-xs">
                {e.nome}
              </div>
            ))}
            {peopleForPosition.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Ninguém ocupa este cargo ainda (ou você não tem acesso à lista de pessoas).
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExecucaoTab({ isHrAuthorized }: { isHrAuthorized: boolean }) {
  const { data: sessions = [] } = useTrainingSessions();
  const { data: trainings = [] } = useTrainings();
  const { data: employees = [] } = useEmployees();
  const createSession = useCreateTrainingSession();
  const [novoOpen, setNovoOpen] = useState(false);
  const [novo, setNovo] = useState({
    trainingId: "",
    dataPlanejada: "",
    employeeIds: [] as string[],
  });
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  const realizadas = sessions.filter((s) => s.status === "realizada").length;
  const taxaRealizacao = sessions.length > 0 ? Math.round((realizadas / sessions.length) * 100) : 0;

  const salvar = () => {
    if (!novo.trainingId || !novo.dataPlanejada) {
      toast.error("Selecione o treinamento e a data");
      return;
    }
    createSession.mutate(novo, {
      onSuccess: () => {
        toast.success("Turma programada");
        setNovoOpen(false);
        setNovo({ trainingId: "", dataPlanejada: "", employeeIds: [] });
      },
      onError: (e) => toast.error("Erro ao programar", { description: getErrorMessage(e) }),
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Turmas ({sessions.length})</h2>
            {isHrAuthorized && (
              <Button
                size="sm"
                onClick={() => setNovoOpen(true)}
                className="h-8 rounded-lg bg-brand text-[11px] text-white hover:bg-brand/90"
              >
                <Plus className="mr-1 h-3 w-3" /> Programar turma
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <TableHead>Treinamento</TableHead>
                <TableHead>Data prevista</TableHead>
                <TableHead>Participantes</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer text-xs"
                  onClick={() => setOpenSessionId(s.id)}
                >
                  <TableCell className="font-medium text-foreground">{s.trainingNome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(s.dataPlanejada + "T00:00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.participantCount}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-md text-[10px] capitalize">
                      {s.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                    Nenhuma turma programada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Card className="rounded-2xl border-brand/20 bg-brand-soft/40 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
              <TrendingUp className="h-3 w-3" /> Taxa de realização
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-brand">{taxaRealizacao}%</span>
              <span className="text-[11px] text-muted-foreground">
                {realizadas} de {sessions.length} turmas
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${taxaRealizacao}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Programar turma</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Treinamento</label>
              <Select
                value={novo.trainingId}
                onValueChange={(v) => setNovo({ ...novo, trainingId: v })}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {trainings.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Data planejada</label>
              <Input
                type="date"
                value={novo.dataPlanejada}
                onChange={(e) => setNovo({ ...novo, dataPlanejada: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Participantes</label>
              <div className="mt-1 max-h-[160px] space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
                {employees.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={novo.employeeIds.includes(e.id)}
                      onCheckedChange={() =>
                        setNovo((prev) => ({
                          ...prev,
                          employeeIds: prev.employeeIds.includes(e.id)
                            ? prev.employeeIds.filter((id) => id !== e.id)
                            : [...prev.employeeIds, e.id],
                        }))
                      }
                    />
                    {e.nome}
                  </label>
                ))}
                {employees.length === 0 && (
                  <p className="px-2 py-1 text-[11px] text-muted-foreground">
                    Nenhuma pessoa disponível — cadastre em Cargos e Perfis.
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} className="bg-brand text-white hover:bg-brand/90">
              Programar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openSessionId} onOpenChange={(o) => !o && setOpenSessionId(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          {openSessionId && <SessionParticipantsView sessionId={openSessionId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionParticipantsView({ sessionId }: { sessionId: string }) {
  const { data: participants = [] } = useTrainingSessionParticipants(sessionId);
  const updateParticipant = useUpdateTrainingParticipant();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Participantes</DialogTitle>
      </DialogHeader>
      <div className="space-y-1">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs"
          >
            <span className="font-medium text-foreground">{p.employeeNome}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Checkbox
                  checked={p.presente}
                  onCheckedChange={(c) =>
                    updateParticipant.mutate({
                      id: p.id,
                      sessionId,
                      patch: { presente: c === true },
                    })
                  }
                />
                Presente
              </label>
              <Select
                value={p.eficacia ?? undefined}
                onValueChange={(v) =>
                  updateParticipant.mutate({
                    id: p.id,
                    sessionId,
                    patch: { eficacia: v as "eficaz" | "nao_eficaz" },
                  })
                }
              >
                <SelectTrigger className="h-7 w-[110px] text-[10px]">
                  <SelectValue placeholder="Eficácia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eficaz">Eficaz</SelectItem>
                  <SelectItem value="nao_eficaz">Não eficaz</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        {participants.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum participante.</p>
        )}
      </div>
    </>
  );
}

function ConscientizacaoTab({ isHrAuthorized }: { isHrAuthorized: boolean }) {
  const { data: publications = [] } = useAwarenessPublications();
  const createPublication = useCreateAwarenessPublication();
  const [novoOpen, setNovoOpen] = useState(false);
  const [novo, setNovo] = useState({
    tipo: "informe" as AwarenessPublicationType,
    titulo: "",
    conteudo: "",
  });
  const [opcoes, setOpcoes] = useState<{ optionText: string; isCorrect: boolean }[]>([]);
  const [novaOpcao, setNovaOpcao] = useState("");
  const [quizOpen, setQuizOpen] = useState<string | null>(null);

  const salvar = () => {
    if (!novo.titulo.trim() || !novo.conteudo.trim()) {
      toast.error("Preencha título e conteúdo");
      return;
    }
    if (
      novo.tipo === "perguntas_respostas" &&
      (opcoes.length < 2 || !opcoes.some((o) => o.isCorrect))
    ) {
      toast.error("Adicione ao menos 2 opções e marque a correta");
      return;
    }
    createPublication.mutate(
      { ...novo, options: novo.tipo === "perguntas_respostas" ? opcoes : undefined },
      {
        onSuccess: () => {
          toast.success("Publicado");
          setNovoOpen(false);
          setNovo({ tipo: "informe", titulo: "", conteudo: "" });
          setOpcoes([]);
        },
        onError: (e) => toast.error("Erro ao publicar", { description: getErrorMessage(e) }),
      },
    );
  };

  const publicacaoQuiz = publications.find((p) => p.id === quizOpen);

  return (
    <>
      {isHrAuthorized && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => setNovoOpen(true)}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nova publicação
          </Button>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {publications.map((p) => (
          <Card key={p.id} className="rounded-2xl border-border/80 shadow-sm">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                {p.tipo === "informe" ? (
                  <Megaphone className="h-4 w-4 text-brand" />
                ) : (
                  <HelpCircle className="h-4 w-4 text-brand" />
                )}
                <Badge variant="outline" className="rounded-md text-[10px]">
                  {p.tipo === "informe" ? "Informe" : "Perguntas e Respostas"}
                </Badge>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {new Date(p.publishedAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="text-sm font-semibold text-foreground">{p.titulo}</div>
              <p className="line-clamp-3 text-xs text-foreground/80">{p.conteudo}</p>
              {p.tipo === "perguntas_respostas" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuizOpen(p.id)}
                  className="h-7 rounded-md text-[11px]"
                >
                  Responder quiz
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {publications.length === 0 && (
          <p className="col-span-2 rounded-xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
            Nenhuma publicação ainda.
          </p>
        )}
      </div>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova publicação</DialogTitle>
            <DialogDescription>Publicação imediata — sem fluxo de aprovação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium">Tipo</label>
              <Select
                value={novo.tipo}
                onValueChange={(v) => setNovo({ ...novo, tipo: v as AwarenessPublicationType })}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="informe">Informe</SelectItem>
                  <SelectItem value="perguntas_respostas">Perguntas e Respostas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Título</label>
              <Input
                value={novo.titulo}
                onChange={(e) => setNovo({ ...novo, titulo: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Conteúdo</label>
              <Textarea
                value={novo.conteudo}
                onChange={(e) => setNovo({ ...novo, conteudo: e.target.value })}
                className="mt-1"
              />
            </div>
            {novo.tipo === "perguntas_respostas" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Opções (até 3, uma correta)</label>
                {opcoes.map((o, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs"
                  >
                    <Checkbox
                      checked={o.isCorrect}
                      onCheckedChange={() =>
                        setOpcoes((prev) => prev.map((op, i) => ({ ...op, isCorrect: i === idx })))
                      }
                    />
                    <span className="flex-1">{o.optionText}</span>
                    <button onClick={() => setOpcoes((prev) => prev.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
                {opcoes.length < 3 && (
                  <div className="flex gap-2">
                    <Input
                      value={novaOpcao}
                      onChange={(e) => setNovaOpcao(e.target.value)}
                      placeholder="Nova opção"
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => {
                        if (!novaOpcao.trim()) return;
                        setOpcoes((prev) => [
                          ...prev,
                          { optionText: novaOpcao.trim(), isCorrect: prev.length === 0 },
                        ]);
                        setNovaOpcao("");
                      }}
                    >
                      Adicionar
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} className="bg-brand text-white hover:bg-brand/90">
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!quizOpen} onOpenChange={(o) => !o && setQuizOpen(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          {publicacaoQuiz && (
            <QuizView publication={publicacaoQuiz} onClose={() => setQuizOpen(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuizView({
  publication,
  onClose,
}: {
  publication: {
    id: string;
    titulo: string;
    conteudo: string;
    options: { id: string; optionText: string; isCorrect: boolean }[];
  };
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const { data: myRecord } = useMyEmployeeRecord();
  const acknowledge = useAcknowledgeAwarenessPublication();
  const correct = selected ? publication.options.find((o) => o.id === selected)?.isCorrect : null;

  const responder = (optionId: string) => {
    setSelected(optionId);
    if (myRecord) {
      acknowledge.mutate({ publicationId: publication.id, employeeId: myRecord.id });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{publication.titulo}</DialogTitle>
        <DialogDescription>{publication.conteudo}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        {publication.options.map((o) => (
          <button
            key={o.id}
            disabled={!!selected}
            onClick={() => responder(o.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
              selected === o.id &&
                o.isCorrect &&
                "border-[color:var(--success)] bg-[color:var(--success)]/10 scale-[1.02]",
              selected === o.id &&
                !o.isCorrect &&
                "border-[color:var(--severity-critical)] bg-[color:var(--severity-critical)]/10",
              selected && selected !== o.id && "opacity-50",
              !selected && "border-border/60 hover:border-brand/40",
            )}
          >
            {o.optionText}
            {selected === o.id && o.isCorrect && (
              <Sparkles className="h-4 w-4 text-[color:var(--success)]" />
            )}
          </button>
        ))}
      </div>
      {selected && (
        <p
          className={cn(
            "text-sm font-medium",
            correct ? "text-[color:var(--success)]" : "text-[color:var(--severity-critical)]",
          )}
        >
          {correct
            ? "Certinho! Ciência registrada."
            : "Resposta registrada — revise o conteúdo quando puder."}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </DialogFooter>
    </>
  );
}
