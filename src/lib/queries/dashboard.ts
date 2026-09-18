import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useSessionOrgId } from "@/lib/queries/contract";
import type { NCSeverityDb, NCStatusDb } from "@/lib/queries/ncs";
import type { CorrectiveActionStatusDb } from "@/lib/queries/action-plans";

/* ============================================================
 * Gestão à Vista — agregação de dado REAL do banco.
 *
 * Tudo nesta tela sai de `ncs`, `action_plan_corrective_actions` e `audits`
 * via PostgREST, com a RLS de cada tabela isolando a organização. Não há
 * nenhum mock aqui: quando a empresa não tem registro, o número é 0 e o
 * gráfico fica vazio — é o retrato honesto do sistema, não um valor de
 * demonstração. (O antigo dashboard lia `mock-data.ts`, então mostrava os
 * mesmos números para toda empresa.)
 * ============================================================ */

export type DashboardPeriodo = "3m" | "6m" | "12m";

export const DASHBOARD_PERIODO_OPTIONS: { value: DashboardPeriodo; label: string }[] = [
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
];

export const DASHBOARD_PERIODO_PADRAO: DashboardPeriodo = "6m";

const MESES_POR_PERIODO: Record<DashboardPeriodo, number> = { "3m": 3, "6m": 6, "12m": 12 };

const PREFS_STORAGE_KEY = "jawda:gestao-a-vista:periodo";

function isPeriodo(v: unknown): v is DashboardPeriodo {
  return v === "3m" || v === "6m" || v === "12m";
}

/** Preferência de período da Gestão à Vista, por empresa (a chave carrega o
 * org_id do JWT, então trocar de empresa não herda o filtro da anterior).
 * Fica em localStorage porque é preferência de visualização do usuário
 * naquele navegador, não dado de negócio — nenhuma tabela do schema guarda
 * layout de dashboard. Sobrevive a F5 e a reinstalar o PWA no mesmo
 * navegador; `resetar()` apaga a chave e volta ao padrão sem quebrar nada,
 * porque o padrão é sempre válido. */
export function useDashboardPeriodo() {
  const orgId = useSessionOrgId();
  const storageKey = orgId ? `${PREFS_STORAGE_KEY}:${orgId}` : null;
  const [periodo, setPeriodoState] = useState<DashboardPeriodo>(DASHBOARD_PERIODO_PADRAO);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      setPeriodoState(isPeriodo(saved) ? saved : DASHBOARD_PERIODO_PADRAO);
    } catch {
      setPeriodoState(DASHBOARD_PERIODO_PADRAO);
    }
  }, [storageKey]);

  const setPeriodo = useCallback(
    (p: DashboardPeriodo) => {
      setPeriodoState(p);
      if (!storageKey) return;
      try {
        window.localStorage.setItem(storageKey, p);
      } catch {
        /* modo privado / storage bloqueado: a sessão atual continua valendo */
      }
    },
    [storageKey],
  );

  const limpar = useCallback(() => {
    setPeriodoState(DASHBOARD_PERIODO_PADRAO);
    if (!storageKey) return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* idem */
    }
  }, [storageKey]);

  return { periodo, setPeriodo, limpar, pronto: orgId !== undefined };
}

/* ============================================================
 * Shapes de saída
 * ============================================================ */

export interface DashboardKpis {
  /** % de NCs encerradas sobre o total já registrado (canceladas fora da
   * conta). Sem piso artificial — o store mockado aplicava `Math.max(x, 60)`. */
  conformidade: number;
  ncsAbertas: number;
  ncsVencidas: number;
  ncsNaSemana: number;
  proximasAuditorias: number;
  planosAtrasados: number;
  /** `null` quando nenhuma ação corretiva foi avaliada ainda — a tela mostra
   * "—" em vez de inventar uma taxa. */
  eficaciaAtual: number | null;
  totalNCs: number;
}

export interface DashboardNC {
  id: string;
  codigo: string;
  descricao: string;
  gravidade: Severity;
  status: NCStatus;
  responsavelNome: string;
  responsavelIniciais: string;
  criadoEm: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  ncsPorMes: { mes: string; abertas: number; fechadas: number }[];
  ncsPorGravidade: { gravidade: string; total: number; fill: string }[];
  eficaciaMensal: { mes: string; taxa: number }[];
  ultimasNCs: DashboardNC[];
  /** Nenhum registro em nenhuma das três fontes — a tela troca os gráficos
   * por um estado vazio explicativo em vez de desenhar eixos zerados. */
  vazio: boolean;
}

type Severity = "Baixa" | "Média" | "Alta" | "Crítica";
type NCStatus =
  | "Em Classificação"
  | "Em Análise"
  | "Plano em Execução"
  | "Em Avaliação"
  | "Encerrada"
  | "Cancelada";

const SEVERITY_LABEL: Record<NCSeverityDb, Severity> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const STATUS_LABEL: Record<NCStatusDb, NCStatus> = {
  aberto: "Em Classificação",
  em_analise: "Em Análise",
  em_tratativa: "Plano em Execução",
  aguardando_verificacao: "Em Avaliação",
  encerrado: "Encerrada",
  cancelado: "Cancelada",
};

const SEVERITY_FILL: Record<Severity, string> = {
  Baixa: "var(--severity-low)",
  Média: "var(--severity-medium)",
  Alta: "var(--severity-high)",
  Crítica: "var(--severity-critical)",
};

/** Status de ação corretiva que ainda contam como "em aberto" — os dois
 * terminais (`aprovada`, `encerrada`) ficam de fora. */
const ACOES_EM_ABERTO: CorrectiveActionStatusDb[] = [
  "aguardando_aprovacao",
  "planejada",
  "em_execucao",
  "aguardando_verificacao",
];

const MES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Baldes mensais do período, do mais antigo ao mês corrente. */
function bucketsDoPeriodo(periodo: DashboardPeriodo) {
  const meses = MESES_POR_PERIODO[periodo];
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1);
  const chaves: { chave: string; label: string }[] = [];
  for (let i = 0; i < meses; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
    chaves.push({ chave: `${d.getFullYear()}-${d.getMonth()}`, label: MES_ABREV[d.getMonth()] });
  }
  return { inicio, chaves };
}

function chaveMes(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/* ============================================================
 * Linhas cruas lidas do banco
 * ============================================================ */

interface NcDashRow {
  id: string;
  code: string;
  description: string;
  severity: NCSeverityDb;
  status: NCStatusDb;
  sla_deadline: string;
  created_at: string;
  responsible: { full_name: string } | null;
}

interface AcaoDashRow {
  status: CorrectiveActionStatusDb;
  escalation_level: number;
  when_end: string;
  approved_at: string | null;
}

interface AuditDashRow {
  id: string;
  start_date: string;
  status: string;
}

export const dashboardKeys = {
  all: ["gestao-a-vista"] as const,
  data: (orgId: string | null, periodo: DashboardPeriodo) =>
    [...dashboardKeys.all, orgId, periodo] as const,
};

export function useDashboardData(periodo: DashboardPeriodo) {
  const supabase = getSupabaseBrowserClient();
  const orgId = useSessionOrgId();

  return useQuery({
    queryKey: dashboardKeys.data(orgId ?? null, periodo),
    enabled: orgId !== undefined,
    // Atualização automática (item 1, Bloco 6): sem botão de "resetar" manual,
    // a Gestão à Vista precisa se manter fresca sozinha. refetchOnWindowFocus
    // já é o padrão do React Query (cobre "voltei pra aba"); o poll de 60s
    // cobre quem fica com a aba aberta e focada por muito tempo. Mesmo
    // horizonte de frescor já usado em useAlertCounters (staleTime 60_000).
    refetchInterval: 60_000,
    queryFn: async (): Promise<DashboardData> => {
      const { inicio, chaves } = bucketsDoPeriodo(periodo);
      const inicioIso = inicio.toISOString();
      const hoje = new Date();
      const em30Dias = new Date(hoje.getTime() + 30 * 86_400_000);
      const seteDiasAtras = new Date(hoje.getTime() - 7 * 86_400_000);

      // 4 leituras independentes, em paralelo. A RLS de cada tabela já
      // restringe à organização da sessão; o dashboard não precisa (nem
      // deve) filtrar por org_id à mão aqui — diferente de `contracts` e
      // `organizations`, estas tabelas não têm política de bypass para
      // internal_staff, então não há risco de vazar linha de outra empresa.
      const [ncsPeriodoRes, ncsAbertasRes, acoesRes, auditoriasRes, totaisRes] = await Promise.all([
        supabase
          .from("ncs")
          .select(
            "id, code, description, severity, status, sla_deadline, created_at, responsible:profiles!responsible_id(full_name)",
          )
          .gte("created_at", inicioIso)
          .order("created_at", { ascending: false }),
        supabase
          .from("ncs")
          .select("id, sla_deadline, created_at")
          .not("status", "in", "(encerrado,cancelado)"),
        supabase
          .from("action_plan_corrective_actions")
          .select("status, escalation_level, when_end, approved_at"),
        supabase.from("audits").select("id, start_date, status").eq("status", "programada"),
        supabase.from("ncs").select("status"),
      ]);

      if (ncsPeriodoRes.error) throw ncsPeriodoRes.error;
      if (ncsAbertasRes.error) throw ncsAbertasRes.error;
      if (acoesRes.error) throw acoesRes.error;
      if (auditoriasRes.error) throw auditoriasRes.error;
      if (totaisRes.error) throw totaisRes.error;

      const ncsPeriodo = ncsPeriodoRes.data as unknown as NcDashRow[];
      const ncsAbertas = ncsAbertasRes.data as unknown as {
        id: string;
        sla_deadline: string;
        created_at: string;
      }[];
      const acoes = acoesRes.data as unknown as AcaoDashRow[];
      const auditorias = auditoriasRes.data as unknown as AuditDashRow[];
      const todasNCs = totaisRes.data as unknown as { status: NCStatusDb }[];

      /* ----- KPIs ----- */
      const naoCanceladas = todasNCs.filter((n) => n.status !== "cancelado");
      const encerradas = naoCanceladas.filter((n) => n.status === "encerrado").length;
      const conformidade = naoCanceladas.length
        ? Math.round((encerradas / naoCanceladas.length) * 100)
        : 0;

      const agora = hoje.getTime();
      const planosAtrasados = acoes.filter(
        (a) => ACOES_EM_ABERTO.includes(a.status) && new Date(a.when_end).getTime() < agora,
      ).length;

      const avaliadas = acoes.filter((a) => a.status === "aprovada" || a.status === "encerrada");
      const eficazesPrimeira = avaliadas.filter(
        (a) => a.status === "aprovada" && a.escalation_level === 0,
      ).length;

      const kpis: DashboardKpis = {
        conformidade,
        ncsAbertas: ncsAbertas.length,
        ncsVencidas: ncsAbertas.filter((n) => new Date(n.sla_deadline).getTime() < agora).length,
        ncsNaSemana: ncsAbertas.filter(
          (n) => new Date(n.created_at).getTime() >= seteDiasAtras.getTime(),
        ).length,
        proximasAuditorias: auditorias.filter((a) => {
          const inicioAuditoria = new Date(a.start_date).getTime();
          return inicioAuditoria >= agora && inicioAuditoria <= em30Dias.getTime();
        }).length,
        planosAtrasados,
        eficaciaAtual: avaliadas.length
          ? Math.round((eficazesPrimeira / avaliadas.length) * 100)
          : null,
        totalNCs: todasNCs.length,
      };

      /* ----- NCs por mês de abertura, e quantas dessas já foram encerradas -----
       * A tabela `ncs` não tem `closed_at` nem `updated_at`, então não existe
       * no banco a data em que uma NC foi encerrada — o único carimbo real é
       * `created_at`. Em vez de inventar a data de fechamento, o gráfico
       * agrupa pelo mês de ABERTURA e mostra quantas daquela safra já estão
       * encerradas hoje. O rótulo da tela diz exatamente isso. */
      const abertasPorMes = new Map<string, number>();
      const fechadasPorMes = new Map<string, number>();
      for (const nc of ncsPeriodo) {
        const k = chaveMes(nc.created_at);
        abertasPorMes.set(k, (abertasPorMes.get(k) ?? 0) + 1);
        if (nc.status === "encerrado") {
          fechadasPorMes.set(k, (fechadasPorMes.get(k) ?? 0) + 1);
        }
      }
      const ncsPorMes = chaves.map(({ chave, label }) => ({
        mes: label,
        abertas: abertasPorMes.get(chave) ?? 0,
        fechadas: fechadasPorMes.get(chave) ?? 0,
      }));

      /* ----- NCs por gravidade (no período) ----- */
      const porGravidade = new Map<Severity, number>();
      for (const nc of ncsPeriodo) {
        const g = SEVERITY_LABEL[nc.severity];
        porGravidade.set(g, (porGravidade.get(g) ?? 0) + 1);
      }
      const ncsPorGravidade = (["Baixa", "Média", "Alta", "Crítica"] as Severity[]).map((g) => ({
        gravidade: g,
        total: porGravidade.get(g) ?? 0,
        fill: SEVERITY_FILL[g],
      }));

      /* ----- Eficácia das ações corretivas, mês a mês ----- */
      const avaliadasPorMes = new Map<string, { total: number; eficazes: number }>();
      for (const a of avaliadas) {
        const quando = a.approved_at ?? a.when_end;
        if (new Date(quando).getTime() < inicio.getTime()) continue;
        const k = chaveMes(quando);
        const acc = avaliadasPorMes.get(k) ?? { total: 0, eficazes: 0 };
        acc.total += 1;
        if (a.status === "aprovada" && a.escalation_level === 0) acc.eficazes += 1;
        avaliadasPorMes.set(k, acc);
      }
      const eficaciaMensal = chaves
        .map(({ chave, label }) => {
          const acc = avaliadasPorMes.get(chave);
          return acc && acc.total
            ? { mes: label, taxa: Math.round((acc.eficazes / acc.total) * 100) }
            : null;
        })
        .filter((p): p is { mes: string; taxa: number } => p !== null);

      /* ----- Últimas NCs ----- */
      const ultimasNCs: DashboardNC[] = ncsPeriodo.slice(0, 5).map((nc) => {
        const nome = nc.responsible?.full_name ?? "Não atribuído";
        return {
          id: nc.id,
          codigo: nc.code,
          descricao: nc.description,
          gravidade: SEVERITY_LABEL[nc.severity],
          status: STATUS_LABEL[nc.status],
          responsavelNome: nome,
          responsavelIniciais: iniciais(nome),
          criadoEm: nc.created_at,
        };
      });

      return {
        kpis,
        ncsPorMes,
        ncsPorGravidade,
        eficaciaMensal,
        ultimasNCs,
        vazio: todasNCs.length === 0 && acoes.length === 0 && auditorias.length === 0,
      };
    },
  });
}

/** Contadores de alerta da sidebar (bolinha vermelha em "Não Conformidades"
 * e "Planos de Ação"). Antes vinham de `mockNCs`/`mockPlanos`, então toda
 * empresa via o mesmo número fixo. Aqui são duas contagens reais no banco,
 * com `head: true` — traz só o total, sem trafegar as linhas. */
export function useAlertCounters() {
  const supabase = getSupabaseBrowserClient();
  const orgId = useSessionOrgId();

  return useQuery({
    queryKey: [...dashboardKeys.all, "alert-counters", orgId ?? null],
    enabled: orgId !== undefined,
    staleTime: 60_000,
    queryFn: async (): Promise<{ ncsVencidas: number; planosAtrasados: number }> => {
      if (!orgId) return { ncsVencidas: 0, planosAtrasados: 0 };
      const agoraIso = new Date().toISOString();

      const [ncsRes, acoesRes] = await Promise.all([
        supabase
          .from("ncs")
          .select("id", { count: "exact", head: true })
          .not("status", "in", "(encerrado,cancelado)")
          .lt("sla_deadline", agoraIso),
        supabase
          .from("action_plan_corrective_actions")
          .select("id", { count: "exact", head: true })
          .in("status", ACOES_EM_ABERTO)
          .lt("when_end", agoraIso),
      ]);

      if (ncsRes.error) throw ncsRes.error;
      if (acoesRes.error) throw acoesRes.error;

      return { ncsVencidas: ncsRes.count ?? 0, planosAtrasados: acoesRes.count ?? 0 };
    },
  });
}
