import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Node, Edge } from "@xyflow/react";
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
  /** Bloco D — vínculo com um indicador já existente (não é uma
   * tabela/KPI novo, reaproveita o módulo Indicadores). Um por processo,
   * já que é isso que o cartão de referência mostra. */
  indicatorId: string | null;
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
          "id, code, name, description, entradas, saidas, icon, owner_employee_id, indicator_id, is_active, created_at, process_map_collaborators(count)",
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
          indicator_id: string | null;
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
        indicatorId: r.indicator_id,
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
          "id, code, name, description, entradas, saidas, icon, owner_employee_id, indicator_id, is_active, created_at, process_map_collaborators(count)",
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
        indicator_id: string | null;
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
        indicatorId: r.indicator_id,
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

/** Bloco D — separado de useUpdateProcessMap de propósito: o vínculo com
 * indicador é editado na aba Indicadores do detalhe, não no formulário de
 * Novo/Editar processo (que já tem campo demais). */
export function useLinkProcessMapIndicator() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, indicatorId }: { id: string; indicatorId: string | null }) => {
      const { error } = await supabase
        .from("process_maps")
        .update({ indicator_id: indicatorId })
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

/* ============================================================
 * Bloco B — editor visual (React Flow) e versionamento.
 *
 * `data` de cada nó carrega, quando aplicável, responsibleEmployeeId OU
 * responsibleJobPositionId — validado a cada escrita pela RLS
 * (process_map_diagram_refs_valid, 20260915090100) contra vazamento
 * entre organizações. O cliente nunca precisa validar isso de novo; se
 * mandar um id de outra org, o banco recusa a escrita inteira.
 * ============================================================ */

export type ProcessNodeType = "startNode" | "endNode" | "taskNode" | "decisionNode" | "laneNode";

export interface ProcessNodeData extends Record<string, unknown> {
  label: string;
  responsibleEmployeeId?: string | null;
  responsibleJobPositionId?: string | null;
}

export type ProcessFlowNode = Node<ProcessNodeData, ProcessNodeType>;
export type ProcessFlowEdge = Edge;

export interface ProcessDiagram {
  nodes: ProcessFlowNode[];
  edges: ProcessFlowEdge[];
}

const EMPTY_DIAGRAM: ProcessDiagram = { nodes: [], edges: [] };

export interface ProcessMapVersion {
  id: string;
  processMapId: string;
  versionNumber: number;
  versionLabel: string | null;
  status: "rascunho" | "formalizada";
  diagram: ProcessDiagram;
  formalizedAt: string | null;
  createdAt: string;
}

const processMapVersionKeys = {
  all: ["process-map-versions"] as const,
  list: (processMapId: string) => [...processMapVersionKeys.all, "list", processMapId] as const,
  detail: (id: string) => [...processMapVersionKeys.all, "detail", id] as const,
  draft: (processMapId: string) => [...processMapVersionKeys.all, "draft", processMapId] as const,
};

interface VersionRow {
  id: string;
  process_map_id: string;
  version_number: number;
  version_label: string | null;
  status: "rascunho" | "formalizada";
  diagram: ProcessDiagram;
  formalized_at: string | null;
  created_at: string;
}

function mapVersionRow(r: VersionRow): ProcessMapVersion {
  return {
    id: r.id,
    processMapId: r.process_map_id,
    versionNumber: r.version_number,
    versionLabel: r.version_label,
    status: r.status,
    diagram: r.diagram ?? EMPTY_DIAGRAM,
    formalizedAt: r.formalized_at,
    createdAt: r.created_at,
  };
}

const VERSION_SELECT =
  "id, process_map_id, version_number, version_label, status, diagram, formalized_at, created_at";

export function useProcessMapVersions(processMapId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: processMapVersionKeys.list(processMapId ?? ""),
    enabled: !!processMapId,
    queryFn: async (): Promise<ProcessMapVersion[]> => {
      const { data, error } = await supabase
        .from("process_map_versions")
        .select(VERSION_SELECT)
        .eq("process_map_id", processMapId as string)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return ((data as unknown as VersionRow[]) ?? []).map(mapVersionRow);
    },
  });
}

export function useProcessMapVersion(id: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: processMapVersionKeys.detail(id ?? ""),
    enabled: !!id,
    queryFn: async (): Promise<ProcessMapVersion> => {
      const { data, error } = await supabase
        .from("process_map_versions")
        .select(VERSION_SELECT)
        .eq("id", id as string)
        .single();
      if (error) throw error;
      return mapVersionRow(data as unknown as VersionRow);
    },
  });
}

/** Rascunho aberto do processo — null quando ainda não existe (primeira
 * vez que alguém abre a aba Fluxo). A tela chama useCreateProcessMapDraft
 * pra nascer o primeiro, vazio. */
export function useProcessMapDraft(processMapId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: processMapVersionKeys.draft(processMapId ?? ""),
    enabled: !!processMapId,
    queryFn: async (): Promise<ProcessMapVersion | null> => {
      const { data, error } = await supabase
        .from("process_map_versions")
        .select(VERSION_SELECT)
        .eq("process_map_id", processMapId as string)
        .eq("status", "rascunho")
        .maybeSingle();
      if (error) throw error;
      return data ? mapVersionRow(data as unknown as VersionRow) : null;
    },
  });
}

/** Cria o primeiro rascunho (vazio) ou o próximo (copiando o diagrama da
 * última versão) — mesmo botão nos dois casos: "quando não há rascunho
 * aberto, crie um". */
export function useCreateProcessMapDraft() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ processMapId }: { processMapId: string }) => {
      const { data: last, error: lastErr } = await supabase
        .from("process_map_versions")
        .select("id, version_number, diagram")
        .eq("process_map_id", processMapId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastErr) throw lastErr;

      const lastRow = last as {
        id: string;
        version_number: number;
        diagram: ProcessDiagram;
      } | null;
      const nextNumber = (lastRow?.version_number ?? 0) + 1;
      const startingDiagram = lastRow?.diagram ?? EMPTY_DIAGRAM;

      const { data, error } = await supabase
        .from("process_map_versions")
        .insert({
          process_map_id: processMapId,
          version_number: nextNumber,
          diagram: startingDiagram,
        })
        .select(VERSION_SELECT)
        .single();
      if (error) throw error;
      const created = mapVersionRow(data as unknown as VersionRow);

      // Copia o RACI da versão anterior — os node_key continuam válidos
      // porque o diagrama copiado é o mesmo (mesmos ids de nó).
      if (lastRow) {
        const { data: previousRaci, error: raciErr } = await supabase
          .from("process_map_raci")
          .select("node_key, employee_id, job_position_id, papel")
          .eq("version_id", lastRow.id);
        if (raciErr) throw raciErr;
        const rows = (previousRaci ?? []) as {
          node_key: string;
          employee_id: string | null;
          job_position_id: string | null;
          papel: string;
        }[];
        if (rows.length > 0) {
          const { error: copyErr } = await supabase.from("process_map_raci").insert(
            rows.map((r) => ({
              version_id: created.id,
              node_key: r.node_key,
              employee_id: r.employee_id,
              job_position_id: r.job_position_id,
              papel: r.papel,
            })),
          );
          if (copyErr) throw copyErr;
        }
      }

      return created;
    },
    onSuccess: (version) => {
      queryClient.invalidateQueries({ queryKey: processMapVersionKeys.list(version.processMapId) });
      queryClient.setQueryData(processMapVersionKeys.draft(version.processMapId), version);
    },
  });
}

/** Autosave — grava o {nodes, edges} inteiro a cada mudança relevante
 * (debounce fica no componente). RLS recusa se a linha já foi formalizada
 * ou se algum responsável referenciado não for da mesma organização. */
export function useSaveProcessMapDiagram() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      versionId,
      diagram,
    }: {
      versionId: string;
      processMapId: string;
      diagram: ProcessDiagram;
    }) => {
      const { error } = await supabase
        .from("process_map_versions")
        .update({ diagram })
        .eq("id", versionId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: processMapVersionKeys.draft(vars.processMapId) });
    },
  });
}

export function useFormalizeProcessMapVersion() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      versionId,
      versionLabel,
    }: {
      versionId: string;
      processMapId: string;
      versionLabel: string;
    }) => {
      // formalized_by/formalized_at são carimbados pelo trigger
      // (enforce_process_map_version_formalize_role), não pelo cliente.
      const { error } = await supabase
        .from("process_map_versions")
        .update({ status: "formalizada", version_label: versionLabel })
        .eq("id", versionId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: processMapVersionKeys.list(vars.processMapId) });
      queryClient.invalidateQueries({ queryKey: processMapVersionKeys.draft(vars.processMapId) });
    },
  });
}

/* ============================================================
 * Bloco C — RACI (Responsável/Aprovador/Consultado/Informado) por
 * elemento do fluxo. Relacional (employee_id/job_position_id via FK),
 * nunca texto livre — puxa de Cargos e Perfis, igual ao responsável de
 * tarefa/raia do Bloco B, mas aqui pode ter vários por (nó, papel).
 * ============================================================ */

export type ProcessRaciPapel = "responsavel" | "aprovador" | "consultado" | "informado";

export const PROCESS_RACI_PAPEL_OPTIONS: { value: ProcessRaciPapel; label: string }[] = [
  { value: "aprovador", label: "Aprovador" },
  { value: "consultado", label: "Consultado" },
  { value: "informado", label: "Informado" },
  { value: "responsavel", label: "Responsável" },
];

export interface ProcessRaciAssignment {
  id: string;
  nodeKey: string;
  employeeId: string | null;
  jobPositionId: string | null;
  assigneeName: string;
  papel: ProcessRaciPapel;
}

const processRaciKeys = {
  all: ["process-map-raci"] as const,
  list: (versionId: string) => [...processRaciKeys.all, "list", versionId] as const,
};

export function useProcessMapRaci(versionId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: processRaciKeys.list(versionId ?? ""),
    enabled: !!versionId,
    queryFn: async (): Promise<ProcessRaciAssignment[]> => {
      const { data, error } = await supabase
        .from("process_map_raci")
        .select("id, node_key, employee_id, job_position_id, papel")
        .eq("version_id", versionId as string);
      if (error) throw error;
      const rows =
        (data as unknown as {
          id: string;
          node_key: string;
          employee_id: string | null;
          job_position_id: string | null;
          papel: ProcessRaciPapel;
        }[]) ?? [];

      const employeeIds = rows.map((r) => r.employee_id).filter((v): v is string => !!v);
      const positionIds = rows.map((r) => r.job_position_id).filter((v): v is string => !!v);

      const resolvePositionNames = async () => {
        if (positionIds.length === 0) return new Map<string, string>();
        const { data: pos, error: posErr } = await supabase
          .from("job_positions")
          .select("id, nome")
          .in("id", positionIds);
        if (posErr) throw posErr;
        return new Map(
          ((pos as unknown as { id: string; nome: string }[]) ?? []).map((p) => [p.id, p.nome]),
        );
      };

      const [employeeNames, positionNames] = await Promise.all([
        resolveOwnerNames(supabase, employeeIds),
        resolvePositionNames(),
      ]);

      return rows.map((r) => ({
        id: r.id,
        nodeKey: r.node_key,
        employeeId: r.employee_id,
        jobPositionId: r.job_position_id,
        assigneeName: r.employee_id
          ? (employeeNames.get(r.employee_id) ?? "—")
          : `${positionNames.get(r.job_position_id as string) ?? "—"} (cargo)`,
        papel: r.papel,
      }));
    },
  });
}

export function useAddProcessMapRaci() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      versionId: string;
      nodeKey: string;
      employeeId: string | null;
      jobPositionId: string | null;
      papel: ProcessRaciPapel;
    }) => {
      const { error } = await supabase.from("process_map_raci").insert({
        version_id: input.versionId,
        node_key: input.nodeKey,
        employee_id: input.employeeId,
        job_position_id: input.jobPositionId,
        papel: input.papel,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({ queryKey: processRaciKeys.list(vars.versionId) }),
  });
}

export function useRemoveProcessMapRaci() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; versionId: string }) => {
      const { error } = await supabase.from("process_map_raci").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({ queryKey: processRaciKeys.list(vars.versionId) }),
  });
}
