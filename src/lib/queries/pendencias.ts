import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useSessionOrgId } from "@/lib/queries/contract";
import { useAuth } from "@/hooks/use-auth";
import type { CorrectiveActionStatusDb } from "@/lib/queries/action-plans";

/* ============================================================
 * Quadro de Pendências — consolidação de tudo que está em aberto.
 *
 * Oito fontes, uma lista só (Bloco 6, item 4 acrescentou "ciência pendente"
 * e "resposta de formulário pendente" às seis originais). O objetivo é o
 * usuário abrir a Gestão à Vista e ver, num lugar único, tudo que depende
 * dele — em vez de percorrer vários módulos para descobrir o que está
 * atrasado.
 *
 * "Documento obrigatório de fornecedor/empregado" FICA DE FORA aqui — não
 * existe hoje no schema um conceito de obrigatoriedade/vencimento de
 * documento de pessoa/fornecedor (fornecedores só tem critério de
 * qualificação estático, sem janela de validade; empregado não tem tabela
 * de documento obrigatório nenhuma). Registrado como backlog separado, não
 * implementado silenciosamente aqui dentro.
 *
 * PERMISSÃO: nenhuma query aqui filtra `org_id` nem papel na mão. A RLS de
 * cada tabela já faz as duas coisas — isolamento por organização (claim
 * `org_id` do JWT) e escopo por perfil. O exemplo mais claro é
 * `competency_actions`, cuja policy é
 * `is_hr_authorized(org_id) or e.linked_user_id = auth.uid()`: um
 * colaborador enxerga só as ações dele, um perfil de RH enxerga todas.
 * Reimplementar esse recorte no cliente seria duplicar a regra num lugar
 * onde ela pode divergir do banco — e divergir em favor do usuário é
 * vazamento. Por isso o painel consulta e confia na RLS.
 *
 * Categoria sem resultado não é renderizada (ver `usePendencias`): se a RLS
 * não devolveu nada porque o perfil não alcança aquela fonte, a seção some
 * em vez de anunciar "0", que sugeriria ao usuário que não existe nada
 * quando na verdade ele é que não pode ver.
 *
 * EXCEÇÃO às duas categorias novas (comunicacao/pesquisa): `communication_
 * reads` e `org_climate_surveys`/`quality_culture_survey_answers` têm RLS
 * de SELECT org-wide (qualquer membro da organização vê a linha de
 * qualquer outro) — filtrar "só o que é meu" é, de propósito, tarefa do
 * CLIENTE aqui, replicando exatamente o mesmo filtro já usado em
 * NotificacoesTab (comunicacoes/page.tsx) e em useMyOpenOrgClimateSurvey
 * (pessoas.ts). Não é duplicação arriscada de regra de segurança (RLS
 * ainda impede ver dado de OUTRA organização); é só "de tudo que a RLS
 * deixa eu ver, o que é endereçado a mim".
 * ============================================================ */

export type PendenciaCategoria =
  | "nc"
  | "acao"
  | "auditoria"
  | "competencia"
  | "treinamento"
  | "presenca"
  | "comunicacao"
  | "pesquisa";

export interface Pendencia {
  id: string;
  categoria: PendenciaCategoria;
  /** Identificação curta do registro (código, nome do evento…). */
  titulo: string;
  /** Uma linha de contexto para o usuário reconhecer o registro. */
  detalhe: string;
  /** ISO. `null` quando a fonte não tem prazo (ex.: lista de presença). */
  prazo: string | null;
  vencida: boolean;
  /** Rota do registro de origem. */
  href: string;
}

export interface PendenciaGrupo {
  categoria: PendenciaCategoria;
  label: string;
  itens: Pendencia[];
  vencidas: number;
}

export const PENDENCIA_LABEL: Record<PendenciaCategoria, string> = {
  acao: "Ações de plano em aberto",
  auditoria: "Auditorias pendentes",
  competencia: "Ações de competência abertas",
  nc: "Não conformidades abertas",
  presenca: "Presenças não confirmadas",
  treinamento: "Treinamentos não avaliados",
  comunicacao: "Ciência pendente",
  pesquisa: "Respostas de formulário pendentes",
};

/** Mesma definição usada pelos contadores da Gestão à Vista. */
const ACOES_EM_ABERTO: CorrectiveActionStatusDb[] = [
  "aguardando_aprovacao",
  "planejada",
  "em_execucao",
];

const AUDITORIAS_PENDENTES = ["programada", "em_andamento"];

/** Teto por categoria: o painel é um chamado à ação, não um relatório. */
const LIMITE_POR_CATEGORIA = 50;

export const pendenciasKeys = {
  all: ["pendencias"] as const,
  lista: (orgId: string | null, userId: string | null, role: string | null) =>
    [...pendenciasKeys.all, orgId, userId, role] as const,
};

function venceu(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

/** `date` (sem hora) vence no fim do dia, não à meia-noite. */
function venceuData(data: string | null): boolean {
  if (!data) return false;
  return new Date(`${data}T23:59:59`).getTime() < Date.now();
}

interface EmployeeRef {
  nome: string;
}

export function usePendencias() {
  const supabase = getSupabaseBrowserClient();
  const orgId = useSessionOrgId();
  const { currentOrg, user } = useAuth();
  const myRole = currentOrg?.role ?? null;
  const myUserId = user?.id ?? null;

  return useQuery({
    queryKey: pendenciasKeys.lista(orgId ?? null, myUserId, myRole),
    enabled: orgId !== undefined,
    staleTime: 60_000,
    // Mesmo horizonte de frescor do resto da Gestão à Vista (item 1, Bloco 6)
    // — sem botão de "resetar painel" manual, o poll cobre quem fica com a
    // aba aberta e focada por muito tempo.
    refetchInterval: 60_000,
    queryFn: async (): Promise<PendenciaGrupo[]> => {
      if (!orgId) return [];

      const hoje = new Date().toISOString().slice(0, 10);

      const [
        ncs,
        acoes,
        auditorias,
        competencias,
        treinamentos,
        presencas,
        comunicacoes,
        minhasCiencias,
        pesquisasAbertas,
        minhasRespostasClima,
        minhasRespostasCultura,
      ] = await Promise.all([
        supabase
          .from("ncs")
          .select("id, code, description, sla_deadline")
          .not("status", "in", "(encerrado,cancelado)")
          .order("sla_deadline", { ascending: true })
          .limit(LIMITE_POR_CATEGORIA),
        supabase
          .from("action_plan_corrective_actions")
          .select("id, action_plan_id, what_description, when_end")
          .in("status", ACOES_EM_ABERTO)
          .order("when_end", { ascending: true })
          .limit(LIMITE_POR_CATEGORIA),
        supabase
          .from("audits")
          .select("id, code, scope, start_date")
          .in("status", AUDITORIAS_PENDENTES)
          .order("start_date", { ascending: true })
          .limit(LIMITE_POR_CATEGORIA),
        supabase
          .from("competency_actions")
          .select("id, methodology, expected_date, employees!inner(nome)")
          .eq("status", "aberta")
          .order("expected_date", { ascending: true })
          .limit(LIMITE_POR_CATEGORIA),
        // Só quem esteve presente numa sessão já realizada precisa ter a
        // eficácia avaliada — cobrar avaliação de ausente ou de turma que
        // ainda não aconteceu seria pendência falsa.
        supabase
          .from("training_participants")
          .select(
            "id, employees!inner(nome), training_sessions!inner(data_realizacao, trainings!inner(nome))",
          )
          .is("eficacia", null)
          .is("presente", true)
          .eq("training_sessions.status", "realizada")
          .limit(LIMITE_POR_CATEGORIA),
        supabase
          .from("attendance_lists")
          .select("id, event_title, event_date, participants")
          .contains("participants", [{ confirmado: false }])
          .order("event_date", { ascending: false })
          .limit(LIMITE_POR_CATEGORIA),
        // Ciência pendente — comunicações já enviadas (sent_at not null),
        // endereçadas a mim (target_profiles contém "todos" ou meu papel)
        // ou emitidas por mim (não preciso confirmar ciência da própria
        // comunicação). O filtro "é minha?" é o mesmo de NotificacoesTab
        // (comunicacoes/page.tsx) — aqui só precisa dos campos crus.
        supabase
          .from("communications")
          .select("id, description, sent_at, target_profiles, communicator_id")
          .not("sent_at", "is", null)
          .order("sent_at", { ascending: false })
          .limit(LIMITE_POR_CATEGORIA),
        supabase
          .from("communication_reads")
          .select("communication_id")
          .eq("recipient_user_id", myUserId ?? ""),
        // Resposta de formulário pendente — qualquer pesquisa (clima OU
        // cultura da qualidade) com janela aberta hoje.
        supabase
          .from("org_climate_surveys")
          .select("id, kind, janela_fim")
          .lte("janela_inicio", hoje)
          .gte("janela_fim", hoje),
        // .eq(user_id) explícito mesmo a RLS já restringindo a "própria linha
        // OU is_hr_authorized" — sem isso, um Administrador/Gestor da
        // Qualidade (que enxerga TODA resposta via RLS) marcaria a pesquisa
        // como "já respondida por mim" assim que QUALQUER pessoa respondesse.
        supabase
          .from("org_climate_survey_responses")
          .select("survey_id")
          .eq("user_id", myUserId ?? ""),
        supabase
          .from("quality_culture_survey_answers")
          .select("survey_id")
          .eq("user_id", myUserId ?? ""),
      ]);

      for (const r of [
        ncs,
        acoes,
        auditorias,
        competencias,
        treinamentos,
        presencas,
        comunicacoes,
        minhasCiencias,
        pesquisasAbertas,
        minhasRespostasClima,
        minhasRespostasCultura,
      ]) {
        if (r.error) throw r.error;
      }

      const itens: Pendencia[] = [];

      for (const n of ncs.data ?? []) {
        itens.push({
          id: n.id,
          categoria: "nc",
          titulo: n.code,
          detalhe: n.description,
          prazo: n.sla_deadline,
          vencida: venceu(n.sla_deadline),
          href: `/nao-conformidades/${n.id}`,
        });
      }

      for (const a of acoes.data ?? []) {
        itens.push({
          id: a.id,
          categoria: "acao",
          titulo: a.what_description,
          detalhe: "Ação de plano em aberto",
          prazo: a.when_end,
          vencida: venceu(a.when_end),
          // O detalhe da ação vive dentro do plano, não tem rota própria.
          href: `/planos-de-acao/${a.action_plan_id}`,
        });
      }

      for (const a of auditorias.data ?? []) {
        itens.push({
          id: a.id,
          categoria: "auditoria",
          titulo: a.code,
          detalhe: a.scope,
          prazo: a.start_date,
          vencida: venceuData(a.start_date),
          href: `/auditorias/${a.id}`,
        });
      }

      for (const c of competencias.data ?? []) {
        const emp = c.employees as unknown as EmployeeRef | null;
        itens.push({
          id: c.id,
          categoria: "competencia",
          titulo: emp?.nome ?? "Colaborador",
          detalhe: c.methodology,
          prazo: c.expected_date,
          vencida: venceuData(c.expected_date),
          // Cargos e Perfis não tem rota de detalhe por colaborador.
          href: "/cargos",
        });
      }

      for (const t of treinamentos.data ?? []) {
        const emp = t.employees as unknown as EmployeeRef | null;
        const sessao = t.training_sessions as unknown as {
          data_realizacao: string | null;
          trainings: { nome: string } | null;
        } | null;
        itens.push({
          id: t.id,
          categoria: "treinamento",
          titulo: sessao?.trainings?.nome ?? "Treinamento",
          detalhe: `Eficácia não avaliada — ${emp?.nome ?? "colaborador"}`,
          prazo: sessao?.data_realizacao ?? null,
          // A avaliação não tem prazo formal; a data é só referência.
          vencida: false,
          href: "/aprendizagem",
        });
      }

      for (const p of presencas.data ?? []) {
        const lista = (p.participants ?? []) as { nome: string; confirmado: boolean }[];
        const faltam = lista.filter((x) => !x.confirmado).length;
        itens.push({
          id: p.id,
          categoria: "presenca",
          titulo: p.event_title,
          detalhe:
            faltam === 1 ? "1 presença não confirmada" : `${faltam} presenças não confirmadas`,
          prazo: p.event_date,
          vencida: false,
          href: "/documentos",
        });
      }

      const idsCientes = new Set(
        ((minhasCiencias.data ?? []) as unknown as { communication_id: string }[]).map(
          (r) => r.communication_id,
        ),
      );
      for (const c of comunicacoes.data ?? []) {
        const targets = (c.target_profiles ?? []) as string[];
        const enderecadaAMim = targets.includes("todos") || (!!myRole && targets.includes(myRole));
        if (!enderecadaAMim || c.communicator_id === myUserId || idsCientes.has(c.id)) continue;
        itens.push({
          id: c.id,
          categoria: "comunicacao",
          titulo: c.description,
          detalhe: "Confirme ciência desta comunicação",
          // Comunicação não tem prazo formal de ciência.
          prazo: null,
          vencida: false,
          href: "/comunicacoes",
        });
      }

      const idsRespondidosClima = new Set(
        ((minhasRespostasClima.data ?? []) as unknown as { survey_id: string }[]).map(
          (r) => r.survey_id,
        ),
      );
      const idsRespondidosCultura = new Set(
        ((minhasRespostasCultura.data ?? []) as unknown as { survey_id: string }[]).map(
          (r) => r.survey_id,
        ),
      );
      for (const s of pesquisasAbertas.data ?? []) {
        const respondida =
          s.kind === "cultura_qualidade"
            ? idsRespondidosCultura.has(s.id)
            : idsRespondidosClima.has(s.id);
        if (respondida) continue;
        itens.push({
          id: s.id,
          categoria: "pesquisa",
          titulo:
            s.kind === "cultura_qualidade"
              ? "Autodiagnóstico de Cultura da Qualidade"
              : "Pesquisa de clima organizacional",
          detalhe: "Sua resposta ainda não foi registrada",
          prazo: s.janela_fim,
          vencida: false,
          href: s.kind === "cultura_qualidade" ? "/cultura-da-qualidade" : "/avaliacao-performance",
        });
      }

      const ordem: PendenciaCategoria[] = [
        "nc",
        "acao",
        "auditoria",
        "competencia",
        "treinamento",
        "presenca",
        "comunicacao",
        "pesquisa",
      ];

      return ordem
        .map((categoria) => {
          const doGrupo = itens.filter((i) => i.categoria === categoria);
          return {
            categoria,
            label: PENDENCIA_LABEL[categoria],
            itens: doGrupo,
            vencidas: doGrupo.filter((i) => i.vencida).length,
          };
        })
        .filter((g) => g.itens.length > 0);
    },
  });
}
