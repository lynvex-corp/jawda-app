import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app/app-shell";
import { SearchableSelect } from "@/components/app/searchable-select";
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
import { Plus, GitBranch, FileText, ArrowRight, Workflow, Cog } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/utils";
import { useEmployees } from "@/lib/queries/pessoas";
import { PROCESS_MAP_ICONS } from "@/components/processos/icon-map";
import { ProcessKpiBadge, useProcessKpiLookup } from "@/components/processos/kpi-badge";
import {
  useProcessMaps,
  useCreateProcessMap,
  PROCESS_MAP_ICON_OPTIONS,
  type ProcessMapIcon,
  type ProcessMapInput,
} from "@/lib/queries/processos";

const FORM_VAZIO: ProcessMapInput = {
  code: "",
  name: "",
  description: "",
  entradas: "",
  saidas: "",
  icon: "Cog",
  ownerEmployeeId: null,
};

export function ProcessosPage() {
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const canManage =
    currentOrg?.role === "admin" ||
    currentOrg?.role === "quality_manager" ||
    currentOrg?.role === "area_manager";
  const { data: processos = [], isLoading } = useProcessMaps();
  const { data: employees = [] } = useEmployees();
  const createProcessMap = useCreateProcessMap();
  const kpiLookup = useProcessKpiLookup();

  const [novoOpen, setNovoOpen] = useState(false);
  const [novo, setNovo] = useState<ProcessMapInput>(FORM_VAZIO);

  const salvar = () => {
    if (!novo.code.trim() || !novo.name.trim()) {
      toast.error("Preencha a sigla e o nome do processo");
      return;
    }
    createProcessMap.mutate(novo, {
      onSuccess: (created) => {
        toast.success("Processo criado");
        setNovoOpen(false);
        setNovo(FORM_VAZIO);
        navigate({ to: "/processos/$id", params: { id: created.id } });
      },
      onError: (e) => toast.error("Erro ao criar processo", { description: getErrorMessage(e) }),
    });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Processos e Fluxos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Estruture os processos da sua organização: dono, entradas, saídas e indicador
              vinculado.
            </p>
          </div>
          {canManage && (
            <Button
              onClick={() => setNovoOpen(true)}
              className="rounded-lg bg-brand text-white hover:bg-brand/90"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Novo processo
            </Button>
          )}
        </header>

        <a href="/documentos">
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
        </a>

        {!isLoading && processos.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-14 text-center">
            <Workflow className="h-10 w-10 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Nenhum processo cadastrado</h2>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Sua organização ainda não estruturou nenhum processo. Comece criando o primeiro —
                não há processos padrão pré-definidos.
              </p>
            </div>
            {canManage && (
              <Button
                onClick={() => setNovoOpen(true)}
                className="mt-2 rounded-lg bg-brand text-white hover:bg-brand/90"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Criar primeiro processo
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {processos.map((p) => {
            const Icon = PROCESS_MAP_ICONS[p.icon] ?? Cog;
            return (
              <Card
                key={p.id}
                className="rounded-2xl border-border/80 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
              >
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="rounded-full text-[10px] font-semibold">
                      {p.code}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{p.name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Dono: {p.ownerName ?? "Não definido"}
                    </p>
                  </div>
                  {(p.entradas || p.saidas) && (
                    <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px]">
                      {p.entradas && (
                        <div>
                          <span className="font-medium text-foreground/80">Entradas </span>
                          <span className="text-muted-foreground">{p.entradas}</span>
                        </div>
                      )}
                      {p.saidas && (
                        <div>
                          <span className="font-medium text-foreground/80">Saídas </span>
                          <span className="text-muted-foreground">{p.saidas}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {p.indicatorId && (
                    <ProcessKpiBadge indicatorId={p.indicatorId} lookup={kpiLookup} />
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-center gap-1.5 rounded-lg text-xs"
                    onClick={() => navigate({ to: "/processos/$id", params: { id: p.id } })}
                  >
                    <GitBranch className="h-3.5 w-3.5" /> Ver fluxo e RACI
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Novo processo</DialogTitle>
            <DialogDescription>
              Configuração detalhada (fluxo, RACI, indicador) fica disponível depois de criar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <div>
                <label className="text-xs font-medium">Sigla</label>
                <Input
                  value={novo.code}
                  onChange={(e) => setNovo({ ...novo, code: e.target.value })}
                  placeholder="COM"
                  maxLength={6}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Nome do processo</label>
                <Input
                  value={novo.name}
                  onChange={(e) => setNovo({ ...novo, name: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Ícone</label>
              <Select
                value={novo.icon}
                onValueChange={(v) => setNovo({ ...novo, icon: v as ProcessMapIcon })}
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
              <SearchableSelect
                value={novo.ownerEmployeeId ?? undefined}
                onValueChange={(v) => setNovo({ ...novo, ownerEmployeeId: v })}
                placeholder="Selecione em Cargos e Perfis"
                searchPlaceholder="Buscar por nome…"
                emptyMessage="Nenhum funcionário encontrado."
                className="mt-1 h-9 text-sm"
                options={[...employees]
                  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                  .map((e) => ({ value: e.id, label: e.nome }))}
              />
              {employees.length === 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Nenhuma pessoa cadastrada ainda — cadastre em Cargos e Perfis.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Entradas</label>
                <Textarea
                  value={novo.entradas}
                  onChange={(e) => setNovo({ ...novo, entradas: e.target.value })}
                  className="mt-1 min-h-[70px] text-sm"
                  placeholder="Demanda do cliente · Edital…"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Saídas</label>
                <Textarea
                  value={novo.saidas}
                  onChange={(e) => setNovo({ ...novo, saidas: e.target.value })}
                  className="mt-1 min-h-[70px] text-sm"
                  placeholder="Proposta aprovada · Contrato…"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Descrição (opcional)</label>
              <Textarea
                value={novo.description}
                onChange={(e) => setNovo({ ...novo, description: e.target.value })}
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={createProcessMap.isPending}
              className="bg-brand text-white hover:bg-brand/90"
            >
              Criar processo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
