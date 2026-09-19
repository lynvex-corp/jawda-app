import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/app/searchable-select";
import { useCreateActionPlan, useOrgMembers } from "@/lib/queries/action-plans";
import type { PlanoOrigemTipo } from "@/lib/mock-data";
import { getErrorMessage } from "@/lib/utils";

/* ============================================================
 * Gerar Plano de Ação — dialog compartilhado (Bloco 8, itens 4 e 5).
 *
 * Causa raiz do bug "SWOT não gera Plano de Ação": a tela de Planos de Ação
 * inteira (lista/kanban/gantt) é alimentada por action_plan_corrective_actions,
 * não por action_plans sozinha. As funções antigas (useGenerateActionPlanFrom-
 * SwotCard/Risk/CriticalAnalysisItem) só inseriam o cabeçalho em action_plans
 * e nunca criavam a ação corretiva — o plano nascia, mas ficava invisível em
 * qualquer lugar que lê a tabela certa.
 *
 * Correção: reusar useCreateActionPlan, o MESMO caminho que o wizard normal
 * de "Novo Plano de Ação" já usa com sucesso, em vez de duplicar um insert
 * incompleto. Isso corrige o bug por construção nos 3 pontos de origem que
 * tinham a mesma falha (SWOT, Riscos, Análise Crítica) — cada chamador só
 * decide o texto inicial e o que fazer com o plano gerado (onGerado).
 * ============================================================ */

interface GerarPlanoAcaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origem: PlanoOrigemTipo;
  /** Pré-preenche "Problema/origem" e "O quê" — o usuário ajusta antes de
   * confirmar. Recalculado a cada abertura via useEffect (não apenas no
   * primeiro render), porque o mesmo dialog é reaberto com textos diferentes
   * (cards diferentes selecionados, recomendação de IA diferente). */
  problemaInicial: string;
  onGerado: (plan: { id: string; code: string }) => void;
}

export function GerarPlanoAcaoDialog({
  open,
  onOpenChange,
  origem,
  problemaInicial,
  onGerado,
}: GerarPlanoAcaoDialogProps) {
  const createPlan = useCreateActionPlan();
  const { data: orgMembers = [] } = useOrgMembers();
  const membrosOrdenados = [...orgMembers].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, "pt-BR"),
  );

  const [problema, setProblema] = useState("");
  const [oque, setOque] = useState("");
  const [porque, setPorque] = useState("");
  const [onde, setOnde] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [como, setComo] = useState("");
  const [quanto, setQuanto] = useState("0");
  const [prazo, setPrazo] = useState("");

  useEffect(() => {
    if (!open) return;
    setProblema(problemaInicial);
    setOque(problemaInicial);
    setPorque("");
    setOnde("");
    setResponsavelId("");
    setComo("");
    setQuanto("0");
    setPrazo("");
  }, [open, problemaInicial]);

  const invalido =
    !problema.trim() ||
    !oque.trim() ||
    !porque.trim() ||
    !onde.trim() ||
    !responsavelId ||
    !como.trim() ||
    !prazo;

  const confirmar = () => {
    if (invalido) {
      toast.error("Preencha todos os campos obrigatórios do 5W2H");
      return;
    }
    createPlan.mutate(
      {
        origem,
        problema: problema.trim(),
        acoes: [
          {
            oque: oque.trim(),
            porque: porque.trim(),
            onde: onde.trim(),
            responsavelId,
            como: como.trim(),
            quanto: Number(quanto) || 0,
            prazo: new Date(prazo),
          },
        ],
      },
      {
        onSuccess: (plan) => {
          toast.success("Plano de ação gerado", { description: `Vínculo criado: ${plan.code}` });
          onGerado(plan);
          onOpenChange(false);
        },
        onError: (e) =>
          toast.error("Não foi possível gerar o plano", { description: getErrorMessage(e) }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Gerar Plano de Ação</DialogTitle>
          <DialogDescription>
            A ação corretiva abaixo é o que efetivamente aparece em Planos de Ação — todos os campos
            são obrigatórios (5W2H, seção 10 do Guia).
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 text-sm">
          <div>
            <Label className="text-xs">Problema / origem</Label>
            <Textarea
              value={problema}
              onChange={(e) => setProblema(e.target.value)}
              className="mt-1.5 min-h-[60px] rounded-lg text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">O quê</Label>
            <Textarea
              value={oque}
              onChange={(e) => setOque(e.target.value)}
              className="mt-1.5 min-h-[60px] rounded-lg text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Por quê</Label>
            <Textarea
              value={porque}
              onChange={(e) => setPorque(e.target.value)}
              className="mt-1.5 min-h-[50px] rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Onde</Label>
              <Input
                value={onde}
                onChange={(e) => setOnde(e.target.value)}
                className="mt-1.5 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Quem</Label>
              <SearchableSelect
                value={responsavelId}
                onValueChange={setResponsavelId}
                placeholder="Selecione"
                searchPlaceholder="Buscar por nome…"
                emptyMessage="Nenhuma pessoa encontrada."
                className="mt-1.5 rounded-lg"
                options={membrosOrdenados.map((m) => ({ value: m.id, label: m.fullName }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Como</Label>
            <Textarea
              value={como}
              onChange={(e) => setComo(e.target.value)}
              className="mt-1.5 min-h-[50px] rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Quando — prazo</Label>
              <Input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="mt-1.5 rounded-lg text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Quanto custa (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={quanto}
                onChange={(e) => setQuanto(e.target.value)}
                className="mt-1.5 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={createPlan.isPending}
            className="bg-brand text-white hover:bg-brand/90"
          >
            {createPlan.isPending ? "Gerando…" : "Gerar plano"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
