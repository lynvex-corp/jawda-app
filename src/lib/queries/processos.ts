import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";

/* ============================================================
 * Mapa de Processos — Bloco A (cartões, sem editor visual ainda).
 *
 * Dono e colaboradores apontam para `employees` (Cargos e Perfis), não
 * para usuários de login. Nome do dono/colaboradores é resolvido via a
 * view `employees_public_name` (só id/org_id/nome, sem RLS restrita) —
 * ver migração 20260914090000: a RLS de `employees` normalmente só deixa
 * RH ou o próprio funcionário ver o nome, mas o cartão de processo
 * precisa mostrar "Dono: X" pra qualquer papel com "Ver" no módulo.
 * ============================================================ */

export type ProcessMapIcon =
  | "Boxes"
  | "Building2"
  | "ClipboardCheck"
  | "Cog"
  | "Factory"
  | "HardHat"
  | "Handshake"
  | "Landmark"
  | "Megaphone"
  | "Package"
  | "Scale"
  | "Server"
  | "ShieldCheck"
  | "ShoppingCart"
  | "Truck"
  | "Users"
  | "Wrench";

/** Alfabético pelo rótulo (regra 21.7 do Guia). */
export const PROCESS_MAP_ICON_OPTIONS: { value: ProcessMapIcon; label: string }[] = [
  { value: "Boxes", label: "Almoxarifado" },
  { value: "Handshake", label: "Atendimento/Comercial" },
  { value: "ClipboardCheck", label: "Auditoria/Controle" },
  { value: "Scale", label: "Compliance/Jurídico" },
  { value: "Megaphone", label: "Comunicação/Marketing" },
  { value: "Building2", label: "Facilities/Infraestrutura" },
  { value: "Landmark", label: "Financeiro" },
  { value: "Server", label: "Tecnologia da Informação" },
  { value: "Wrench", label: "Manutenção" },
  { value: "Factory", label: "Produção" },
  { value: "ShieldCheck", label: "Qualidade/SGI" },
  { value: "Users", label: "Recursos Humanos" },
  { value: "HardHat", label: "Obras/Engenharia" },
  { value: "ShoppingCart", label: "Comercial/Vendas" },
  { value: "Package", label: "Logística" },
  { value: "Truck", label: "Suprimentos" },
  { value: "Cog", label: "Outro" },
];

export interface ProcessMap {
  id: string;
  code: string;
  name: string;
  description: string;
  entradas: string;
  saidas: string;
  icon: ProcessMapIcon;
  ownerEmployeeId: string | null;
  ownerName: string | null;
  collaboratorCount: number;
  isActive: boolean;
  createdAt: string;
}

const processMapKeys = {
  all: ["process-maps"] as const,
  list: () => [...processMapKeys.all, "list"] as const,
  detail: (id: string) => [...processMapKeys.all, "detail", id] as const,
  collaborators: (id: string) => [...processMapKeys.all, "collaborators", id] as const,
};

async function resolveOwnerNames(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, string>();
  const { data, error } = await supabase
    .from("employees_public_name")
    .select("id, nome")
    .in("id", ids);
  if (error) throw error;
  return new Map(
    ((data as unknown as { id: string; nome: string }[]) ?? []).map((r) => [r.id, r.nome]),
  );
}

export function useProcessMaps(includeInactive = false) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: [...processMapKeys.list(), includeInactive],
    queryFn: async (): Promise<ProcessMap[]> => {
      let query = supabase
        .from("process_maps")
        .select(
          "id, code, name, description, entradas, saidas, icon, owner_employee_id, is_active, created_at, process_map_collaborators(count)",
        )
        .order("code");
      if (!includeInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;

      const rows =
        (data as unknown as {
          id: string;
          code: string;
          name: string;
          description: string | null;
          entradas: string | null;
          saidas: string | null;
          icon: ProcessMapIcon;
          owner_employee_id: string | null;
          is_active: boolean;
          created_at: string;
          process_map_collaborators: { count: number }[];
        }[]) ?? [];

      const ownerIds = rows.map((r) => r.owner_employee_id).filter((id): id is string => !!id);
      const names = await resolveOwnerNames(supabase, ownerIds);

      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description ?? "",
        entradas: r.entradas ?? "",
        saidas: r.saidas ?? "",
        icon: r.icon,
        ownerEmployeeId: r.owner_employee_id,
        ownerName: r.owner_employee_id ? (names.get(r.owner_employee_id) ?? null) : null,
        collaboratorCount: r.process_map_collaborators?.[0]?.count ?? 0,
        isActive: r.is_active,
        createdAt: r.created_at,
      }));
    },
  });
}

export interface ProcessMapCollaborator {
  id: string;
  employeeId: string;
  employeeNome: string;
}

export function useProcessMap(id: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: processMapKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<ProcessMap> => {
      const { data, error } = await supabase
        .from("process_maps")
        .select(
          "id, code, name, description, entradas, saidas, icon, owner_employee_id, is_active, created_at, process_map_collaborators(count)",
        )
        .eq("id", id as string)
        .single();
      if (error) throw error;
      const r = data as unknown as {
        id: string;
        code: string;
        name: string;
        description: string | null;
        entradas: string | null;
        saidas: string | null;
        icon: ProcessMapIcon;
        owner_employee_id: string | null;
        is_active: boolean;
        created_at: string;
        process_map_collaborators: { count: number }[];
      };
      const names = await resolveOwnerNames(
        supabase,
        r.owner_employee_id ? [r.owner_employee_id] : [],
      );
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description ?? "",
        entradas: r.entradas ?? "",
        saidas: r.saidas ?? "",
        icon: r.icon,
        ownerEmployeeId: r.owner_employee_id,
        ownerName: r.owner_employee_id ? (names.get(r.owner_employee_id) ?? null) : null,
        collaboratorCount: r.process_map_collaborators?.[0]?.count ?? 0,
        isActive: r.is_active,
        createdAt: r.created_at,
      };
    },
  });
}

export function useProcessMapCollaborators(processMapId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: processMapKeys.collaborators(processMapId ?? ""),
    enabled: !!processMapId,
    queryFn: async (): Promise<ProcessMapCollaborator[]> => {
      const { data, error } = await supabase
        .from("process_map_collaborators")
        .select("id, employee_id")
        .eq("process_map_id", processMapId as string);
      if (error) throw error;
      const rows = (data as unknown as { id: string; employee_id: string }[]) ?? [];
      const names = await resolveOwnerNames(
        supabase,
        rows.map((r) => r.employee_id),
      );
      return rows.map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        employeeNome: names.get(r.employee_id) ?? "—",
      }));
    },
  });
}

export interface ProcessMapInput {
  code: string;
  name: string;
  description: string;
  entradas: string;
  saidas: string;
  icon: ProcessMapIcon;
  ownerEmployeeId: string | null;
}

export function useCreateProcessMap() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProcessMapInput) => {
      const { data, error } = await supabase
        .from("process_maps")
        .insert({
          code: input.code.trim().toUpperCase(),
          name: input.name,
          description: input.description || null,
          entradas: input.entradas || null,
          saidas: input.saidas || null,
          icon: input.icon,
          owner_employee_id: input.ownerEmployeeId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: processMapKeys.list() }),
  });
}

export function useUpdateProcessMap() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ProcessMapInput & { id: string }) => {
      const { error } = await supabase
        .from("process_maps")
        .update({
          code: input.code.trim().toUpperCase(),
          name: input.name,
          description: input.description || null,
          entradas: input.entradas || null,
          saidas: input.saidas || null,
          icon: input.icon,
          owner_employee_id: input.ownerEmployeeId,
        })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: processMapKeys.list() });
      queryClient.invalidateQueries({ queryKey: processMapKeys.detail(id) });
    },
  });
}

/** "Excluir" da matriz de permissões = arquivar (reversível). RLS +
 * trigger (enforce_process_map_archive_role) restringem a admin — a UI
 * só acompanha, não decide. */
export function useSetProcessMapActive() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("process_maps")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: processMapKeys.list() });
      queryClient.invalidateQueries({ queryKey: processMapKeys.detail(id) });
    },
  });
}

export function useAddProcessMapCollaborator() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      processMapId,
      employeeId,
    }: {
      processMapId: string;
      employeeId: string;
    }) => {
      const { error } = await supabase
        .from("process_map_collaborators")
        .insert({ process_map_id: processMapId, employee_id: employeeId });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: processMapKeys.collaborators(vars.processMapId) });
      queryClient.invalidateQueries({ queryKey: processMapKeys.detail(vars.processMapId) });
      queryClient.invalidateQueries({ queryKey: processMapKeys.list() });
    },
  });
}

export function useRemoveProcessMapCollaborator() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, processMapId }: { id: string; processMapId: string }) => {
      const { error } = await supabase.from("process_map_collaborators").delete().eq("id", id);
      if (error) throw error;
      return processMapId;
    },
    onSuccess: (processMapId) => {
      queryClient.invalidateQueries({ queryKey: processMapKeys.collaborators(processMapId) });
      queryClient.invalidateQueries({ queryKey: processMapKeys.detail(processMapId) });
      queryClient.invalidateQueries({ queryKey: processMapKeys.list() });
    },
  });
}
