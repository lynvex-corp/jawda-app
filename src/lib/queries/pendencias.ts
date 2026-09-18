import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useSessionOrgId } from "@/lib/queries/contract";
import type { CorrectiveActionStatusDb } from "@/lib/queries/action-plans";

/* ============================================================
 * Quadro de Pendências — consolidação de tudo que está em aberto.
 *
 * Seis fontes, uma lista só. O objetivo é o usuário abrir a Gestão à Vista
 * e ver, num lugar único, tudo que depende dele — em vez de percorrer seis
 * módulos para descobrir o que está atrasado.
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
 * ============================================================ */

export type PendenciaCategoria =
  | "nc"
  | "acao"
  | "auditoria"
  | "competencia"
  | "treinamento"
  | "presenca";

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
  lista: (orgId: string | null) => [...pendenciasKeys.all, orgId] as const,
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

  return useQuery({
    queryKey: pendenciasKeys.lista(orgId ?? null),
    enabled: orgId !== undefined,
    staleTime: 60_000,
    // Mesmo horizonte de frescor do resto da Gestão à Vista (item 1, Bloco 6)
    // — sem botão de "resetar painel" manual, o poll cobre quem fica com a
    // aba aberta e focada por muito tempo.
    refetchInterval: 60_000,
    queryFn: async (): Promise<PendenciaGrupo[]> => {
      if (!orgId) return [];

      const [ncs, acoes, auditorias, competencias, treinamentos, presencas] = await Promise.all([
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
      ]);

      for (const r of [ncs, acoes, auditorias, competencias, treinamentos, presencas]) {
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

      const ordem: PendenciaCategoria[] = [
        "nc",
        "acao",
        "auditoria",
        "competencia",
        "treinamento",
        "presenca",
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
