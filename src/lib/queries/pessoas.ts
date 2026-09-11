import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { assertNotReadOnly } from "@/lib/org-access-guard";
import { inviteOrgUser } from "@/lib/invite-user-server";

/* ============================================================
 * Cargos e Perfis — módulo mais sensível migrado até agora (dado de
 * saúde/ASO e documento pessoal). SELECT de employees/attachments/
 * competency_actions é restrito a role admin/quality_manager OU ao
 * próprio funcionário (linked_user_id) — trava real é 100% RLS, não o
 * client (ver supabase/migrations/20260825090100 para a decisão sobre
 * GRANT). "Cargo" (job_positions) é conceito de RH, nunca confundir com
 * perfil de acesso (user_organizations.role).
 * ============================================================ */

export type CompetencySituation = "atende" | "atende_parcialmente" | "nao_atende";
export type AttachmentCategory =
  | "certificado_escolaridade"
  | "diploma"
  | "curso_extra"
  | "aso"
  | "outros";

/** Alfabético (seção 21.7 do Guia). */
export const ATTACHMENT_CATEGORY_OPTIONS: { value: AttachmentCategory; label: string }[] = [
  { value: "certificado_escolaridade", label: "Certificado de Escolaridade" },
  { value: "curso_extra", label: "Curso Extra" },
  { value: "diploma", label: "Diploma" },
  { value: "aso", label: "ASO" },
  { value: "outros", label: "Outros" },
];

export const SITUATION_OPTIONS: { value: CompetencySituation; label: string }[] = [
  { value: "atende", label: "Atende" },
  { value: "atende_parcialmente", label: "Atende Parcialmente" },
  { value: "nao_atende", label: "Não Atende" },
];

export interface JobPositionTraining {
  id: string;
  trainingName: string;
  isRequired: boolean;
}

export interface JobPosition {
  id: string;
  nome: string;
  requisitosTecnicos: string;
  requisitosDesejaveis: string;
  responsabilidadesAutoridades: string;
  isActive: boolean;
  /** Preenchido só por useJobPositions (soma de employees.job_position_id).
   * Ausente no retorno de outros hooks que também usam JobPosition. */
  peopleCount?: number;
  trainings: JobPositionTraining[];
}

const jobPositionKeys = {
  all: ["job-positions"] as const,
  list: () => [...jobPositionKeys.all, "list"] as const,
};

export function useJobPositions(includeInactive = false) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: [...jobPositionKeys.list(), includeInactive],
    queryFn: async (): Promise<JobPosition[]> => {
      let query = supabase
        .from("job_positions")
        .select(
          "id, nome, requisitos_tecnicos, requisitos_desejaveis, responsabilidades_autoridades, is_active, job_position_trainings(id, training_name, is_required)",
        )
        .order("nome");
      if (!includeInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      const rows =
        (data as unknown as {
          id: string;
          nome: string;
          requisitos_tecnicos: string | null;
          requisitos_desejaveis: string | null;
          responsabilidades_autoridades: string | null;
          is_active: boolean;
          job_position_trainings: { id: string; training_name: string; is_required: boolean }[];
        }[]) ?? [];
      if (rows.length === 0) return [];

      // "Pessoas no Cargo" (print do Bloco 4): contagem separada — RLS de
      // job_positions não exige can_manage_hr_structure, mas employees exige
      // (ou self); quem não gerencia RH recebe 0 aqui em vez de erro, o que
      // é o comportamento correto (não vê a contagem de terceiros).
      const { data: emp } = await supabase
        .from("employees")
        .select("job_position_id")
        .eq("is_active", true)
        .in(
          "job_position_id",
          rows.map((r) => r.id),
        );
      const countByPosition = new Map<string, number>();
      for (const e of (emp as unknown as { job_position_id: string | null }[]) ?? []) {
        if (!e.job_position_id) continue;
        countByPosition.set(e.job_position_id, (countByPosition.get(e.job_position_id) ?? 0) + 1);
      }

      return rows.map((p) => ({
        id: p.id,
        nome: p.nome,
        requisitosTecnicos: p.requisitos_tecnicos ?? "",
        requisitosDesejaveis: p.requisitos_desejaveis ?? "",
        responsabilidadesAutoridades: p.responsabilidades_autoridades ?? "",
        isActive: p.is_active,
        peopleCount: countByPosition.get(p.id) ?? 0,
        trainings: (p.job_position_trainings ?? []).map((t) => ({
          id: t.id,
          trainingName: t.training_name,
          isRequired: t.is_required,
        })),
      }));
    },
  });
}

export function useCreateJobPosition() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      requisitosTecnicos: string;
      requisitosDesejaveis: string;
      responsabilidadesAutoridades: string;
      trainings: { trainingName: string; isRequired: boolean }[];
    }) => {
      const { data: position, error: posErr } = await supabase
        .from("job_positions")
        .insert({
          nome: input.nome,
          requisitos_tecnicos: input.requisitosTecnicos || null,
          requisitos_desejaveis: input.requisitosDesejaveis || null,
          responsabilidades_autoridades: input.responsabilidadesAutoridades || null,
        })
        .select("id")
        .single();
      if (posErr) throw posErr;

      if (input.trainings.length > 0) {
        const { error: trainErr } = await supabase.from("job_position_trainings").insert(
          input.trainings.map((t) => ({
            job_position_id: position.id,
            training_name: t.trainingName,
            is_required: t.isRequired,
          })),
        );
        if (trainErr) throw trainErr;
      }

      return position as { id: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobPositionKeys.all }),
  });
}

/** Edita cargo e substitui a lista de treinamentos. Substituição inteira
 * (delete + insert) em vez de diff campo a campo: job_position_trainings
 * é a lista VIGENTE de requisitos do cargo, não um registro de auditoria
 * — mais parecido com uma lista de tags que se reescreve a cada edição do
 * que com uma NC ou plano de ação. Por isso a migração do Bloco 4 abriu
 * DELETE nesta tabela especificamente (restrito a quem gerencia RH),
 * diferente de employees/job_positions, cuja própria linha nunca é
 * apagada — só inativada. */
export function useUpdateJobPosition() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      nome: string;
      requisitosTecnicos: string;
      requisitosDesejaveis: string;
      responsabilidadesAutoridades: string;
      trainings: { trainingName: string; isRequired: boolean }[];
    }) => {
      const { error: posErr } = await supabase
        .from("job_positions")
        .update({
          nome: input.nome,
          requisitos_tecnicos: input.requisitosTecnicos || null,
          requisitos_desejaveis: input.requisitosDesejaveis || null,
          responsabilidades_autoridades: input.responsabilidadesAutoridades || null,
        })
        .eq("id", input.id);
      if (posErr) throw posErr;

      const { error: delErr } = await supabase
        .from("job_position_trainings")
        .delete()
        .eq("job_position_id", input.id);
      if (delErr) throw delErr;

      if (input.trainings.length > 0) {
        const { error: trainErr } = await supabase.from("job_position_trainings").insert(
          input.trainings.map((t) => ({
            job_position_id: input.id,
            training_name: t.trainingName,
            is_required: t.isRequired,
          })),
        );
        if (trainErr) throw trainErr;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobPositionKeys.all }),
  });
}

/** "Excluir" cargo (item 1) — mesma lógica de useDeactivateEmployee:
 * job_positions também tem DELETE bloqueado, então é inativação. */
export function useDeactivateJobPosition() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("job_positions")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobPositionKeys.all }),
  });
}

export interface Employee {
  id: string;
  nome: string;
  matricula: string;
  email: string;
  admissao: string | null;
  jobPositionId: string | null;
  jobPositionNome: string | null;
  setor: string;
  situacaoCompetencia: CompetencySituation;
  linkedUserId: string | null;
  isActive: boolean;
  hasOpenCompetencyAction: boolean;
  /** Quantas ações de competência abertas — o print do Bloco 4 mostra
   * contagem e status ("1 ação(ões) · em andamento"), não só um booleano. */
  openCompetencyActionCount: number;
  /** Quantos treinamentos OBRIGATÓRIOS do cargo desta pessoa ela ainda não
   * concluiu (nenhuma sessão 'realizada' com presença registrada). Coluna
   * "Pendência" do print — distinta de Situação da Competência (que é
   * autodeclarada) e de Ação de Competência (que é o PDI formal aberto). */
  pendingRequiredTrainings: number;
}

const employeeKeys = {
  all: ["employees"] as const,
  list: () => [...employeeKeys.all, "list"] as const,
  dossie: (id: string) => [...employeeKeys.all, "dossie", id] as const,
  mine: () => [...employeeKeys.all, "mine"] as const,
};

interface EmployeeListRow {
  id: string;
  nome: string;
  matricula: string | null;
  email: string | null;
  admissao: string | null;
  job_position_id: string | null;
  setor: string | null;
  situacao_competencia: CompetencySituation;
  linked_user_id: string | null;
  is_active?: boolean;
  job_position: { nome: string } | null;
  competency_actions?: { id: string }[];
}

function mapEmployeeRow(
  e: EmployeeListRow,
  extra?: { openCompetencyActionCount?: number; pendingRequiredTrainings?: number },
): Employee {
  return {
    id: e.id,
    nome: e.nome,
    matricula: e.matricula ?? "",
    email: e.email ?? "",
    admissao: e.admissao,
    jobPositionId: e.job_position_id,
    jobPositionNome: e.job_position?.nome ?? null,
    setor: e.setor ?? "",
    situacaoCompetencia: e.situacao_competencia,
    linkedUserId: e.linked_user_id,
    isActive: e.is_active ?? true,
    hasOpenCompetencyAction: (e.competency_actions ?? []).length > 0,
    openCompetencyActionCount:
      extra?.openCompetencyActionCount ?? (e.competency_actions ?? []).length,
    pendingRequiredTrainings: extra?.pendingRequiredTrainings ?? 0,
  };
}

/** Lista de funcionários — RLS já filtra: quem pode gerenciar RH vê todos
 * da org, qualquer outro perfil vê no máximo o próprio registro (ou
 * nenhum, se não tiver employees.linked_user_id apontando pra ele).
 *
 * `includeInactive`: as listagens de Cargos e Perfis mostram só quem está
 * ativo por padrão (item 1 do Bloco 4 — "excluir" é inativação, e quem foi
 * inativado sai da lista de trabalho do dia a dia, mas o registro continua
 * existindo para histórico). */
export function useEmployees(includeInactive = false) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: [...employeeKeys.list(), includeInactive],
    queryFn: async (): Promise<Employee[]> => {
      let query = supabase
        .from("employees")
        .select(
          "id, nome, matricula, email, admissao, job_position_id, setor, situacao_competencia, linked_user_id, is_active, job_position:job_positions!job_position_id(nome)",
        )
        .order("nome");
      if (!includeInactive) query = query.eq("is_active", true);
      const { data: all, error: allErr } = await query;
      if (allErr) throw allErr;
      const rows = (all as unknown as Omit<EmployeeListRow, "competency_actions">[]) ?? [];
      if (rows.length === 0) return [];

      // Contagem de ações de competência abertas, por funcionário. Consulta
      // separada (não embutida no select acima) porque contagem por grupo
      // via PostgREST embed não dá pra combinar com `is_active` filtrado no
      // pai — mais simples cruzar em memória, e o volume aqui (funcionários
      // de uma empresa) não justifica RPC dedicada.
      const { data: openActions, error: actErr } = await supabase
        .from("competency_actions")
        .select("employee_id")
        .eq("status", "aberta")
        .in(
          "employee_id",
          rows.map((r) => r.id),
        );
      if (actErr) throw actErr;
      const actionCountByEmployee = new Map<string, number>();
      for (const a of (openActions as unknown as { employee_id: string }[]) ?? []) {
        actionCountByEmployee.set(
          a.employee_id,
          (actionCountByEmployee.get(a.employee_id) ?? 0) + 1,
        );
      }

      const pendingByEmployee = await computePendingRequiredTrainings(supabase, rows);

      return rows.map((e) =>
        mapEmployeeRow(e, {
          openCompetencyActionCount: actionCountByEmployee.get(e.id) ?? 0,
          pendingRequiredTrainings: pendingByEmployee.get(e.id) ?? 0,
        }),
      );
    },
  });
}

/** Treinamento obrigatório do cargo (job_position_trainings.training_name,
 * texto livre) versus treinamento que a pessoa já concluiu (presença
 * confirmada numa sessão 'realizada' do treinamento com esse mesmo nome no
 * catálogo). Casamento por NOME, não por FK — job_position_trainings nunca
 * referenciou trainings.id, é texto digitado na hora de montar o perfil do
 * cargo. Cargo apontando para um nome que não existe (mais) no catálogo
 * conta como pendente — não tem sessão nenhuma para satisfazer aquele
 * requisito. */
async function computePendingRequiredTrainings(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  employees: { id: string; job_position_id: string | null }[],
): Promise<Map<string, number>> {
  const positionIds = [
    ...new Set(employees.map((e) => e.job_position_id).filter(Boolean)),
  ] as string[];
  if (positionIds.length === 0) return new Map();

  const { data: required, error: reqErr } = await supabase
    .from("job_position_trainings")
    .select("job_position_id, training_name")
    .eq("is_required", true)
    .in("job_position_id", positionIds);
  if (reqErr) throw reqErr;
  const requiredRows =
    (required as unknown as { job_position_id: string; training_name: string }[]) ?? [];
  if (requiredRows.length === 0) return new Map();

  const requiredByPosition = new Map<string, Set<string>>();
  for (const r of requiredRows) {
    if (!requiredByPosition.has(r.job_position_id))
      requiredByPosition.set(r.job_position_id, new Set());
    requiredByPosition.get(r.job_position_id)!.add(r.training_name);
  }

  // Quem concluiu o quê: presença confirmada numa sessão já realizada.
  const { data: done, error: doneErr } = await supabase
    .from("training_participants")
    .select(
      "employee_id, presente, training_sessions!inner(status, training:trainings!training_id(nome))",
    )
    .eq("presente", true)
    .eq("training_sessions.status", "realizada")
    .in(
      "employee_id",
      employees.map((e) => e.id),
    );
  if (doneErr) throw doneErr;
  const doneRows =
    (done as unknown as {
      employee_id: string;
      training_sessions: { training: { nome: string } | null } | null;
    }[]) ?? [];
  const completedByEmployee = new Map<string, Set<string>>();
  for (const d of doneRows) {
    const nome = d.training_sessions?.training?.nome;
    if (!nome) continue;
    if (!completedByEmployee.has(d.employee_id)) completedByEmployee.set(d.employee_id, new Set());
    completedByEmployee.get(d.employee_id)!.add(nome);
  }

  const result = new Map<string, number>();
  for (const e of employees) {
    if (!e.job_position_id) continue;
    const required = requiredByPosition.get(e.job_position_id);
    if (!required || required.size === 0) continue;
    const completed = completedByEmployee.get(e.id) ?? new Set<string>();
    let pendentes = 0;
    for (const nome of required) if (!completed.has(nome)) pendentes++;
    if (pendentes > 0) result.set(e.id, pendentes);
  }
  return result;
}

export function useCreateEmployee() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      matricula: string;
      email: string;
      admissao: string;
      jobPositionId: string;
      setor: string;
    }) => {
      const { error } = await supabase.from("employees").insert({
        nome: input.nome,
        matricula: input.matricula || null,
        email: input.email || null,
        admissao: input.admissao || null,
        job_position_id: input.jobPositionId || null,
        setor: input.setor || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeKeys.list() }),
  });
}

export function useUpdateEmployee() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{
        nome: string;
        matricula: string;
        email: string;
        admissao: string;
        job_position_id: string;
        setor: string;
        situacao_competencia: CompetencySituation;
        is_active: boolean;
        linked_user_id: string;
      }>;
    }) => {
      const { error } = await supabase.from("employees").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.all });
      queryClient.invalidateQueries({ queryKey: employeeKeys.dossie(vars.id) });
    },
  });
}

/** "Excluir" em Cargos e Perfis (item 1) — employees tem DELETE bloqueado
 * no banco (nada apaga, seção 20 do Guia), então isto é UPDATE de
 * is_active, não um DELETE de verdade. Sem motivo obrigatório: decisão
 * explícita, corrigir um cadastro errado não pede justificativa formal. */
/** Item 3 do Bloco 4: cria o login e já linka ao registro de employee, num
 * único passo do ponto de vista do chamador.
 *
 * O import de inviteOrgUser (lib/server/invite-user, um createServerFn)
 * fica AQUI, não em cargos.tsx: o bundler do TanStack Start bloqueia
 * import direto de qualquer caminho `**\/server/**` a partir de um
 * componente de rota (import-protection plugin) — só passa se houver uma
 * camada de queries no meio, mesmo padrão que o jawda-admin já usa
 * (lib/queries/user-management.ts envolvendo lib/server/invite-owner.ts).
 * Sem essa indireção, o build falha, não só um lint. */
export function useInviteEmployeeLogin() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      employeeId: string;
      orgId: string;
      email: string;
      fullName: string;
      role: "admin" | "quality_manager" | "auditor" | "area_manager" | "collaborator" | "viewer";
    }) => {
      const { userId } = await inviteOrgUser({
        data: {
          orgId: input.orgId,
          email: input.email,
          fullName: input.fullName,
          role: input.role,
        },
      });
      const { error } = await supabase
        .from("employees")
        .update({ linked_user_id: userId })
        .eq("id", input.employeeId);
      if (error) throw error;
      return { userId };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}

export function useDeactivateEmployee() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}

export interface EmployeeAttachment {
  id: string;
  category: AttachmentCategory;
  filePath: string;
  uploadedAt: string;
  source: "dossie" | "acao_competencia";
}

export interface CompetencyAction {
  id: string;
  methodology: string;
  expectedDate: string;
  completionDate: string | null;
  status: "aberta" | "concluida";
}

export interface DossieEffectivenessEvaluation {
  sessionId: string;
  trainingNome: string;
  metodo: string;
  resultado: string;
  avaliadoEm: string;
}

export interface EmployeeDossie {
  employee: Employee;
  attachments: EmployeeAttachment[];
  competencyActions: CompetencyAction[];
  effectivenessEvaluations: DossieEffectivenessEvaluation[];
}

/** Dossiê individual — SELECT já é logado pela política de RLS +
 * log_employee_dossie_access (chamado logo abaixo, como efeito colateral
 * intencional da query). Ver decisão em 20260825090100: a RLS de
 * `employees` é a única barreira real; esta RPC só registra que a
 * leitura aconteceu. */
export function useEmployeeDossie(employeeId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: employeeKeys.dossie(employeeId ?? ""),
    enabled: !!employeeId,
    queryFn: async (): Promise<EmployeeDossie> => {
      const { data: employee, error: empErr } = await supabase
        .from("employees")
        .select(
          "id, nome, matricula, email, admissao, job_position_id, setor, situacao_competencia, linked_user_id, job_position:job_positions!job_position_id(nome)",
        )
        .eq("id", employeeId as string)
        .single();
      if (empErr) throw empErr;

      await supabase.rpc("log_employee_dossie_access", { p_employee_id: employeeId as string });

      const { data: attachments, error: attErr } = await supabase
        .from("employee_attachments")
        .select("id, category, file_url, uploaded_at, source")
        .eq("employee_id", employeeId as string)
        .order("uploaded_at", { ascending: false });
      if (attErr) throw attErr;

      const { data: actions, error: actErr } = await supabase
        .from("competency_actions")
        .select("id, methodology, expected_date, completion_date, status")
        .eq("employee_id", employeeId as string)
        .order("created_at", { ascending: false });
      if (actErr) throw actErr;

      // "Fica salvo no dossiê" — sem duplicar linha por empregado: a
      // avaliação é por TURMA (training_effectiveness_evaluations), e
      // aparece aqui via join com as turmas em que este empregado participou.
      const { data: effectiveness, error: effErr } = await supabase
        .from("training_participants")
        .select(
          "training_session_id, training_sessions!inner(training:trainings!training_id(nome), training_effectiveness_evaluations(id, metodo, resultado, avaliado_em))",
        )
        .eq("employee_id", employeeId as string);
      if (effErr) throw effErr;

      return {
        employee: mapEmployeeRow({
          ...(employee as unknown as EmployeeListRow),
          competency_actions: [],
        }),
        attachments: (
          (attachments as unknown as {
            id: string;
            category: AttachmentCategory;
            file_url: string;
            uploaded_at: string;
            source: "dossie" | "acao_competencia";
          }[]) ?? []
        ).map((a) => ({
          id: a.id,
          category: a.category,
          filePath: a.file_url,
          uploadedAt: a.uploaded_at,
          source: a.source,
        })),
        competencyActions: (
          (actions as unknown as {
            id: string;
            methodology: string;
            expected_date: string;
            completion_date: string | null;
            status: "aberta" | "concluida";
          }[]) ?? []
        ).map((a) => ({
          id: a.id,
          methodology: a.methodology,
          expectedDate: a.expected_date,
          completionDate: a.completion_date,
          status: a.status,
        })),
        effectivenessEvaluations: (
          (effectiveness as unknown as {
            training_session_id: string;
            training_sessions: {
              training: { nome: string } | null;
              training_effectiveness_evaluations: {
                id: string;
                metodo: string;
                resultado: string;
                avaliado_em: string;
              }[];
            };
          }[]) ?? []
        ).flatMap((p) =>
          (p.training_sessions.training_effectiveness_evaluations ?? []).map((ev) => ({
            sessionId: p.training_session_id,
            trainingNome: p.training_sessions.training?.nome ?? "",
            metodo: ev.metodo,
            resultado: ev.resultado,
            avaliadoEm: ev.avaliado_em,
          })),
        ),
      };
    },
  });
}

/** Autoatendimento do perfil comum — RLS resolve sozinha (linked_user_id
 * = auth.uid()); `maybeSingle` porque nem todo usuário tem um registro de
 * funcionário vinculado. */
export function useMyEmployeeRecord() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: employeeKeys.mine(),
    queryFn: async (): Promise<Employee | null> => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, nome, matricula, email, admissao, job_position_id, setor, situacao_competencia, linked_user_id, job_position:job_positions!job_position_id(nome)",
        )
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapEmployeeRow({ ...(data as unknown as EmployeeListRow), competency_actions: [] });
    },
  });
}

const DOSSIE_BUCKET = "pessoas-dossie";

export function useUploadEmployeeAttachment() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      orgId,
      category,
      source,
      file,
    }: {
      employeeId: string;
      orgId: string;
      category: AttachmentCategory;
      source: "dossie" | "acao_competencia";
      file: File;
    }) => {
      const path = `${orgId}/employees/${employeeId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from(DOSSIE_BUCKET).upload(path, file);
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("employee_attachments").insert({
        employee_id: employeeId,
        category,
        file_url: path,
        source,
      });
      if (insertErr) throw insertErr;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({ queryKey: employeeKeys.dossie(vars.employeeId) }),
  });
}

export function useEmployeeAttachmentSignedUrl() {
  const supabase = getSupabaseBrowserClient();
  return useMutation({
    mutationFn: async (path: string) => {
      const { data, error } = await supabase.storage.from(DOSSIE_BUCKET).createSignedUrl(path, 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function useCreateCompetencyAction() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      methodology,
      expectedDate,
    }: {
      employeeId: string;
      methodology: string;
      expectedDate: string;
    }) => {
      const { error } = await supabase
        .from("competency_actions")
        .insert({ employee_id: employeeId, methodology, expected_date: expectedDate });
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({ queryKey: employeeKeys.dossie(vars.employeeId) }),
  });
}

export function useCompleteCompetencyAction() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, employeeId }: { id: string; employeeId: string }) => {
      const { error } = await supabase
        .from("competency_actions")
        .update({ status: "concluida", completion_date: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({ queryKey: employeeKeys.dossie(vars.employeeId) }),
  });
}

/* ---------- LGPD gate ---------- */

export function useLgpdAcceptance() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["lgpd-acceptance"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from("lgpd_acceptances").select("id").maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useAcceptLgpd() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lgpd_acceptances").insert({});
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lgpd-acceptance"] }),
  });
}

/* ---------- Termo de Ciência (autoatendimento) ---------- */

export interface AwarenessTermSignature {
  id: string;
  signedAt: string;
  validUntil: string;
}

export function useLatestAwarenessTermSignature(employeeId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["awareness-term-signature", employeeId],
    enabled: !!employeeId,
    queryFn: async (): Promise<AwarenessTermSignature | null> => {
      const { data, error } = await supabase
        .from("awareness_terms_signatures")
        .select("id, signed_at, valid_until")
        .eq("employee_id", employeeId as string)
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as { id: string; signed_at: string; valid_until: string };
      return { id: row.id, signedAt: row.signed_at, validUntil: row.valid_until };
    },
  });
}

export function useSignAwarenessTerm() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      contentSnapshot,
    }: {
      employeeId: string;
      contentSnapshot: string;
    }) => {
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1);
      const { error } = await supabase.from("awareness_terms_signatures").insert({
        employee_id: employeeId,
        content_snapshot: contentSnapshot,
        valid_until: validUntil.toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({ queryKey: ["awareness-term-signature", vars.employeeId] }),
  });
}

/* ============================================================
 * Gestão de Aprendizagem
 * ============================================================ */

export type TrainingModality = "ead" | "externo" | "interno" | "misto";

/** Alfabético (seção 21.7). */
export const MODALITY_OPTIONS: { value: TrainingModality; label: string }[] = [
  { value: "ead", label: "EAD" },
  { value: "externo", label: "Externo" },
  { value: "interno", label: "Interno" },
  { value: "misto", label: "Misto" },
];

export type CargaHorariaUnidade = "hora" | "minuto";

export interface Training {
  id: string;
  nome: string;
  cargaHoraria: number | null;
  cargaHorariaUnidade: CargaHorariaUnidade;
  instrutorFornecedor: string;
  modalidade: TrainingModality;
}

const trainingKeys = {
  all: ["trainings"] as const,
  list: () => [...trainingKeys.all, "list"] as const,
  applicability: () => [...trainingKeys.all, "applicability"] as const,
  sessions: () => [...trainingKeys.all, "sessions"] as const,
};

export function useTrainings() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: trainingKeys.list(),
    queryFn: async (): Promise<Training[]> => {
      const { data, error } = await supabase
        .from("trainings")
        .select("id, nome, carga_horaria, carga_horaria_unidade, instrutor_fornecedor, modalidade")
        .order("nome");
      if (error) throw error;
      return (
        (data as unknown as {
          id: string;
          nome: string;
          carga_horaria: number | null;
          carga_horaria_unidade: CargaHorariaUnidade;
          instrutor_fornecedor: string | null;
          modalidade: TrainingModality;
        }[]) ?? []
      ).map((t) => ({
        id: t.id,
        nome: t.nome,
        cargaHoraria: t.carga_horaria,
        cargaHorariaUnidade: t.carga_horaria_unidade,
        instrutorFornecedor: t.instrutor_fornecedor ?? "",
        modalidade: t.modalidade,
      }));
    },
  });
}

interface TrainingInput {
  nome: string;
  cargaHoraria: number | null;
  cargaHorariaUnidade: CargaHorariaUnidade;
  instrutorFornecedor: string;
  modalidade: TrainingModality;
}

export function useCreateTraining() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TrainingInput) => {
      const { error } = await supabase.from("trainings").insert({
        nome: input.nome,
        carga_horaria: input.cargaHoraria,
        carga_horaria_unidade: input.cargaHorariaUnidade,
        instrutor_fornecedor: input.instrutorFornecedor || null,
        modalidade: input.modalidade,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainingKeys.list() }),
  });
}

/** Item 6 do Bloco 4: editar treinamento nunca existiu — só create. RLS já
 * permitia UPDATE, faltava a mutation e o botão. */
export function useUpdateTraining() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: TrainingInput & { id: string }) => {
      const { error } = await supabase
        .from("trainings")
        .update({
          nome: input.nome,
          carga_horaria: input.cargaHoraria,
          carga_horaria_unidade: input.cargaHorariaUnidade,
          instrutor_fornecedor: input.instrutorFornecedor || null,
          modalidade: input.modalidade,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainingKeys.list() }),
  });
}

export interface ApplicabilityCell {
  id: string;
  trainingId: string;
  jobPositionId: string;
}

export function useTrainingApplicability() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: trainingKeys.applicability(),
    queryFn: async (): Promise<ApplicabilityCell[]> => {
      const { data, error } = await supabase
        .from("training_applicability")
        .select("id, training_id, job_position_id");
      if (error) throw error;
      return (
        (data as unknown as { id: string; training_id: string; job_position_id: string }[]) ?? []
      ).map((r) => ({ id: r.id, trainingId: r.training_id, jobPositionId: r.job_position_id }));
    },
  });
}

export function useSetTrainingApplicability() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      trainingId,
      jobPositionId,
      applicable,
    }: {
      trainingId: string;
      jobPositionId: string;
      applicable: boolean;
    }) => {
      if (applicable) {
        const { error } = await supabase
          .from("training_applicability")
          .insert({ training_id: trainingId, job_position_id: jobPositionId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("training_applicability")
          .delete()
          .eq("training_id", trainingId)
          .eq("job_position_id", jobPositionId);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainingKeys.applicability() }),
  });
}

export interface TrainingSession {
  id: string;
  trainingId: string;
  trainingNome: string;
  dataPlanejada: string;
  dataRealizacao: string | null;
  status: "planejada" | "realizada" | "cancelada";
  participantCount: number;
}

export function useTrainingSessions() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: trainingKeys.sessions(),
    queryFn: async (): Promise<TrainingSession[]> => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select(
          "id, training_id, data_planejada, data_realizacao, status, training:trainings!training_id(nome), training_participants(count)",
        )
        .order("data_planejada", { ascending: false });
      if (error) throw error;
      return (
        (data as unknown as {
          id: string;
          training_id: string;
          data_planejada: string;
          data_realizacao: string | null;
          status: "planejada" | "realizada" | "cancelada";
          training: { nome: string } | null;
          training_participants: { count: number }[];
        }[]) ?? []
      ).map((s) => ({
        id: s.id,
        trainingId: s.training_id,
        trainingNome: s.training?.nome ?? "",
        dataPlanejada: s.data_planejada,
        dataRealizacao: s.data_realizacao,
        status: s.status,
        participantCount: s.training_participants?.[0]?.count ?? 0,
      }));
    },
  });
}

export function useCreateTrainingSession() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      trainingId,
      dataPlanejada,
      employeeIds,
    }: {
      trainingId: string;
      dataPlanejada: string;
      employeeIds: string[];
    }) => {
      const { data: session, error: sessErr } = await supabase
        .from("training_sessions")
        .insert({ training_id: trainingId, data_planejada: dataPlanejada })
        .select("id")
        .single();
      if (sessErr) throw sessErr;

      if (employeeIds.length > 0) {
        const { error: partErr } = await supabase.from("training_participants").insert(
          employeeIds.map((employeeId) => ({
            training_session_id: session.id,
            employee_id: employeeId,
          })),
        );
        if (partErr) throw partErr;
      }
      return session as { id: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainingKeys.sessions() }),
  });
}

export interface TrainingParticipant {
  id: string;
  employeeId: string;
  employeeNome: string;
  presente: boolean;
  eficacia: "eficaz" | "nao_eficaz" | null;
}

export function useTrainingSessionParticipants(sessionId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["training-session-participants", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<TrainingParticipant[]> => {
      const { data, error } = await supabase
        .from("training_participants")
        .select("id, employee_id, presente, eficacia, employee:employees!employee_id(nome)")
        .eq("training_session_id", sessionId as string);
      if (error) throw error;
      return (
        (data as unknown as {
          id: string;
          employee_id: string;
          presente: boolean;
          eficacia: "eficaz" | "nao_eficaz" | null;
          employee: { nome: string } | null;
        }[]) ?? []
      ).map((p) => ({
        id: p.id,
        employeeId: p.employee_id,
        employeeNome: p.employee?.nome ?? "",
        presente: p.presente,
        eficacia: p.eficacia,
      }));
    },
  });
}

export function useUpdateTrainingParticipant() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      sessionId,
      patch,
    }: {
      id: string;
      sessionId: string;
      patch: Partial<{ presente: boolean; eficacia: "eficaz" | "nao_eficaz" }>;
    }) => {
      const { error } = await supabase.from("training_participants").update(patch).eq("id", id);
      if (error) throw error;
      return sessionId;
    },
    onSuccess: (sessionId) =>
      queryClient.invalidateQueries({ queryKey: ["training-session-participants", sessionId] }),
  });
}

/* ============================================================
 * Aditivo ao Bloco 4 — Avaliação de Eficácia do Treinamento.
 *
 * Dois formulários complementares (ver migração 20260913090200):
 *   a) training_session_feedback — o participante avalia a própria
 *      satisfação, logo após a turma acontecer.
 *   b) training_effectiveness_evaluations — o Gestor da Qualidade avalia
 *      se o treinamento realmente formou, só para turmas >4h e só depois
 *      do prazo configurável (hr_learning_settings).
 * ============================================================ */

/** "Marcar como realizada" nunca existiu na UI — pré-requisito descoberto
 * ao investigar este aditivo: sem isso, nenhuma turma teria data de
 * realização real, e os dois formulários abaixo nunca ficariam elegíveis. */
export function useMarkTrainingSessionRealizada() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dataRealizacao }: { id: string; dataRealizacao: string }) => {
      const { error } = await supabase
        .from("training_sessions")
        .update({ status: "realizada", data_realizacao: dataRealizacao })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trainingKeys.sessions() }),
  });
}

export const EFFECTIVENESS_PRAZO_OPTIONS = [15, 30, 60] as const;

/** `hr_learning_settings` só ganha linha quando alguém salva pela primeira
 * vez — organização nova não tem registro ainda, por isso o default (30)
 * é aplicado no cliente quando a busca vem vazia, e não só no banco. */
export function useHrLearningSettings() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["hr-learning-settings"],
    queryFn: async (): Promise<{ prazoAvaliacaoEficaciaDias: number }> => {
      const { data, error } = await supabase
        .from("hr_learning_settings")
        .select("avaliacao_eficacia_prazo_dias")
        .maybeSingle();
      if (error) throw error;
      const row = data as unknown as { avaliacao_eficacia_prazo_dias: number } | null;
      return { prazoAvaliacaoEficaciaDias: row?.avaliacao_eficacia_prazo_dias ?? 30 };
    },
  });
}

export function useUpdateHrLearningSettings() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, prazoDias }: { orgId: string; prazoDias: number }) => {
      const { error } = await supabase
        .from("hr_learning_settings")
        .upsert(
          { org_id: orgId, avaliacao_eficacia_prazo_dias: prazoDias },
          { onConflict: "org_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hr-learning-settings"] }),
  });
}

/** Turma vira elegível pra avaliação de eficácia quando: realizada, carga
 * horária (normalizada pra horas) > 4h, e já passou o prazo configurável
 * contado da data de realização. Normalização e prazo ficam no cliente —
 * não há coluna computada no banco pra isso, e o gate é regra de fluxo de
 * trabalho, não de segurança (a RLS só exige "realizada", ver migração
 * 20260913090300). */
function cargaHorariaEmHoras(cargaHoraria: number | null, unidade: CargaHorariaUnidade): number {
  if (cargaHoraria === null) return 0;
  return unidade === "minuto" ? cargaHoraria / 60 : cargaHoraria;
}

export interface EligibleEffectivenessSession {
  sessionId: string;
  trainingNome: string;
  dataRealizacao: string;
  cargaHorariaHoras: number;
  jaAvaliada: boolean;
}

export function useEligibleEffectivenessSessions() {
  const supabase = getSupabaseBrowserClient();
  const { data: settings } = useHrLearningSettings();
  const prazoDias = settings?.prazoAvaliacaoEficaciaDias ?? 30;
  return useQuery({
    queryKey: ["training-effectiveness-eligible", prazoDias],
    queryFn: async (): Promise<EligibleEffectivenessSession[]> => {
      const { data, error } = await supabase
        .from("training_sessions")
        .select(
          "id, data_realizacao, training:trainings!training_id(nome, carga_horaria, carga_horaria_unidade), training_effectiveness_evaluations(id)",
        )
        .eq("status", "realizada")
        .not("data_realizacao", "is", null)
        .order("data_realizacao", { ascending: false });
      if (error) throw error;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      return (
        (data as unknown as {
          id: string;
          data_realizacao: string;
          training: {
            nome: string;
            carga_horaria: number | null;
            carga_horaria_unidade: CargaHorariaUnidade;
          } | null;
          training_effectiveness_evaluations: { id: string }[];
        }[]) ?? []
      )
        .map((s) => ({
          sessionId: s.id,
          trainingNome: s.training?.nome ?? "",
          dataRealizacao: s.data_realizacao,
          cargaHorariaHoras: cargaHorariaEmHoras(
            s.training?.carga_horaria ?? null,
            s.training?.carga_horaria_unidade ?? "hora",
          ),
          jaAvaliada: (s.training_effectiveness_evaluations?.length ?? 0) > 0,
        }))
        .filter((s) => {
          if (s.cargaHorariaHoras <= 4) return false;
          const prazoAtingidoEm = new Date(s.dataRealizacao + "T00:00:00");
          prazoAtingidoEm.setDate(prazoAtingidoEm.getDate() + prazoDias);
          return prazoAtingidoEm <= hoje;
        });
    },
  });
}

export const EFFECTIVENESS_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "aplicacao_teste", label: "Aplicação de teste" },
  { value: "entrevista_colaborador", label: "Entrevista com o colaborador" },
  { value: "observacao_atividade", label: "Observação de atividade" },
];

export interface EffectivenessEvaluation {
  id: string;
  metodo: string;
  resultado: string;
  avaliadoEm: string;
}

export function useEffectivenessEvaluation(sessionId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["training-effectiveness-evaluation", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<EffectivenessEvaluation | null> => {
      const { data, error } = await supabase
        .from("training_effectiveness_evaluations")
        .select("id, metodo, resultado, avaliado_em")
        .eq("training_session_id", sessionId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as {
        id: string;
        metodo: string;
        resultado: string;
        avaliado_em: string;
      };
      return {
        id: row.id,
        metodo: row.metodo,
        resultado: row.resultado,
        avaliadoEm: row.avaliado_em,
      };
    },
  });
}

export function useSubmitEffectivenessEvaluation() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      metodo,
      resultado,
    }: {
      sessionId: string;
      metodo: string;
      resultado: string;
    }) => {
      const { error } = await supabase
        .from("training_effectiveness_evaluations")
        .upsert(
          { training_session_id: sessionId, metodo, resultado },
          { onConflict: "training_session_id" },
        );
      if (error) throw error;
      return sessionId;
    },
    onSuccess: (sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["training-effectiveness-eligible"] });
      queryClient.invalidateQueries({ queryKey: ["training-effectiveness-evaluation", sessionId] });
    },
  });
}

export interface PendingTrainingFeedback {
  sessionId: string;
  trainingNome: string;
  dataRealizacao: string;
}

/** Turmas que EU (funcionário logado) participei, já realizadas, e ainda
 * não avaliei minha satisfação. Alimenta o pop-up "avalie o treinamento". */
export function usePendingTrainingFeedback(employeeId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["training-feedback-pending", employeeId],
    enabled: !!employeeId,
    queryFn: async (): Promise<PendingTrainingFeedback[]> => {
      const { data: participacoes, error: partErr } = await supabase
        .from("training_participants")
        .select(
          "training_session_id, training_sessions!inner(status, data_realizacao, training:trainings!training_id(nome))",
        )
        .eq("employee_id", employeeId as string)
        .eq("training_sessions.status", "realizada");
      if (partErr) throw partErr;

      const { data: respondidas, error: fbErr } = await supabase
        .from("training_session_feedback")
        .select("training_session_id")
        .eq("employee_id", employeeId as string);
      if (fbErr) throw fbErr;

      const respondidasIds = new Set(
        ((respondidas as unknown as { training_session_id: string }[]) ?? []).map(
          (r) => r.training_session_id,
        ),
      );

      return (
        (participacoes as unknown as {
          training_session_id: string;
          training_sessions: {
            status: string;
            data_realizacao: string | null;
            training: { nome: string } | null;
          };
        }[]) ?? []
      )
        .filter((p) => !respondidasIds.has(p.training_session_id))
        .map((p) => ({
          sessionId: p.training_session_id,
          trainingNome: p.training_sessions.training?.nome ?? "",
          dataRealizacao: p.training_sessions.data_realizacao ?? "",
        }));
    },
  });
}

export function useSubmitTrainingFeedback() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      employeeId,
      nivelSatisfacao,
      comentarios,
    }: {
      sessionId: string;
      employeeId: string;
      nivelSatisfacao: number;
      comentarios: string;
    }) => {
      const { error } = await supabase.from("training_session_feedback").insert({
        training_session_id: sessionId,
        employee_id: employeeId,
        nivel_satisfacao: nivelSatisfacao,
        comentarios: comentarios || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({
        queryKey: ["training-feedback-pending", vars.employeeId],
      }),
  });
}

export type AwarenessPublicationType = "informe" | "perguntas_respostas";

export interface AwarenessQuizOption {
  id: string;
  optionText: string;
  isCorrect: boolean;
}

export interface AwarenessPublication {
  id: string;
  tipo: AwarenessPublicationType;
  titulo: string;
  conteudo: string;
  publicoAlvo: string[];
  publishedAt: string;
  options: AwarenessQuizOption[];
}

const awarenessKeys = {
  all: ["awareness-publications"] as const,
  list: () => [...awarenessKeys.all, "list"] as const,
};

export function useAwarenessPublications() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: awarenessKeys.list(),
    queryFn: async (): Promise<AwarenessPublication[]> => {
      const { data, error } = await supabase
        .from("awareness_publications")
        .select(
          "id, tipo, titulo, conteudo, publico_alvo, published_at, awareness_quiz_options(id, option_text, is_correct)",
        )
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (
        (data as unknown as {
          id: string;
          tipo: AwarenessPublicationType;
          titulo: string;
          conteudo: string;
          publico_alvo: string[];
          published_at: string;
          awareness_quiz_options: { id: string; option_text: string; is_correct: boolean }[];
        }[]) ?? []
      ).map((p) => ({
        id: p.id,
        tipo: p.tipo,
        titulo: p.titulo,
        conteudo: p.conteudo,
        publicoAlvo: p.publico_alvo,
        publishedAt: p.published_at,
        options: (p.awareness_quiz_options ?? []).map((o) => ({
          id: o.id,
          optionText: o.option_text,
          isCorrect: o.is_correct,
        })),
      }));
    },
  });
}

export function useCreateAwarenessPublication() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tipo: AwarenessPublicationType;
      titulo: string;
      conteudo: string;
      options?: { optionText: string; isCorrect: boolean }[];
    }) => {
      const { data: pub, error: pubErr } = await supabase
        .from("awareness_publications")
        .insert({ tipo: input.tipo, titulo: input.titulo, conteudo: input.conteudo })
        .select("id")
        .single();
      if (pubErr) throw pubErr;

      if (input.options && input.options.length > 0) {
        const { error: optErr } = await supabase.from("awareness_quiz_options").insert(
          input.options.map((o, idx) => ({
            publication_id: pub.id,
            option_text: o.optionText,
            is_correct: o.isCorrect,
            item_order: idx,
          })),
        );
        if (optErr) throw optErr;
      }
      return pub as { id: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: awarenessKeys.list() }),
  });
}

export function useAcknowledgeAwarenessPublication() {
  const supabase = getSupabaseBrowserClient();
  return useMutation({
    mutationFn: async ({
      publicationId,
      employeeId,
    }: {
      publicationId: string;
      employeeId: string;
    }) => {
      const { error } = await supabase
        .from("awareness_acknowledgments")
        .insert({ publication_id: publicationId, employee_id: employeeId });
      if (error) throw error;
    },
  });
}

/* ============================================================
 * Avaliação de Desempenho
 *
 * "Avaliador" não é papel do sistema — é o vínculo
 * performance_evaluations.avaliador_user_id. RLS: vê quem é o avaliador
 * OU quem é admin (Alta Direção). Gestor da Qualidade só vê se ele mesmo
 * for avaliador de alguma avaliação específica.
 * ============================================================ */

export type PerformancePeriodicity = "anual" | "bienal" | "semestral" | "trimestral";

export const PERIODICITY_OPTIONS: { value: PerformancePeriodicity; label: string }[] = [
  { value: "anual", label: "Anual" },
  { value: "bienal", label: "Bienal" },
  { value: "semestral", label: "Semestral" },
  { value: "trimestral", label: "Trimestral" },
];

export interface PerformanceCycle {
  id: string;
  periodicidade: PerformancePeriodicity;
  metaMinima: number;
}

const performanceKeys = {
  all: ["performance"] as const,
  cycles: () => [...performanceKeys.all, "cycles"] as const,
  evaluations: () => [...performanceKeys.all, "evaluations"] as const,
  evaluationDetail: (id: string) => [...performanceKeys.all, "evaluation", id] as const,
};

export function usePerformanceCycles() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: performanceKeys.cycles(),
    queryFn: async (): Promise<PerformanceCycle[]> => {
      const { data, error } = await supabase
        .from("performance_cycles")
        .select("id, periodicidade, meta_minima")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (
        (data as unknown as {
          id: string;
          periodicidade: PerformancePeriodicity;
          meta_minima: number;
        }[]) ?? []
      ).map((c) => ({ id: c.id, periodicidade: c.periodicidade, metaMinima: c.meta_minima }));
    },
  });
}

export function useCreatePerformanceCycle() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { periodicidade: PerformancePeriodicity; metaMinima: number }) => {
      const { error } = await supabase
        .from("performance_cycles")
        .insert({ periodicidade: input.periodicidade, meta_minima: input.metaMinima });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: performanceKeys.cycles() }),
  });
}

export interface PerformanceEvaluationListItem {
  id: string;
  employeeId: string;
  employeeNome: string;
  cycleId: string;
  avaliadorUserId: string;
  avaliadorNome: string;
  status: "programada" | "em_andamento" | "concluida";
  scheduledAt: string;
  mediaGeral: number | null;
}

export function usePerformanceEvaluations() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: performanceKeys.evaluations(),
    queryFn: async (): Promise<PerformanceEvaluationListItem[]> => {
      const { data, error } = await supabase
        .from("performance_evaluations")
        .select(
          "id, employee_id, cycle_id, avaliador_user_id, status, scheduled_at, employee:employees!employee_id(nome), avaliador:profiles!avaliador_user_id(full_name), performance_cha_answers(nota)",
        )
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (
        (data as unknown as {
          id: string;
          employee_id: string;
          cycle_id: string;
          avaliador_user_id: string;
          status: "programada" | "em_andamento" | "concluida";
          scheduled_at: string;
          employee: { nome: string } | null;
          avaliador: { full_name: string } | null;
          performance_cha_answers: { nota: number }[];
        }[]) ?? []
      ).map((e) => {
        const notas = e.performance_cha_answers?.map((a) => a.nota) ?? [];
        const media = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
        return {
          id: e.id,
          employeeId: e.employee_id,
          employeeNome: e.employee?.nome ?? "",
          cycleId: e.cycle_id,
          avaliadorUserId: e.avaliador_user_id,
          avaliadorNome: e.avaliador?.full_name ?? "",
          status: e.status,
          scheduledAt: e.scheduled_at,
          mediaGeral: media,
        };
      });
    },
  });
}

export function useCreatePerformanceEvaluation() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      employeeId: string;
      cycleId: string;
      avaliadorUserId: string;
      scheduledAt: string;
    }) => {
      const { error } = await supabase.from("performance_evaluations").insert({
        employee_id: input.employeeId,
        cycle_id: input.cycleId,
        avaliador_user_id: input.avaliadorUserId,
        scheduled_at: input.scheduledAt,
        notified_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: performanceKeys.evaluations() }),
  });
}

export const CHA_QUESTIONS: Record<"conhecimento" | "habilidades" | "atitudes", string[]> = {
  conhecimento: [
    "Domina os procedimentos e normas técnicas da sua função?",
    "Conhece os requisitos da ISO 9001 aplicáveis ao seu trabalho?",
    "Compreende os processos e fluxos que impactam seu resultado?",
    "Busca atualização técnica de forma contínua?",
    "Aplica corretamente o conhecimento adquirido em treinamentos?",
  ],
  habilidades: [
    "Executa suas tarefas com qualidade e dentro do prazo?",
    "Resolve problemas do dia a dia com autonomia?",
    "Comunica-se com clareza com a equipe e outras áreas?",
    "Trabalha bem em equipe e colabora com colegas?",
    "Lida bem com mudanças e imprevistos?",
  ],
  atitudes: [
    "Demonstra comprometimento com os resultados da organização?",
    "Age de forma ética e coerente com os valores da empresa?",
    "Toma iniciativa diante de problemas e oportunidades?",
    "Recebe feedback de forma construtiva?",
    "Contribui para um ambiente de trabalho positivo?",
  ],
};

export interface PerformanceEvaluationDetail {
  id: string;
  employeeId: string;
  employeeNome: string;
  status: "programada" | "em_andamento" | "concluida";
  metaMinima: number;
  chaAnswers: { bloco: string; perguntaIndex: number; nota: number; detalhamento: string }[];
  decisionMatrix: {
    altoPotencial: number;
    cultura: number;
    tecnico: number;
    recomendacao: string;
  } | null;
  feedback: {
    devolutivaRegistro: string;
    devolutivaData: string;
    compartilhadoComAvaliado: boolean;
    generatedActionPlanId: string | null;
    generatedActionPlanCode: string | null;
  } | null;
}

export function usePerformanceEvaluationDetail(evaluationId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: performanceKeys.evaluationDetail(evaluationId ?? ""),
    enabled: !!evaluationId,
    queryFn: async (): Promise<PerformanceEvaluationDetail> => {
      const { data: evaluation, error: evalErr } = await supabase
        .from("performance_evaluations")
        .select(
          "id, employee_id, status, employee:employees!employee_id(nome), cycle:performance_cycles!cycle_id(meta_minima)",
        )
        .eq("id", evaluationId as string)
        .single();
      if (evalErr) throw evalErr;

      const { data: answers, error: ansErr } = await supabase
        .from("performance_cha_answers")
        .select("bloco, pergunta_index, nota, detalhamento")
        .eq("evaluation_id", evaluationId as string);
      if (ansErr) throw ansErr;

      const { data: matrix, error: matrixErr } = await supabase
        .from("performance_decision_matrix")
        .select("alto_potencial, cultura, tecnico, recomendacao")
        .eq("evaluation_id", evaluationId as string)
        .maybeSingle();
      if (matrixErr) throw matrixErr;

      const { data: feedback, error: fbErr } = await supabase
        .from("performance_feedback")
        .select(
          "devolutiva_registro, devolutiva_data, compartilhado_com_avaliado, generated_action_plan_id, generated_action_plan:action_plans!generated_action_plan_id(code)",
        )
        .eq("evaluation_id", evaluationId as string)
        .maybeSingle();
      if (fbErr) throw fbErr;

      const e = evaluation as unknown as {
        id: string;
        employee_id: string;
        status: "programada" | "em_andamento" | "concluida";
        employee: { nome: string } | null;
        cycle: { meta_minima: number } | null;
      };
      const m = matrix as unknown as {
        alto_potencial: number;
        cultura: number;
        tecnico: number;
        recomendacao: string | null;
      } | null;
      const f = feedback as unknown as {
        devolutiva_registro: string;
        devolutiva_data: string;
        compartilhado_com_avaliado: boolean;
        generated_action_plan_id: string | null;
        generated_action_plan: { code: string } | null;
      } | null;

      return {
        id: e.id,
        employeeId: e.employee_id,
        employeeNome: e.employee?.nome ?? "",
        status: e.status,
        metaMinima: e.cycle?.meta_minima ?? 7,
        chaAnswers: (
          (answers as unknown as {
            bloco: string;
            pergunta_index: number;
            nota: number;
            detalhamento: string | null;
          }[]) ?? []
        ).map((a) => ({
          bloco: a.bloco,
          perguntaIndex: a.pergunta_index,
          nota: a.nota,
          detalhamento: a.detalhamento ?? "",
        })),
        decisionMatrix: m
          ? {
              altoPotencial: m.alto_potencial,
              cultura: m.cultura,
              tecnico: m.tecnico,
              recomendacao: m.recomendacao ?? "",
            }
          : null,
        feedback: f
          ? {
              devolutivaRegistro: f.devolutiva_registro,
              devolutivaData: f.devolutiva_data,
              compartilhadoComAvaliado: f.compartilhado_com_avaliado,
              generatedActionPlanId: f.generated_action_plan_id,
              generatedActionPlanCode: f.generated_action_plan?.code ?? null,
            }
          : null,
      };
    },
  });
}

export function useSaveChaAnswer() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      evaluationId,
      bloco,
      perguntaIndex,
      nota,
      detalhamento,
    }: {
      evaluationId: string;
      bloco: "conhecimento" | "habilidades" | "atitudes";
      perguntaIndex: number;
      nota: number;
      detalhamento: string;
    }) => {
      const { error } = await supabase.from("performance_cha_answers").upsert(
        {
          evaluation_id: evaluationId,
          bloco,
          pergunta_index: perguntaIndex,
          nota,
          detalhamento: detalhamento || null,
        },
        { onConflict: "evaluation_id,bloco,pergunta_index" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({
        queryKey: performanceKeys.evaluationDetail(vars.evaluationId),
      }),
  });
}

export function useSaveDecisionMatrix() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      evaluationId,
      altoPotencial,
      cultura,
      tecnico,
      recomendacao,
    }: {
      evaluationId: string;
      altoPotencial: number;
      cultura: number;
      tecnico: number;
      recomendacao: string;
    }) => {
      const { error } = await supabase.from("performance_decision_matrix").upsert(
        {
          evaluation_id: evaluationId,
          alto_potencial: altoPotencial,
          cultura,
          tecnico,
          recomendacao: recomendacao || null,
        },
        { onConflict: "evaluation_id" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({
        queryKey: performanceKeys.evaluationDetail(vars.evaluationId),
      }),
  });
}

export function useSaveFeedback() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      evaluationId,
      devolutivaRegistro,
      devolutivaData,
      compartilhadoComAvaliado,
    }: {
      evaluationId: string;
      devolutivaRegistro: string;
      devolutivaData?: string;
      compartilhadoComAvaliado?: boolean;
    }) => {
      const { error } = await supabase.from("performance_feedback").upsert(
        {
          evaluation_id: evaluationId,
          devolutiva_registro: devolutivaRegistro,
          ...(devolutivaData ? { devolutiva_data: devolutivaData } : {}),
          ...(compartilhadoComAvaliado !== undefined
            ? { compartilhado_com_avaliado: compartilhadoComAvaliado }
            : {}),
        },
        { onConflict: "evaluation_id" },
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({
        queryKey: performanceKeys.evaluationDetail(vars.evaluationId),
      }),
  });
}

/** Item 8 do Bloco 4: concluir exige as 15 notas do CHA (3 blocos × 5
 * perguntas) e a devolutiva preenchida — antes não havia validação
 * nenhuma. Mesmo padrão já usado em Análise Crítica pela Direção (botão
 * desabilitado + pendingTopics), não uma trava nova de banco: seguindo o
 * precedente já estabelecido no código, não inventando um segundo
 * mecanismo de "trava antes de concluir".
 * Exportada para a UI poder desabilitar o botão E mostrar o que falta,
 * em vez de só recusar no clique. */
export function evaluationPendencies(detail: {
  chaAnswers: { bloco: string; perguntaIndex: number }[];
  feedback: { devolutivaRegistro: string } | null;
}): string[] {
  const pendencias: string[] = [];
  const answered = new Set(detail.chaAnswers.map((a) => `${a.bloco}:${a.perguntaIndex}`));
  let faltamCha = 0;
  for (const bloco of ["conhecimento", "habilidades", "atitudes"] as const) {
    for (let idx = 0; idx < CHA_QUESTIONS[bloco].length; idx++) {
      if (!answered.has(`${bloco}:${idx}`)) faltamCha++;
    }
  }
  if (faltamCha > 0) pendencias.push(`${faltamCha} pergunta(s) do CHA sem nota`);
  if (!detail.feedback?.devolutivaRegistro.trim()) pendencias.push("devolutiva não registrada");
  return pendencias;
}

export function useCompleteEvaluation() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from("performance_evaluations")
        .update({ status: "concluida" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: performanceKeys.evaluations() });
      queryClient.invalidateQueries({ queryKey: performanceKeys.evaluationDetail(vars.id) });
    },
  });
}

/* ============================================================
 * Item 7 do Bloco 4: média geral e nomeação de quadrante — nenhum dos dois
 * existia. A matriz de apoio à decisão era 3 selects soltos com
 * recomendação DIGITADA à mão; o print de referência já vem com o nome do
 * quadrante e a recomendação geradas a partir da posição.
 *
 * Modelo adotado (banco tem 3 eixos independentes 1-3: alto_potencial,
 * cultura, tecnico — nenhum "desempenho" separado): a LINHA da grade é o
 * eixo de maior valor entre os três (empate resolvido por
 * alto_potencial > cultura > tecnico, refletindo a ordem em que aparecem
 * empilhados no print, de cima para baixo); a COLUNA é o desempenho,
 * derivado da média geral do CHA contra a meta mínima do ciclo. Sem essa
 * leitura os 3 campos do banco ficariam redundantes com um "escolha 1 de
 * 3" — a médoa abaixo é a única forma de usar os três de verdade.
 * ============================================================ */

export function calcularMediaCha(chaAnswers: { bloco: string; nota: number }[]): {
  geral: number | null;
  porBloco: Record<"conhecimento" | "habilidades" | "atitudes", number | null>;
} {
  const porBloco = { conhecimento: null, habilidades: null, atitudes: null } as Record<
    "conhecimento" | "habilidades" | "atitudes",
    number | null
  >;
  for (const bloco of ["conhecimento", "habilidades", "atitudes"] as const) {
    const notas = chaAnswers.filter((a) => a.bloco === bloco).map((a) => a.nota);
    porBloco[bloco] = notas.length > 0 ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
  }
  const todas = Object.values(porBloco).filter((v): v is number => v !== null);
  return {
    geral: todas.length > 0 ? todas.reduce((s, n) => s + n, 0) / todas.length : null,
    porBloco,
  };
}

type EixoPredominante = "alto_potencial" | "cultura" | "tecnico";
type DesempenhoNivel = "baixo" | "medio" | "alto";

export function eixoPredominante(matrix: {
  altoPotencial: number;
  cultura: number;
  tecnico: number;
}): EixoPredominante {
  if (matrix.altoPotencial >= matrix.cultura && matrix.altoPotencial >= matrix.tecnico)
    return "alto_potencial";
  if (matrix.cultura >= matrix.tecnico) return "cultura";
  return "tecnico";
}

/** Abaixo da meta = baixo; até 1,5 ponto acima = médio; mais que isso =
 * alto. Sem meta cadastrada, usa 7 (o mesmo default da tabela de ciclos). */
export function desempenhoNivel(mediaGeral: number | null, metaMinima: number): DesempenhoNivel {
  if (mediaGeral === null) return "baixo";
  if (mediaGeral < metaMinima) return "baixo";
  if (mediaGeral < metaMinima + 1.5) return "medio";
  return "alto";
}

const QUADRANTE_NOME: Record<EixoPredominante, Record<DesempenhoNivel, string>> = {
  tecnico: { baixo: "Insuficiente", medio: "Eficaz", alto: "Especialista" },
  cultura: { baixo: "Questionável", medio: "Mantenedor", alto: "Alto Desempenho" },
  alto_potencial: { baixo: "Enigma", medio: "Forte Contribuidor", alto: "Estrela" },
};

const QUADRANTE_RECOMENDACAO: Record<EixoPredominante, Record<DesempenhoNivel, string>> = {
  tecnico: {
    baixo:
      "Plano de capacitação técnica urgente — desempenho e adequação técnica abaixo do esperado.",
    medio: "Reforçar capacitação técnica específica para elevar o desempenho.",
    alto: "Especialista técnico — considerar como referência/multiplicador na área.",
  },
  cultura: {
    baixo: "Alinhar expectativas de cultura e conduta — desempenho não compensa o desalinhamento.",
    medio: "Manter acompanhamento — aderente à cultura, com espaço para evoluir desempenho.",
    alto: "Alto desempenho com forte aderência cultural — reconhecer e reter.",
  },
  alto_potencial: {
    baixo:
      "Potencial identificado, mas desempenho atual não sustenta — investigar causas antes de investir.",
    medio:
      "Desenvolver para assumir novos desafios. Apoio à decisão da liderança — não substitui a análise do gestor.",
    alto: "Alto potencial com alto desempenho — candidato natural a sucessão.",
  },
};

export function quadranteDaAvaliacao(
  matrix: { altoPotencial: number; cultura: number; tecnico: number },
  mediaGeral: number | null,
  metaMinima: number,
): { eixo: EixoPredominante; nivel: DesempenhoNivel; nome: string; recomendacaoSugerida: string } {
  const eixo = eixoPredominante(matrix);
  const nivel = desempenhoNivel(mediaGeral, metaMinima);
  return {
    eixo,
    nivel,
    nome: QUADRANTE_NOME[eixo][nivel],
    recomendacaoSugerida: QUADRANTE_RECOMENDACAO[eixo][nivel],
  };
}

/** Gancho Devolutiva → Plano de Ação, mesmo padrão de 2 passos usado em
 * Estratégia (seção 21.4). Reusa o fluxo de Plano de Ação já em produção
 * — sem campo separado de "plano de desenvolvimento", conforme o prompt. */
export function useGenerateActionPlanFromEvaluation() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      evaluationId,
      description,
    }: {
      evaluationId: string;
      description: string;
    }) => {
      assertNotReadOnly();
      const { data: plan, error: planErr } = await supabase
        .from("action_plans")
        .insert({ origin_type: "avaliacao_desempenho", problem_description: description })
        .select("id, code")
        .single();
      if (planErr) throw planErr;

      const { error: fbErr } = await supabase
        .from("performance_feedback")
        .update({ generated_action_plan_id: plan.id })
        .eq("evaluation_id", evaluationId);
      if (fbErr) throw fbErr;

      return plan as { id: string; code: string };
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({
        queryKey: performanceKeys.evaluationDetail(vars.evaluationId),
      }),
  });
}

/* ============================================================
 * Aditivo ao Bloco 4 — Avaliação de Desempenho Organizacional (pesquisa de
 * clima, não avaliação individual — "avaliado" é a organização).
 *
 * Governança confirmada: quem programa e vê resultado agregado é
 * Administrador + Gestor da Qualidade (is_hr_authorized) — deliberadamente
 * diferente da régua de avaliação de pessoas acima (admin+area_manager).
 * Resposta é identificada por user_id (todo membro do sistema responde,
 * não só quem tem registro em `employees`). Ver migração 20260913090500.
 * ============================================================ */

export const ORG_CLIMATE_QUESTIONS = [
  {
    key: "notaInfraestrutura",
    label:
      "Nível de satisfação em relação à infraestrutura (temperatura, condições ambientais, disponibilização de equipamentos e materiais)",
  },
  {
    key: "notaAmbiente",
    label:
      "Nível de satisfação em relação ao ambiente (interativo, inclusivo, não discriminatório, não confrontante)",
  },
  {
    key: "notaPsicologico",
    label: "Nível de satisfação em relação ao psicológico (estresse, exaustão)",
  },
  {
    key: "notaCarreira",
    label:
      "Nível de satisfação em relação à carreira (avaliação de desempenho, disponibilização de capacitação)",
  },
  {
    key: "notaLideranca",
    label:
      "Nível de satisfação em relação à liderança (clareza na comunicação, transparência em objetivos e metas)",
  },
] as const;

export type OrgClimateQuestionKey = (typeof ORG_CLIMATE_QUESTIONS)[number]["key"];

export interface OrgClimateSurvey {
  id: string;
  janelaInicio: string;
  janelaFim: string;
  createdAt: string;
}

const orgClimateKeys = {
  all: ["org-climate-surveys"] as const,
  list: () => [...orgClimateKeys.all, "list"] as const,
  myStatus: () => [...orgClimateKeys.all, "my-status"] as const,
  results: (surveyId: string) => [...orgClimateKeys.all, "results", surveyId] as const,
};

export function useOrgClimateSurveys() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: orgClimateKeys.list(),
    queryFn: async (): Promise<OrgClimateSurvey[]> => {
      const { data, error } = await supabase
        .from("org_climate_surveys")
        .select("id, janela_inicio, janela_fim, created_at")
        .order("janela_inicio", { ascending: false });
      if (error) throw error;
      return (
        (data as unknown as {
          id: string;
          janela_inicio: string;
          janela_fim: string;
          created_at: string;
        }[]) ?? []
      ).map((s) => ({
        id: s.id,
        janelaInicio: s.janela_inicio,
        janelaFim: s.janela_fim,
        createdAt: s.created_at,
      }));
    },
  });
}

export function useCreateOrgClimateSurvey() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      janelaInicio,
      janelaFim,
    }: {
      janelaInicio: string;
      janelaFim: string;
    }) => {
      const { error } = await supabase
        .from("org_climate_surveys")
        .insert({ janela_inicio: janelaInicio, janela_fim: janelaFim });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgClimateKeys.list() });
      queryClient.invalidateQueries({ queryKey: orgClimateKeys.myStatus() });
    },
  });
}

/** A pesquisa aberta agora que EU ainda não respondi — ou null se não há
 * nenhuma, ou se já respondi a que está aberta. Alimenta o aviso/pop-up de
 * resposta, análogo ao pop-up de satisfação de treinamento. */
export function useMyOpenOrgClimateSurvey() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: orgClimateKeys.myStatus(),
    queryFn: async (): Promise<OrgClimateSurvey | null> => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: surveys, error } = await supabase
        .from("org_climate_surveys")
        .select("id, janela_inicio, janela_fim, created_at")
        .lte("janela_inicio", hoje)
        .gte("janela_fim", hoje)
        .order("janela_inicio", { ascending: false });
      if (error) throw error;
      const abertas =
        (surveys as unknown as {
          id: string;
          janela_inicio: string;
          janela_fim: string;
          created_at: string;
        }[]) ?? [];
      if (abertas.length === 0) return null;

      const { data: minhas, error: respErr } = await supabase
        .from("org_climate_survey_responses")
        .select("survey_id")
        .in(
          "survey_id",
          abertas.map((s) => s.id),
        );
      if (respErr) throw respErr;
      const respondidas = new Set(
        ((minhas as unknown as { survey_id: string }[]) ?? []).map((r) => r.survey_id),
      );

      const pendente = abertas.find((s) => !respondidas.has(s.id));
      if (!pendente) return null;
      return {
        id: pendente.id,
        janelaInicio: pendente.janela_inicio,
        janelaFim: pendente.janela_fim,
        createdAt: pendente.created_at,
      };
    },
  });
}

export function useSubmitOrgClimateSurveyResponse() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      surveyId: string;
      notaInfraestrutura: number;
      notaAmbiente: number;
      notaPsicologico: number;
      notaCarreira: number;
      notaLideranca: number;
      comentarios: string;
    }) => {
      const { error } = await supabase.from("org_climate_survey_responses").insert({
        survey_id: input.surveyId,
        nota_infraestrutura: input.notaInfraestrutura,
        nota_ambiente: input.notaAmbiente,
        nota_psicologico: input.notaPsicologico,
        nota_carreira: input.notaCarreira,
        nota_lideranca: input.notaLideranca,
        comentarios: input.comentarios || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgClimateKeys.myStatus() }),
  });
}

export interface OrgClimateSurveyResults {
  totalRespostas: number;
  mediaPorPergunta: Record<OrgClimateQuestionKey, number | null>;
  comentarios: { autor: string; texto: string }[];
}

/** Resultado agregado — só quem tem governança (is_hr_authorized) enxerga
 * via RLS de org_climate_survey_responses; identificada, então os
 * comentários vêm com autor. */
export function useOrgClimateSurveyResults(surveyId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: orgClimateKeys.results(surveyId ?? ""),
    enabled: !!surveyId,
    queryFn: async (): Promise<OrgClimateSurveyResults> => {
      const { data, error } = await supabase
        .from("org_climate_survey_responses")
        .select(
          "nota_infraestrutura, nota_ambiente, nota_psicologico, nota_carreira, nota_lideranca, comentarios, user:profiles!user_id(full_name)",
        )
        .eq("survey_id", surveyId as string);
      if (error) throw error;
      const rows =
        (data as unknown as {
          nota_infraestrutura: number;
          nota_ambiente: number;
          nota_psicologico: number;
          nota_carreira: number;
          nota_lideranca: number;
          comentarios: string | null;
          user: { full_name: string } | null;
        }[]) ?? [];

      const media = (campo: keyof (typeof rows)[number]) => {
        const valores = rows.map((r) => r[campo] as number);
        if (valores.length === 0) return null;
        return valores.reduce((a, b) => a + b, 0) / valores.length;
      };

      return {
        totalRespostas: rows.length,
        mediaPorPergunta: {
          notaInfraestrutura: media("nota_infraestrutura"),
          notaAmbiente: media("nota_ambiente"),
          notaPsicologico: media("nota_psicologico"),
          notaCarreira: media("nota_carreira"),
          notaLideranca: media("nota_lideranca"),
        },
        comentarios: rows
          .filter((r) => r.comentarios)
          .map((r) => ({ autor: r.user?.full_name ?? "—", texto: r.comentarios as string })),
      };
    },
  });
}
