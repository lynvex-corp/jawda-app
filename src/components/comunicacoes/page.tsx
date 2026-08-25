import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users, Building2, Send, CheckCircle2, Zap, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useOrgMembers } from "@/lib/queries/action-plans";
import {
  COMMUNICATION_FORM_OPTIONS,
  TARGET_PROFILE_OPTIONS,
  labelForTargetProfile,
  useCommunicationProcesses,
  useCreateCommunicationProcess,
  useCommunications,
  useCreateCommunication,
  useCommunicationReads,
  useMyAcknowledgedCommunicationIds,
  useAcknowledgeCommunication,
  type CommunicationEntityType,
  type CommunicationForm,
  type CommunicationWhenType,
  type CommunicationProcess,
  type Communication,
} from "@/lib/queries/comunicacoes";

const whenLabel: Record<CommunicationWhenType, string> = {
  data_especifica: "Data específica",
  sob_demanda: "Sob demanda",
};

function ProfileBadges({ values }: { values: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <Badge key={v} variant="outline" className="rounded-md text-[10px]">
          {labelForTargetProfile(v)}
        </Badge>
      ))}
    </div>
  );
}

function TargetProfilePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (v: string) => {
    if (v === "todos") {
      onChange(value.includes("todos") ? [] : ["todos"]);
      return;
    }
    const withoutTodos = value.filter((x) => x !== "todos");
    onChange(withoutTodos.includes(v) ? withoutTodos.filter((x) => x !== v) : [...withoutTodos, v]);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {TARGET_PROFILE_OPTIONS.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => toggle(o.value)}
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] transition-colors",
            value.includes(o.value)
              ? "border-brand bg-brand-soft text-brand"
              : "border-border/60 text-muted-foreground hover:border-border",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ComunicacoesPage() {
  const { currentOrg } = useAuth();
  const isAuthorized = currentOrg?.role === "admin" || currentOrg?.role === "quality_manager";

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Comunicações</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Comunicação interna e externa do SG — requisito 7.4.
            </p>
          </div>
        </header>

        <Tabs defaultValue="processos">
          <TabsList className="rounded-lg bg-muted/60 p-1">
            <TabsTrigger value="processos" className="rounded-md text-xs">
              Processos de Comunicação
            </TabsTrigger>
            <TabsTrigger value="comunicacoes" className="rounded-md text-xs">
              Comunicações Enviadas
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="rounded-md text-xs">
              Minhas Notificações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="processos" className="mt-4">
            <ProcessosTab isAuthorized={isAuthorized} />
          </TabsContent>

          <TabsContent value="comunicacoes" className="mt-4">
            <ComunicacoesTab />
          </TabsContent>

          <TabsContent value="notificacoes" className="mt-4">
            <NotificacoesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function ProcessoCard({ p }: { p: CommunicationProcess }) {
  return (
    <Card className="rounded-xl border-border/70 shadow-sm">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-mono text-[11px] font-semibold text-brand">{p.code}</span>
            <div className="text-sm font-semibold text-foreground">{p.description}</div>
          </div>
          <Badge variant="outline" className="rounded-md text-[10px]">
            {whenLabel[p.whenType]}
            {p.whenType === "data_especifica" && p.scheduledDate
              ? ` · ${new Date(p.scheduledDate).toLocaleDateString("pt-BR")}`
              : ""}
          </Badge>
        </div>
        <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-muted/20 text-[11px]">
          <div className="grid grid-cols-[110px_1fr] gap-2 px-3 py-1.5">
            <span className="text-muted-foreground">Como</span>
            <span className="font-medium text-foreground/85">
              {COMMUNICATION_FORM_OPTIONS.find((o) => o.value === p.form)?.label}
            </span>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2 px-3 py-1.5">
            <span className="text-muted-foreground">Com quem</span>
            <span className="font-medium text-foreground/85">
              <ProfileBadges values={p.targetProfiles} />
            </span>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2 px-3 py-1.5">
            <span className="text-muted-foreground">Quem comunica</span>
            <span className="font-medium text-foreground/85">{p.communicatorName ?? "—"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProcessosTab({ isAuthorized }: { isAuthorized: boolean }) {
  const { data: processes = [] } = useCommunicationProcesses();
  const { data: members = [] } = useOrgMembers();
  const createProcess = useCreateCommunicationProcess();

  const internas = processes.filter((p) => p.type === "interna");
  const externas = processes.filter((p) => p.type === "externa");

  const [open, setOpen] = useState<CommunicationEntityType | null>(null);
  const [form, setForm] = useState({
    description: "",
    form_: "email" as CommunicationForm,
    communicatorId: "",
    whenType: "sob_demanda" as CommunicationWhenType,
    scheduledDate: "",
    targetProfiles: [] as string[],
  });

  const salvar = () => {
    if (!open || !form.description.trim()) {
      toast.error("Informe a descrição");
      return;
    }
    if (form.whenType === "data_especifica" && !form.scheduledDate) {
      toast.error("Informe a data para 'Data específica'");
      return;
    }
    createProcess.mutate(
      {
        type: open,
        description: form.description.trim(),
        form: form.form_,
        communicatorId: form.communicatorId || null,
        whenType: form.whenType,
        scheduledDate: form.whenType === "data_especifica" ? form.scheduledDate : null,
        targetProfiles: form.targetProfiles,
      },
      {
        onSuccess: () => {
          toast.success("Processo de comunicação registrado");
          setForm({
            description: "",
            form_: "email",
            communicatorId: "",
            whenType: "sob_demanda",
            scheduledDate: "",
            targetProfiles: [],
          });
          setOpen(null);
        },
        onError: (e) => toast.error("Erro ao registrar", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Users className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Comunicação Interna</h2>
            <Badge variant="outline" className="rounded-md text-[10px] text-muted-foreground">
              {internas.length} registros
            </Badge>
          </div>
          {isAuthorized && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-md"
              onClick={() => setOpen("interna")}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Novo
            </Button>
          )}
        </div>
        {internas.map((p) => (
          <ProcessoCard key={p.id} p={p} />
        ))}
        {internas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
            Nenhum processo de comunicação interna cadastrado.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Building2 className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Comunicação Externa</h2>
            <Badge variant="outline" className="rounded-md text-[10px] text-muted-foreground">
              {externas.length} registros
            </Badge>
          </div>
          {isAuthorized && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-md"
              onClick={() => setOpen("externa")}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Novo
            </Button>
          )}
        </div>
        {externas.map((p) => (
          <ProcessoCard key={p.id} p={p} />
        ))}
        {externas.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
            Nenhum processo de comunicação externa cadastrado.
          </p>
        )}
      </section>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              Novo processo de comunicação {open === "interna" ? "interna" : "externa"}
            </DialogTitle>
            <DialogDescription>
              O código ({open === "interna" ? "COM_INT" : "COM_EXT"}_NNN) é gerado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">O quê (descrição)</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-[60px] rounded-md text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Como</label>
                <Select
                  value={form.form_}
                  onValueChange={(v) => setForm({ ...form, form_: v as CommunicationForm })}
                >
                  <SelectTrigger className="rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMUNICATION_FORM_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Quem comunica</label>
                <Select
                  value={form.communicatorId}
                  onValueChange={(v) => setForm({ ...form, communicatorId: v })}
                >
                  <SelectTrigger className="rounded-md">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...members]
                      .sort((a, b) => a.fullName.localeCompare(b.fullName))
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fullName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Quando</label>
                <Select
                  value={form.whenType}
                  onValueChange={(v) => setForm({ ...form, whenType: v as CommunicationWhenType })}
                >
                  <SelectTrigger className="rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="data_especifica">Data específica</SelectItem>
                    <SelectItem value="sob_demanda">Sob demanda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.whenType === "data_especifica" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Data</label>
                  <Input
                    type="date"
                    value={form.scheduledDate}
                    onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                    className="rounded-md"
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Com quem</label>
              <TargetProfilePicker
                value={form.targetProfiles}
                onChange={(v) => setForm({ ...form, targetProfiles: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancelar
            </Button>
            <Button onClick={salvar} className="bg-brand text-white hover:bg-brand/90">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComunicacaoRow({ c }: { c: Communication }) {
  const [expanded, setExpanded] = useState(false);
  const { data: reads = [] } = useCommunicationReads(expanded ? c.id : null);
  const lidos = reads.filter((r) => r.acknowledgedAt).length;

  return (
    <Card className="rounded-xl border-border/70 shadow-sm">
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
              {c.isImmediate ? <Zap className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">{c.description}</div>
              <div className="text-[11px] text-muted-foreground">
                {c.communicatorName ?? "—"} ·{" "}
                {c.isImmediate
                  ? `enviada em ${c.sentAt ? new Date(c.sentAt).toLocaleString("pt-BR") : "—"}`
                  : `agendada para ${
                      c.scheduledDatetime
                        ? new Date(c.scheduledDatetime).toLocaleString("pt-BR")
                        : "—"
                    }`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProfileBadges values={c.targetProfiles} />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 rounded-md px-2 text-[11px]"
              onClick={() => setExpanded(!expanded)}
            >
              Quem leu{" "}
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
              />
            </Button>
          </div>
        </div>
        {c.externalName && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Destinatário externo: </span>
            {c.externalName}
            {c.externalEmails && c.externalEmails.length > 0
              ? ` (${c.externalEmails.join(", ")})`
              : ""}
          </p>
        )}
        {expanded && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px]">
            <div className="mb-1 font-medium text-foreground/80">
              {lidos} confirmação(ões) de ciência
            </div>
            {reads.length === 0 && (
              <p className="text-muted-foreground">Ninguém confirmou ainda.</p>
            )}
            {reads.map((r) => (
              <div key={r.recipientUserId} className="flex items-center justify-between py-0.5">
                <span>{r.recipientName ?? "Usuário"}</span>
                <span className="text-muted-foreground">
                  {r.acknowledgedAt
                    ? new Date(r.acknowledgedAt).toLocaleString("pt-BR")
                    : "pendente"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComunicacoesTab() {
  const { currentOrg } = useAuth();
  const isAuthorized = currentOrg?.role === "admin" || currentOrg?.role === "quality_manager";
  const { data: communications = [] } = useCommunications();
  const { data: processes = [] } = useCommunicationProcesses();
  const createCommunication = useCreateCommunication();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    communicationProcessId: "",
    type: "interna" as CommunicationEntityType,
    description: "",
    isImmediate: false,
    scheduledDatetime: "",
    externalName: "",
    externalEmails: "",
    targetProfiles: [] as string[],
  });

  const salvar = () => {
    if (!form.description.trim()) {
      toast.error("Informe a descrição da comunicação");
      return;
    }
    if (!form.isImmediate && !form.scheduledDatetime) {
      toast.error("Informe data e hora, ou marque como imediata");
      return;
    }
    if (!form.isImmediate && form.scheduledDatetime) {
      const hour = new Date(form.scheduledDatetime).getHours();
      if (hour < 8 || hour >= 18) {
        toast.error("Agendamento limitado ao horário comercial (08h–18h)");
        return;
      }
    }
    createCommunication.mutate(
      {
        communicationProcessId: form.communicationProcessId || null,
        type: form.type,
        description: form.description.trim(),
        isImmediate: form.isImmediate,
        scheduledDatetime: form.scheduledDatetime
          ? new Date(form.scheduledDatetime).toISOString()
          : null,
        externalName: form.type === "externa" && form.externalName ? form.externalName : null,
        externalEmails:
          form.type === "externa" && form.externalEmails
            ? form.externalEmails
                .split(",")
                .map((e) => e.trim())
                .filter(Boolean)
            : null,
        targetProfiles: form.targetProfiles,
      },
      {
        onSuccess: () => {
          toast.success(form.isImmediate ? "Comunicação enviada" : "Comunicação agendada");
          setForm({
            communicationProcessId: "",
            type: "interna",
            description: "",
            isImmediate: false,
            scheduledDatetime: "",
            externalName: "",
            externalEmails: "",
            targetProfiles: [],
          });
          setOpen(false);
        },
        onError: (e) =>
          toast.error("Erro ao enviar comunicação", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {isAuthorized && (
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nova comunicação
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {communications.map((c) => (
          <ComunicacaoRow key={c.id} c={c} />
        ))}
        {communications.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
            Nenhuma comunicação enviada ainda.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova comunicação</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Tipo</label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as CommunicationEntityType })}
                >
                  <SelectTrigger className="rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interna">Interna</SelectItem>
                    <SelectItem value="externa">Externa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Processo (opcional)</label>
                <Select
                  value={form.communicationProcessId}
                  onValueChange={(v) => setForm({ ...form, communicationProcessId: v })}
                >
                  <SelectTrigger className="rounded-md">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    {processes
                      .filter((p) => p.type === form.type)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} — {p.description}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Descrição</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-[60px] rounded-md text-sm"
              />
            </div>
            {form.type === "externa" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Destinatário externo</label>
                  <Input
                    value={form.externalName}
                    onChange={(e) => setForm({ ...form, externalName: e.target.value })}
                    className="rounded-md"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">E-mails (separados por vírgula)</label>
                  <Input
                    value={form.externalEmails}
                    onChange={(e) => setForm({ ...form, externalEmails: e.target.value })}
                    className="rounded-md"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Com quem (perfis internos)</label>
              <TargetProfilePicker
                value={form.targetProfiles}
                onChange={(v) => setForm({ ...form, targetProfiles: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <div className="text-xs font-medium text-foreground">Comunicação Imediata</div>
                <p className="text-[11px] text-muted-foreground">
                  Envia agora e ignora o agendamento abaixo.
                </p>
              </div>
              <Switch
                checked={form.isImmediate}
                onCheckedChange={(v) => setForm({ ...form, isImmediate: v })}
              />
            </div>
            {!form.isImmediate && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Agendar para (horário comercial)</label>
                <Input
                  type="datetime-local"
                  value={form.scheduledDatetime}
                  onChange={(e) => setForm({ ...form, scheduledDatetime: e.target.value })}
                  className="rounded-md"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} className="bg-brand text-white hover:bg-brand/90">
              {form.isImmediate ? "Enviar agora" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotificacoesTab() {
  const { currentOrg, user } = useAuth();
  const { data: communications = [] } = useCommunications();
  const { data: acknowledgedIds = new Set<string>() } = useMyAcknowledgedCommunicationIds();
  const acknowledge = useAcknowledgeCommunication();

  const myRole = currentOrg?.role ?? null;
  const minhas = communications.filter(
    (c) =>
      c.targetProfiles.includes("todos") ||
      (myRole && c.targetProfiles.includes(myRole)) ||
      c.communicatorId === user?.id,
  );

  return (
    <div className="space-y-2">
      {minhas.map((c) => {
        const jaConfirmou = acknowledgedIds.has(c.id);
        return (
          <Card key={c.id} className="rounded-xl border-border/70 shadow-sm">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="text-sm font-medium text-foreground">{c.description}</div>
                <div className="text-[11px] text-muted-foreground">
                  {c.communicatorName ?? "—"} ·{" "}
                  {c.sentAt
                    ? new Date(c.sentAt).toLocaleString("pt-BR")
                    : c.scheduledDatetime
                      ? `agendada para ${new Date(c.scheduledDatetime).toLocaleString("pt-BR")}`
                      : "—"}
                </div>
              </div>
              {jaConfirmou ? (
                <Badge
                  variant="outline"
                  className="gap-1 rounded-md border-[color:var(--success)]/30 bg-[color:var(--success)]/15 text-[color:var(--success)]"
                >
                  <CheckCircle2 className="h-3 w-3" /> Ciente
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-md text-[11px]"
                  onClick={() =>
                    acknowledge.mutate(c.id, {
                      onError: (e) =>
                        toast.error("Erro ao confirmar ciência", {
                          description: getErrorMessage(e),
                        }),
                    })
                  }
                >
                  Ciente
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
      {minhas.length === 0 && (
        <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
          Nenhuma notificação para você no momento.
        </p>
      )}
    </div>
  );
}
