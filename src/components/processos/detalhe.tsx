import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowLeft,
  Pencil,
  Archive,
  ArchiveRestore,
  UserPlus,
  X,
  Lock,
  Cog,
  CheckCircle2,
  History,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useEmployees } from "@/lib/queries/pessoas";
import { PROCESS_MAP_ICONS } from "@/components/processos/icon-map";
import { ProcessFlowEditor } from "@/components/processos/flow/editor";
import { ProcessRaciTable } from "@/components/processos/raci-table";
import {
  useProcessMap,
  useUpdateProcessMap,
  useSetProcessMapActive,
  useProcessMapCollaborators,
  useAddProcessMapCollaborator,
  useRemoveProcessMapCollaborator,
  useProcessMapDraft,
  useCreateProcessMapDraft,
  useFormalizeProcessMapVersion,
  useProcessMapVersions,
  PROCESS_MAP_ICON_OPTIONS,
  type ProcessMapIcon,
  type ProcessMapInput,
} from "@/lib/queries/processos";

const TABS = [
  { key: "informacoes", label: "Informações" },
  { key: "fluxo", label: "Fluxo" },
  { key: "raci", label: "RACI" },
  { key: "indicadores", label: "Indicadores", bloco: "D" },
  { key: "versoes", label: "Versões" },
] as const;

export function ProcessoDetailPage() {
  const { id } = useParams({ from: "/processos/$id" });
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const canManage =
    currentOrg?.role === "admin" ||
    currentOrg?.role === "quality_manager" ||
    currentOrg?.role === "area_manager";
  const canArchive = currentOrg?.role === "admin";
  // "Aprovar" (formalizar o fluxo) é mais restrito que "Editar" —
  // area_manager edita rascunho, mas não formaliza (matriz do Bloco A).
  const canFormalize = currentOrg?.role === "admin" || currentOrg?.role === "quality_manager";

  const { data: processo, isLoading } = useProcessMap(id);
  const { data: colaboradores = [] } = useProcessMapCollaborators(id);
  const { data: employees = [] } = useEmployees();
  const updateProcessMap = useUpdateProcessMap();
  const setActive = useSetProcessMapActive();
  const addCollaborator = useAddProcessMapCollaborator();
  const removeCollaborator = useRemoveProcessMapCollaborator();

  const { data: draft, isLoading: draftLoading } = useProcessMapDraft(id);
  const createDraft = useCreateProcessMapDraft();
  const formalizeVersion = useFormalizeProcessMapVersion();
  const { data: versions = [] } = useProcessMapVersions(id);

  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("informacoes");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ProcessMapInput | null>(null);
  const [arquivarOpen, setArquivarOpen] = useState(false);
  const [formalizarOpen, setFormalizarOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const [novoColaboradorId, setNovoColaboradorId] = useState("");

  if (isLoading || !processo) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Carregando…
        </div>
      </AppShell>
    );
  }

  const Icon = PROCESS_MAP_ICONS[processo.icon] ?? Cog;

  const abrirEditar = () => {
    setForm({
      code: processo.code,
      name: processo.name,
      description: processo.description,
      entradas: processo.entradas,
      saidas: processo.saidas,
      icon: processo.icon,
      ownerEmployeeId: processo.ownerEmployeeId,
    });
    setEditOpen(true);
  };

  const salvarEdicao = () => {
    if (!form) return;
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Preencha a sigla e o nome do processo");
      return;
    }
    updateProcessMap.mutate(
      { id: processo.id, ...form },
      {
        onSuccess: () => {
          toast.success("Processo atualizado");
          setEditOpen(false);
        },
        onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }),
      },
    );
  };

  const confirmarArquivar = () => {
    setActive.mutate(
      { id: processo.id, isActive: !processo.isActive },
      {
        onSuccess: () => {
          toast.success(processo.isActive ? "Processo arquivado" : "Processo reativado");
          setArquivarOpen(false);
        },
        onError: (e) => toast.error("Erro", { description: getErrorMessage(e) }),
      },
    );
  };

  const colaboradoresDisponiveis = employees.filter(
    (e) => e.id !== processo.ownerEmployeeId && !colaboradores.some((c) => c.employeeId === e.id),
  );

  const adicionarColaborador = () => {
    if (!novoColaboradorId) return;
    addCollaborator.mutate(
      { processMapId: processo.id, employeeId: novoColaboradorId },
      {
        onSuccess: () => setNovoColaboradorId(""),
        onError: (e) => toast.error("Erro ao adicionar", { description: getErrorMessage(e) }),
      },
    );
  };

  const criarRascunho = () => {
    createDraft.mutate(
      { processMapId: processo.id },
      {
        onError: (e) => toast.error("Erro ao criar rascunho", { description: getErrorMessage(e) }),
      },
    );
  };

  const confirmarFormalizar = () => {
    if (!draft) return;
    if (!versionLabel.trim()) {
      toast.error("Dê um rótulo pra esta versão (ex.: v1, Revisão 2026-09)");
      return;
    }
    formalizeVersion.mutate(
      { versionId: draft.id, processMapId: processo.id, versionLabel: versionLabel.trim() },
      {
        onSuccess: () => {
          toast.success("Fluxo formalizado");
          setFormalizarOpen(false);
          setVersionLabel("");
        },
        onError: (e) => toast.error("Erro ao formalizar", { description: getErrorMessage(e) }),
      },
    );
  };

  const viewingVersion = versions.find((v) => v.id === viewingVersionId) ?? null;
  // RACI segue a mesma versão que a aba Fluxo edita — o rascunho aberto,
  // ou (sem rascunho) a última formalizada, só leitura.
  const raciVersion = draft ?? versions[0] ?? null;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate({ to: "/processos" })}
              className="h-9 w-9 rounded-lg p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {processo.name}
                </h1>
                <Badge variant="outline" className="rounded-full text-[10px] font-semibold">
                  {processo.code}
                </Badge>
                {!processo.isActive && (
                  <Badge variant="outline" className="rounded-md text-[10px] text-muted-foreground">
                    Arquivado
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Dono: {processo.ownerName ?? "Não definido"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {canManage && (
              <Button size="sm" variant="outline" onClick={abrirEditar} className="rounded-lg">
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
              </Button>
            )}
            {canArchive && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setArquivarOpen(true)}
                className="rounded-lg"
              >
                {processo.isActive ? (
                  <>
                    <Archive className="mr-1.5 h-3.5 w-3.5" /> Arquivar
                  </>
                ) : (
                  <>
                    <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> Reativar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border/70 bg-muted/30 p-1">
          {TABS.map((t) => {
            const disabled = "bloco" in t;
            return (
              <button
                key={t.key}
                disabled={disabled}
                onClick={() => !disabled && setTab(t.key)}
                title={disabled ? `Chega no Bloco ${t.bloco} do Mapa de Processos` : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                  disabled
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : tab === t.key
                      ? "bg-white text-brand shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                )}
              >
                {disabled && <Lock className="h-3 w-3" />}
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "informacoes" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <Card className="rounded-2xl border-border/80 shadow-sm">
                <CardContent className="grid grid-cols-2 gap-4 p-5">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Entradas
                    </div>
                    <p className="mt-1 text-sm text-foreground/85">
                      {processo.entradas || "Não informado"}
                    </p>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Saídas
                    </div>
                    <p className="mt-1 text-sm text-foreground/85">
                      {processo.saidas || "Não informado"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              {processo.description && (
                <Card className="rounded-2xl border-border/80 shadow-sm">
                  <CardContent className="p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Descrição
                    </div>
                    <p className="mt-1 text-sm text-foreground/85">{processo.description}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="rounded-2xl border-border/80 shadow-sm">
              <CardContent className="p-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Colaboradores ({colaboradores.length})
                </div>
                <div className="space-y-1.5">
                  {colaboradores.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-md border border-border/60 px-2.5 py-1.5 text-xs"
                    >
                      <span className="text-foreground/85">{c.employeeNome}</span>
                      {canManage && (
                        <button
                          onClick={() =>
                            removeCollaborator.mutate({ id: c.id, processMapId: processo.id })
                          }
                          className="text-muted-foreground hover:text-[color:var(--severity-critical)]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {colaboradores.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Nenhum colaborador vinculado.
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="mt-3 flex gap-1.5">
                    <Select value={novoColaboradorId} onValueChange={setNovoColaboradorId}>
                      <SelectTrigger className="h-8 flex-1 text-xs">
                        <SelectValue placeholder="Selecione…" />
                      </SelectTrigger>
                      <SelectContent>
                        {colaboradoresDisponiveis.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!novoColaboradorId || addCollaborator.isPending}
                      onClick={adicionarColaborador}
                      className="h-8 rounded-md px-2"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "fluxo" && (
          <div className="space-y-3">
            {draftLoading && (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Carregando…
              </div>
            )}
            {!draftLoading && !draft && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-14 text-center">
                <p className="max-w-sm text-xs text-muted-foreground">
                  {versions.length === 0
                    ? "Nenhum rascunho de fluxo ainda. Monte o diagrama do zero — raias, tarefas, decisões — e formalize quando estiver pronto."
                    : "A última versão já foi formalizada (somente leitura). Continue a partir dela numa revisão nova."}
                </p>
                {canManage && (
                  <Button
                    onClick={criarRascunho}
                    disabled={createDraft.isPending}
                    className="rounded-lg bg-brand text-white hover:bg-brand/90"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />{" "}
                    {versions.length === 0 ? "Começar o fluxo" : "Criar nova revisão"}
                  </Button>
                )}
              </div>
            )}
            {draft && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Rascunho — v{draft.versionNumber}. Salvo automaticamente enquanto você edita.
                  </p>
                  {canFormalize && (
                    <Button
                      size="sm"
                      onClick={() => setFormalizarOpen(true)}
                      className="rounded-lg bg-brand text-white hover:bg-brand/90"
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Formalizar versão
                    </Button>
                  )}
                </div>
                <ProcessFlowEditor
                  processMapId={processo.id}
                  version={draft}
                  readOnly={!canManage}
                />
              </>
            )}
          </div>
        )}

        {tab === "raci" && (
          <div className="space-y-3">
            {!raciVersion && (
              <div className="rounded-2xl border border-dashed border-border p-14 text-center text-xs text-muted-foreground">
                Nenhum fluxo ainda — comece na aba Fluxo antes de atribuir RACI.
              </div>
            )}
            {raciVersion && (
              <>
                <p className="text-xs text-muted-foreground">
                  {raciVersion.status === "rascunho"
                    ? `Rascunho — v${raciVersion.versionNumber}.`
                    : `v${raciVersion.versionNumber}${raciVersion.versionLabel ? ` — ${raciVersion.versionLabel}` : ""} (formalizada, somente leitura).`}
                </p>
                <ProcessRaciTable
                  version={raciVersion}
                  readOnly={!canManage || raciVersion.status === "formalizada"}
                />
              </>
            )}
          </div>
        )}

        {tab === "versoes" && (
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardContent className="p-4">
              <div className="space-y-1.5">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setViewingVersionId(v.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 text-left text-xs hover:border-brand/40"
                  >
                    <div className="flex items-center gap-2">
                      <History className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground/85">
                        v{v.versionNumber}
                        {v.versionLabel ? ` — ${v.versionLabel}` : ""}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-md text-[10px]",
                        v.status === "formalizada"
                          ? "border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]"
                          : "text-muted-foreground",
                      )}
                    >
                      {v.status === "formalizada" ? "Formalizada" : "Rascunho"}
                    </Badge>
                  </button>
                ))}
                {versions.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Nenhuma versão ainda — comece o fluxo na aba Fluxo.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!viewingVersionId} onOpenChange={(o) => !o && setViewingVersionId(null)}>
        <DialogContent className="max-w-[95vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {viewingVersion
                ? `v${viewingVersion.versionNumber}${viewingVersion.versionLabel ? ` — ${viewingVersion.versionLabel}` : ""}`
                : ""}
            </DialogTitle>
            <DialogDescription>
              {viewingVersion?.status === "rascunho"
                ? "Rascunho atual — edite na aba Fluxo."
                : "Versão formalizada — somente leitura."}
            </DialogDescription>
          </DialogHeader>
          {viewingVersion && (
            <ProcessFlowEditor
              processMapId={processo.id}
              version={viewingVersion}
              readOnly={viewingVersion.status === "formalizada"}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={formalizarOpen} onOpenChange={setFormalizarOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Formalizar versão do fluxo</DialogTitle>
            <DialogDescription>
              A versão atual vira somente leitura permanentemente. Continue editando depois de
              formalizar cria uma nova versão.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium">Rótulo da versão</label>
            <Input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="v1, Revisão 2026-09…"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormalizarOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarFormalizar}
              disabled={formalizeVersion.isPending}
              className="bg-brand text-white hover:bg-brand/90"
            >
              Formalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar processo</DialogTitle>
          </DialogHeader>
          {form && (
            <>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-[100px_1fr] gap-3">
                  <div>
                    <label className="text-xs font-medium">Sigla</label>
                    <Input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      maxLength={6}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Nome do processo</label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">Ícone</label>
                  <Select
                    value={form.icon}
                    onValueChange={(v) => setForm({ ...form, icon: v as ProcessMapIcon })}
                  >
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCESS_MAP_ICON_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">Dono do processo</label>
                  <Select
                    value={form.ownerEmployeeId ?? undefined}
                    onValueChange={(v) => setForm({ ...form, ownerEmployeeId: v })}
                  >
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <SelectValue placeholder="Selecione em Cargos e Perfis" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Entradas</label>
                    <Textarea
                      value={form.entradas}
                      onChange={(e) => setForm({ ...form, entradas: e.target.value })}
                      className="mt-1 min-h-[70px] text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Saídas</label>
                    <Textarea
                      value={form.saidas}
                      onChange={(e) => setForm({ ...form, saidas: e.target.value })}
                      className="mt-1 min-h-[70px] text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">Descrição (opcional)</label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={salvarEdicao}
                  disabled={updateProcessMap.isPending}
                  className="bg-brand text-white hover:bg-brand/90"
                >
                  Salvar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={arquivarOpen} onOpenChange={setArquivarOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {processo.isActive ? "Arquivar processo" : "Reativar processo"}
            </DialogTitle>
            <DialogDescription>
              {processo.isActive
                ? "O processo sai da lista principal, mas nada é apagado — pode ser reativado depois."
                : "O processo volta a aparecer na lista principal."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArquivarOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarArquivar}
              disabled={setActive.isPending}
              className="bg-brand text-white hover:bg-brand/90"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
