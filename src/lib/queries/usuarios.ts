import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { inviteOrgUser } from "@/lib/invite-user-server";

/* ============================================================
 * Usuários e Permissões (Bloco 5, itens 6/8).
 *
 * Até aqui esta tela inteira era decorativa — usuarios/perfis vinham de
 * arrays locais em components/usuarios/page.tsx, nunca liam nem escreviam
 * no banco. "Novo usuário" não tinha onClick, "Editar" não tinha handler,
 * a busca não filtrava nada, e os "N usuários" por papel eram números
 * fixos no código.
 *
 * PERMISSION_MATRIX abaixo é o espelho, em TypeScript, das migrações
 * 20260913090000/090100 — a mesma decisão sobre quem pode Ver/Criar/
 * Editar/Aprovar/Excluir em cada módulo, só que aqui é dado de EXIBIÇÃO,
 * não de aplicação. Quem aplica de verdade é a RLS/os triggers no banco;
 * esta constante existe pra tela mostrar a mesma coisa que o banco decide,
 * sem duplicar a lógica de autorização em dois lugares que podem divergir.
 * Por isso os toggles na UI são só leitura — a seção 6 do Guia de
 * Arquitetura já diz que a lista de papéis é fixa, não configurável pelo
 * cliente na v1.
 * ============================================================ */

export type OrgRole =
  | "admin"
  | "quality_manager"
  | "auditor"
  | "area_manager"
  | "collaborator"
  | "viewer";

export const ROLE_OPTIONS: { value: OrgRole; label: string; descricao: string }[] = [
  {
    value: "admin",
    label: "Administrador",
    descricao: "Acesso total à plataforma e configurações.",
  },
  {
    value: "quality_manager",
    label: "Gestor da Qualidade",
    descricao: "Comanda o SGQ, aprova ações e auditorias.",
  },
  { value: "auditor", label: "Auditor", descricao: "Executa auditorias e registra apontamentos." },
  {
    value: "area_manager",
    label: "Gestor de Área",
    descricao: "Responsável pelas ações do seu processo/setor.",
  },
  {
    value: "collaborator",
    label: "Colaborador",
    descricao: "Executa ações e registra ocorrências.",
  },
  {
    value: "viewer",
    label: "Somente Leitura",
    descricao: "Consulta dados sem realizar alterações.",
  },
];

export type Perm = "Ver" | "Criar" | "Editar" | "Aprovar" | "Excluir";

export interface MatrixRow {
  modulo: string;
  /** Nota de rodapé — usada só para Estratégia (exceção da Análise Crítica). */
  nota?: string;
  matriz: Record<OrgRole, Perm[]>;
}

const ALL_PERMS: Perm[] = ["Ver", "Criar", "Editar", "Aprovar", "Excluir"];
const V: Perm[] = ["Ver"];

/** "Aprovar" não muda nesta rodada em nenhum módulo — nenhum dos 5 prints
 * marcou correção nessa coluna. Onde já existia (Administrador/Gestor da
 * Qualidade em geral), mantido como estava; onde não existia, continua sem.
 * Refletido aqui exatamente como está, sem inventar regra nova. */
export const PERMISSION_MATRIX: MatrixRow[] = [
  {
    modulo: "Não Conformidades",
    matriz: {
      admin: ALL_PERMS,
      quality_manager: ALL_PERMS,
      auditor: ALL_PERMS,
      area_manager: ["Ver", "Criar", "Editar"],
      collaborator: ["Ver", "Criar"],
      viewer: V,
    },
  },
  {
    modulo: "Planos de Ação",
    matriz: {
      admin: ALL_PERMS,
      quality_manager: ALL_PERMS,
      auditor: V,
      area_manager: ["Ver", "Criar", "Editar"],
      collaborator: ["Ver", "Criar"],
      viewer: V,
    },
  },
  {
    modulo: "Auditorias",
    matriz: {
      admin: ALL_PERMS,
      quality_manager: ALL_PERMS,
      auditor: ALL_PERMS,
      area_manager: V,
      collaborator: V,
      viewer: V,
    },
  },
  {
    modulo: "Documentos",
    matriz: {
      admin: ["Ver", "Criar", "Editar", "Aprovar", "Excluir"],
      quality_manager: ["Ver", "Criar", "Editar", "Aprovar"],
      auditor: V,
      area_manager: V,
      collaborator: V,
      viewer: V,
    },
  },
  {
    modulo: "Indicadores",
    matriz: {
      admin: ["Ver", "Criar", "Editar", "Aprovar", "Excluir"],
      quality_manager: ["Ver", "Criar", "Editar", "Aprovar"],
      auditor: V,
      area_manager: ["Ver", "Editar"],
      collaborator: V,
      viewer: V,
    },
  },
  {
    modulo: "Riscos",
    matriz: {
      admin: ["Ver", "Criar", "Editar", "Aprovar", "Excluir"],
      quality_manager: ["Ver", "Criar", "Editar", "Aprovar"],
      auditor: V,
      area_manager: ["Ver", "Criar"],
      collaborator: V,
      viewer: V,
    },
  },
  {
    modulo: "Processos",
    nota: "Aprovar ainda não tem ação concreta (formalizar fluxo só existe a partir do Bloco B do Mapa de Processos).",
    matriz: {
      admin: ["Ver", "Criar", "Editar", "Aprovar", "Excluir"],
      quality_manager: ["Ver", "Criar", "Editar", "Aprovar"],
      auditor: V,
      area_manager: ["Ver", "Criar", "Editar"],
      collaborator: V,
      viewer: V,
    },
  },
  {
    modulo: "Estratégia",
    nota: 'Análise Crítica pela Direção é exceção dentro deste módulo: só Administrador cria, mesmo quem tem "Criar" aqui (decisão do Bloco 3).',
    matriz: {
      admin: ["Ver", "Criar", "Editar", "Aprovar", "Excluir"],
      quality_manager: ["Ver", "Criar", "Editar", "Aprovar"],
      auditor: V,
      area_manager: ["Ver", "Criar", "Editar"],
      collaborator: V,
      viewer: V,
    },
  },
  {
    modulo: "Cargos e Perfis",
    matriz: {
      admin: ["Ver", "Criar", "Editar", "Excluir"],
      quality_manager: ["Ver", "Criar", "Editar", "Excluir"],
      auditor: [],
      area_manager: ["Ver", "Criar", "Editar", "Excluir"],
      collaborator: [],
      viewer: [],
    },
  },
  {
    modulo: "Documentos Pessoais / ASO",
    nota: "Dado sensível — deliberadamente mais fechado que Cargos e Perfis (sem Gestor de Área, decisão do Bloco 4).",
    matriz: {
      admin: ["Ver", "Criar"],
      quality_manager: ["Ver", "Criar"],
      auditor: [],
      area_manager: [],
      collaborator: [],
      viewer: [],
    },
  },
  {
    modulo: "Avaliação de Desempenho",
    matriz: {
      admin: ["Ver", "Criar", "Editar", "Aprovar"],
      quality_manager: [],
      auditor: [],
      area_manager: ["Ver", "Criar", "Editar", "Aprovar"],
      collaborator: [],
      viewer: [],
    },
  },
  {
    modulo: "Configurações",
    matriz: {
      admin: ["Ver", "Editar"],
      quality_manager: [],
      auditor: [],
      area_manager: [],
      collaborator: [],
      viewer: [],
    },
  },
];

/* ============================================================
 * Dado real
 * ============================================================ */

export interface OrgUser {
  id: string;
  fullName: string;
  email: string;
  role: OrgRole;
  unidade: string;
  lastActivityAt: string | null;
  ativo: boolean;
}

const usuariosKeys = {
  all: ["org-users"] as const,
  list: () => [...usuariosKeys.all, "list"] as const,
};

/** Lista real dos membros da organização ativa — substitui o array `usuarios`
 * que vivia hardcoded em components/usuarios/page.tsx. RLS de
 * user_organizations/profiles já isola por organização; não há filtro
 * adicional a fazer aqui. */
export function useOrgUsers() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: usuariosKeys.list(),
    queryFn: async (): Promise<OrgUser[]> => {
      const { data, error } = await supabase
        .from("user_organizations")
        .select(
          "user_id, role, units_scope, is_active, profile:profiles!user_id(full_name, email, last_activity_at)",
        )
        .order("role");
      if (error) throw error;
      const rows =
        (data as unknown as {
          user_id: string;
          role: OrgRole;
          units_scope: "all" | "specific";
          is_active: boolean;
          profile: { full_name: string; email: string; last_activity_at: string | null } | null;
        }[]) ?? [];

      // "Unidade" só é buscada pra quem tem escopo específico — quem tem
      // 'all' não referencia nenhuma linha em user_units_access (por
      // definição, não precisa), então uma segunda consulta evita N+1 sem
      // ganho nenhum pro caso comum.
      const specificIds = rows.filter((r) => r.units_scope === "specific").map((r) => r.user_id);
      const unitNamesByUser = new Map<string, string[]>();
      if (specificIds.length > 0) {
        const { data: access } = await supabase
          .from("user_units_access")
          .select("user_id, unit:units!unit_id(name)")
          .in("user_id", specificIds);
        for (const a of (access as unknown as {
          user_id: string;
          unit: { name: string } | null;
        }[]) ?? []) {
          if (!a.unit) continue;
          const list = unitNamesByUser.get(a.user_id) ?? [];
          list.push(a.unit.name);
          unitNamesByUser.set(a.user_id, list);
        }
      }

      return rows.map((r) => ({
        id: r.user_id,
        fullName: r.profile?.full_name ?? "Usuário",
        email: r.profile?.email ?? "",
        role: r.role,
        unidade:
          r.units_scope === "all"
            ? "Todas"
            : (unitNamesByUser.get(r.user_id) ?? []).join(", ") || "—",
        lastActivityAt: r.profile?.last_activity_at ?? null,
        ativo: r.is_active,
      }));
    },
  });
}

/** Convite genérico (Novo usuário) — sem vínculo com Employee. Diferente de
 * useInviteEmployeeLogin (queries/pessoas.ts), que existe especificamente
 * pro fluxo "criar login a partir de um cadastro em Cargos e Perfis" e faz
 * o passo extra de linkar employees.linked_user_id. Aqui não há employee
 * de origem — é convite direto, mesma mecânica de base (inviteOrgUser). */
export function useInviteOrgUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      orgId: string;
      email: string;
      fullName: string;
      role: OrgRole;
    }) => {
      return inviteOrgUser({ data: input });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usuariosKeys.all }),
  });
}

export function useUpdateUserRole() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      orgId,
      role,
    }: {
      userId: string;
      orgId: string;
      role: OrgRole;
    }) => {
      const { error } = await supabase
        .from("user_organizations")
        .update({ role })
        .eq("user_id", userId)
        .eq("org_id", orgId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usuariosKeys.all }),
  });
}

/** Ativa/inativa o vínculo do usuário com a organização — não é o mesmo
 * que inativar um Employee (Cargos e Perfis, Bloco 4): aqui é acesso ao
 * sistema; lá é o registro de RH. As duas coisas podem existir
 * independentemente uma da outra. */
export function useToggleUserActive() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      orgId,
      isActive,
    }: {
      userId: string;
      orgId: string;
      isActive: boolean;
    }) => {
      const { error } = await supabase
        .from("user_organizations")
        .update({ is_active: isActive })
        .eq("user_id", userId)
        .eq("org_id", orgId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usuariosKeys.all }),
  });
}
