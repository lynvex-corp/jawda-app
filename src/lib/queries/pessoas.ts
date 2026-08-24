import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { assertNotReadOnly } from "@/lib/org-access-guard";

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
  trainings: JobPositionTraining[];
}

const jobPositionKeys = {
  all: ["job-positions"] as const,
  list: () => [...jobPositionKeys.all, "list"] as const,
};

export function useJobPositions() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: jobPositionKeys.list(),
    queryFn: async (): Promise<JobPosition[]> => {
      const { data, error } = await supabase
        .from("job_positions")
        .select(
          "id, nome, requisitos_tecnicos, requisitos_desejaveis, responsabilidades_autoridades, job_position_trainings(id, training_name, is_required)",
        )
        .order("nome");
      if (error) throw error;
      return (
        (data as unknown as {
          id: string;
          nome: string;
          requisitos_tecnicos: string | null;
          requisitos_desejaveis: string | null;
          responsabilidades_autoridades: string | null;
          job_position_trainings: { id: string; training_name: string; is_required: boolean }[];
        }[]) ?? []
      ).map((p) => ({
        id: p.id,
        nome: p.nome,
        requisitosTecnicos: p.requisitos_tecnicos ?? "",
        requisitosDesejaveis: p.requisitos_desejaveis ?? "",
        responsabilidadesAutoridades: p.responsabilidades_autoridades ?? "",
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobPositionKeys.list() }),
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
  hasOpenCompetencyAction: boolean;
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
  job_position: { nome: string } | null;
  competency_actions: { id: string }[];
}

function mapEmployeeRow(e: EmployeeListRow): Employee {
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
    hasOpenCompetencyAction: (e.competency_actions ?? []).length > 0,
  };
}

/** Lista de funcionários — RLS já filtra: admin/quality_manager vê todos
 * da org, qualquer outro perfil vê no máximo o próprio registro (ou
 * nenhum, se não tiver employees.linked_user_id apontando pra ele). */
export function useEmployees() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: employeeKeys.list(),
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, nome, matricula, email, admissao, job_position_id, setor, situacao_competencia, linked_user_id, job_position:job_positions!job_position_id(nome), competency_actions!inner(id)",
        )
        .eq("competency_actions.status", "aberta")
        .order("nome");
      if (error) throw error;
      // Query acima só traz quem TEM ação aberta (inner join) — busca de
      // novo sem o inner pra pegar todo mundo, e cruza localmente. Evita
      // duas idas ao banco só pra marcar Pendência seria melhor com uma
      // view, mas o volume de linhas aqui (funcionários de uma empresa)
      // não justifica a complexidade extra agora.
      const { data: all, error: allErr } = await supabase
        .from("employees")
        .select(
          "id, nome, matricula, email, admissao, job_position_id, setor, situacao_competencia, linked_user_id, job_position:job_positions!job_position_id(nome)",
        )
        .order("nome");
      if (allErr) throw allErr;
      const withOpenAction = new Set(
        ((data as unknown as { id: string }[]) ?? []).map((r) => r.id),
      );
      return ((all as unknown as Omit<EmployeeListRow, "competency_actions">[]) ?? []).map((e) =>
        mapEmployeeRow({ ...e, competency_actions: withOpenAction.has(e.id) ? [{ id: "x" }] : [] }),
      );
    },
  });
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
      }>;
    }) => {
      const { error } = await supabase.from("employees").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.list() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.dossie(vars.id) });
    },
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

export interface EmployeeDossie {
  employee: Employee;
  attachments: EmployeeAttachment[];
  competencyActions: CompetencyAction[];
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

export interface Training {
  id: string;
  nome: string;
  cargaHoraria: number | null;
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
        .select("id, nome, carga_horaria, instrutor_fornecedor, modalidade")
        .order("nome");
      if (error) throw error;
      return (
        (data as unknown as {
          id: string;
          nome: string;
          carga_horaria: number | null;
          instrutor_fornecedor: string | null;
          modalidade: TrainingModality;
        }[]) ?? []
      ).map((t) => ({
        id: t.id,
        nome: t.nome,
        cargaHoraria: t.carga_horaria,
        instrutorFornecedor: t.instrutor_fornecedor ?? "",
        modalidade: t.modalidade,
      }));
    },
  });
}

export function useCreateTraining() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      cargaHoraria: number | null;
      instrutorFornecedor: string;
      modalidade: TrainingModality;
    }) => {
      const { error } = await supabase.from("trainings").insert({
        nome: input.nome,
        carga_horaria: input.cargaHoraria,
        instrutor_fornecedor: input.instrutorFornecedor || null,
        modalidade: input.modalidade,
      });
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
        .select("id, employee_id, status, employee:employees!employee_id(nome)")
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
          "devolutiva_registro, devolutiva_data, generated_action_plan_id, generated_action_plan:action_plans!generated_action_plan_id(code)",
        )
        .eq("evaluation_id", evaluationId as string)
        .maybeSingle();
      if (fbErr) throw fbErr;

      const e = evaluation as unknown as {
        id: string;
        employee_id: string;
        status: "programada" | "em_andamento" | "concluida";
        employee: { nome: string } | null;
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
        generated_action_plan_id: string | null;
        generated_action_plan: { code: string } | null;
      } | null;

      return {
        id: e.id,
        employeeId: e.employee_id,
        employeeNome: e.employee?.nome ?? "",
        status: e.status,
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
    }: {
      evaluationId: string;
      devolutivaRegistro: string;
    }) => {
      const { error } = await supabase
        .from("performance_feedback")
        .upsert(
          { evaluation_id: evaluationId, devolutiva_registro: devolutivaRegistro },
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
