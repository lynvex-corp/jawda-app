import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type ServiceDemandStatus =
  | "requisitos_em_analise"
  | "em_producao"
  | "em_verificacao"
  | "entregue";
export type StageStatus = "pendente" | "em_andamento" | "concluida";

export const SERVICE_DEMAND_STATUS_OPTIONS: { value: ServiceDemandStatus; label: string }[] = [
  { value: "requisitos_em_analise", label: "Requisitos em análise" },
  { value: "em_producao", label: "Em produção" },
  { value: "em_verificacao", label: "Em verificação" },
  { value: "entregue", label: "Entregue" },
];

export interface ServiceDemandStage {
  id: string;
  stageName: string;
  status: StageStatus;
  stageOrder: number;
  responsibleId: string | null;
  responsibleName: string | null;
}

export interface ServiceDemand {
  id: string;
  code: string;
  clientOrOrigin: string;
  requirements: string;
  expectedDate: string | null;
  status: ServiceDemandStatus;
  comparisonDeliveredVsRequested: string | null;
  generatedNcId: string | null;
  createdAt: string;
  stages: ServiceDemandStage[];
}

const serviceDemandsKeys = {
  all: ["service-demands"] as const,
  list: () => [...serviceDemandsKeys.all, "list"] as const,
};

interface ServiceDemandRow {
  id: string;
  code: string;
  client_or_origin: string;
  requirements: string;
  expected_date: string | null;
  status: ServiceDemandStatus;
  comparison_delivered_vs_requested: string | null;
  generated_nc_id: string | null;
  created_at: string;
}

interface ServiceDemandStageRow {
  id: string;
  demand_id: string;
  stage_name: string;
  status: StageStatus;
  stage_order: number;
  responsible_id: string | null;
  responsible: { full_name: string } | null;
}

export function useServiceDemands() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: serviceDemandsKeys.list(),
    queryFn: async (): Promise<ServiceDemand[]> => {
      const [demandsRes, stagesRes] = await Promise.all([
        supabase
          .from("service_demands")
          .select(
            "id, code, client_or_origin, requirements, expected_date, status, " +
              "comparison_delivered_vs_requested, generated_nc_id, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("service_demand_stages")
          .select(
            "id, demand_id, stage_name, status, stage_order, responsible_id, responsible:profiles!responsible_id(full_name)",
          )
          .order("stage_order"),
      ]);
      if (demandsRes.error) throw demandsRes.error;
      if (stagesRes.error) throw stagesRes.error;

      const stagesByDemand = new Map<string, ServiceDemandStage[]>();
      for (const s of stagesRes.data as unknown as ServiceDemandStageRow[]) {
        const list = stagesByDemand.get(s.demand_id) ?? [];
        list.push({
          id: s.id,
          stageName: s.stage_name,
          status: s.status,
          stageOrder: s.stage_order,
          responsibleId: s.responsible_id,
          responsibleName: s.responsible?.full_name ?? null,
        });
        stagesByDemand.set(s.demand_id, list);
      }

      return (demandsRes.data as unknown as ServiceDemandRow[]).map((r) => ({
        id: r.id,
        code: r.code,
        clientOrOrigin: r.client_or_origin,
        requirements: r.requirements,
        expectedDate: r.expected_date,
        status: r.status,
        comparisonDeliveredVsRequested: r.comparison_delivered_vs_requested,
        generatedNcId: r.generated_nc_id,
        createdAt: r.created_at,
        stages: stagesByDemand.get(r.id) ?? [],
      }));
    },
  });
}

export function useCreateServiceDemand() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      clientOrOrigin: string;
      requirements: string;
      expectedDate: string | null;
    }) => {
      const { error } = await supabase.from("service_demands").insert({
        client_or_origin: input.clientOrOrigin,
        requirements: input.requirements,
        expected_date: input.expectedDate,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceDemandsKeys.list() }),
  });
}

const nextStageStatus: Record<StageStatus, StageStatus> = {
  pendente: "em_andamento",
  em_andamento: "concluida",
  concluida: "pendente",
};

export function useAdvanceServiceDemandStage() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stageId, current }: { stageId: string; current: StageStatus }) => {
      const { error } = await supabase
        .from("service_demand_stages")
        .update({ status: nextStageStatus[current] })
        .eq("id", stageId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceDemandsKeys.list() }),
  });
}

export function useRegisterServiceDemandDelivery() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandId, comparison }: { demandId: string; comparison: string }) => {
      const { error } = await supabase.rpc("register_service_demand_delivery", {
        p_demand_id: demandId,
        p_comparison: comparison,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceDemandsKeys.list() }),
  });
}

/** Grava o vínculo depois que a NC real já foi criada (useCreateNC, módulo
 * de NC em produção) — este hook só faz a ponta "referência bidirecional"
 * do gancho (seção 21.4), nunca duplica campos de tratativa aqui. */
export function useLinkServiceDemandToNC() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandId, ncId }: { demandId: string; ncId: string }) => {
      const { error } = await supabase
        .from("service_demands")
        .update({ generated_nc_id: ncId })
        .eq("id", demandId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceDemandsKeys.list() }),
  });
}
