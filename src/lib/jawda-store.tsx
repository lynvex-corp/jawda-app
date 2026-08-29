import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  mockNCs,
  mockPlanos,
  mockAuditorias,
  mockIndicadores,
  ncCodigo,
  type NC,
  type PlanoAcao,
  type PlanoStatus,
  type Auditoria,
  type Indicador,
} from "./mock-data";

/* ============================================================
 * Tipos auxiliares
 * ============================================================ */

export type CodePrefix = "NC" | "PA" | "AUD" | "RISCO" | "APT" | "IND";

export interface Actor {
  nome: string;
  iniciais: string;
  cargo: string;
}

export interface Activity {
  id: string;
  at: string; // ISO
  actor: Actor;
  verb: string;
  target: string;
  targetType: "NC" | "Plano" | "Auditoria" | "Apontamento" | "Risco" | "Indicador" | "Sistema";
  refId?: string;
}

export type NotificationTone = "info" | "success" | "warning" | "danger";

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  at: string;
  read: boolean;
  tone: NotificationTone;
  link?: string;
}

export interface Apontamento {
  id: string;
  codigo: string;
  auditoriaId: string;
  norma: string;
  requisito: string;
  tipo: "OPM" | "NCS" | "NCM" | "NCC";
  descricao: string;
  status: "Aguardando tratativa" | "Em tratativa" | "Aguardando verificação" | "Encerrado";
  responsavel: string;
  criadoEm: string;
  ncGerada?: string; // codigo NC
  planoGerado?: string; // codigo Plano
}

export interface Risco {
  id: string;
  codigo: string;
  descricao: string;
  processo: string;
  probabilidade: number; // 1-5
  impacto: number; // 1-5
  categoria: "Risco" | "Oportunidade";
  planosVinculados: string[];
  criadoEm: string;
}

export interface SwotItem {
  id: string;
  quadrante: "F" | "O" | "W" | "T";
  texto: string;
  planoVinculado?: string;
}

export interface ParteInteressada {
  id: string;
  nome: string;
  categoria: string;
  influencia: number; // 1-5
  interesse: number; // 1-5
  necessidades: string;
  requisitos: string;
}

export interface EscopoRevisao {
  rev: string; // "00", "01"
  data: string; // ISO
  texto: string;
  autor: string;
}

export interface Exclusao {
  id: string;
  requisito: string;
  descricao: string;
  justificativa: string;
}

export interface Documento {
  id: string;
  codigo: string;
  titulo: string;
  revisao: string;
  status: "Vigente" | "Em revisão" | "Obsoleto";
  aprovador: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  categoria: string;
  status: "Qualificado" | "Em qualificação" | "Suspenso";
  score: number;
}

export interface Colaborador {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  status: "Ativo" | "Inativo";
}

/* ============================================================
 * Estado + ações
 * ============================================================ */

export const CURRENT_USER: Actor = {
  nome: "Ana Ribeiro",
  iniciais: "AR",
  cargo: "Gerente da Qualidade",
};

interface JawdaState {
  naoConformidades: NC[];
  planosDeAcao: PlanoAcao[];
  auditorias: Auditoria[];
  apontamentos: Apontamento[];
  riscos: Risco[];
  indicadores: Indicador[];
  documentos: Documento[];
  fornecedores: Fornecedor[];
  partesInteressadas: ParteInteressada[];
  swotItens: SwotItem[];
  colaboradores: Colaborador[];
  notificacoes: AppNotification[];
  logAtividades: Activity[];
  escopoTexto: string;
  escopoRevisoes: EscopoRevisao[];
  exclusoes: Exclusao[];
}

interface JawdaContextValue extends JawdaState {
  usuario: Actor;
  nextCode: (prefix: CodePrefix) => string;
  logActivity: (a: Omit<Activity, "id" | "at" | "actor">) => void;
  addNotification: (n: Omit<AppNotification, "id" | "at" | "read">) => void;
  markNotificationsRead: () => void;
  unreadCount: number;

  addNC: (nc: Partial<NC> & { descricao: string }) => NC;
  addPlano: (p: Partial<PlanoAcao> & { descricao: string }) => PlanoAcao;
  updatePlano: (id: string, patch: Partial<PlanoAcao>) => void;
  updatePlanoStatus: (id: string, status: PlanoStatus) => void;
  addAuditoria: (a: Partial<Auditoria> & { escopo: string }) => Auditoria;
  updateAuditoria: (id: string, patch: Partial<Auditoria>) => void;
  updateAuditoriaStatus: (id: string, status: Auditoria["status"]) => void;
  addApontamento: (
    a: Partial<Apontamento> & { auditoriaId: string; requisito: string; tipo: Apontamento["tipo"] },
  ) => Apontamento;
  addRisco: (r: Partial<Risco> & { descricao: string }) => Risco;
  addSwotItem: (item: Omit<SwotItem, "id">) => SwotItem;
  updateSwotItem: (id: string, patch: Partial<SwotItem>) => void;
  removeSwotItem: (id: string) => void;
  moveSwotItem: (id: string, quadrante: SwotItem["quadrante"]) => void;

  addParte: (p: Omit<ParteInteressada, "id">) => ParteInteressada;
  updateParte: (id: string, patch: Partial<ParteInteressada>) => void;
  removeParte: (id: string) => void;

  updateEscopoTexto: (novoTexto: string) => void;
  addExclusao: (e: Omit<Exclusao, "id">) => Exclusao;
  updateExclusao: (id: string, patch: Partial<Exclusao>) => void;
  removeExclusao: (id: string) => void;

  kpis: {
    conformidade: number;
    ncsAbertas: number;
    ncsVencidas: number;
    proximasAuditorias: number;
    planosAtrasados: number;
    planosEmExecucao: number;
    eficaciaAtual: number;
  };
}

const JawdaContext = createContext<JawdaContextValue | null>(null);

/* ============================================================
 * Notificações + atividades semeadas
 * ============================================================ */

const NOW_ISO = new Date("2026-07-15T14:30:00Z").toISOString();

/* ============================================================
 * Seeds de Estratégia (SWOT / Partes / Escopo)
 * ============================================================ */

const seedSwot: SwotItem[] = [
  { id: "swot-s1", quadrante: "F", texto: "Equipe técnica certificada (12 engenheiros PMP/Lean)" },
  { id: "swot-s2", quadrante: "F", texto: "Marca reconhecida — 22 anos de mercado" },
  { id: "swot-s3", quadrante: "F", texto: "Certificação ISO 9001 ativa desde 2011" },
  { id: "swot-w1", quadrante: "W", texto: "Turnover de 28% no chão de fábrica" },
  { id: "swot-w2", quadrante: "W", texto: "ERP e MES sem integração — dupla digitação" },
  { id: "swot-w3", quadrante: "W", texto: "Baixa maturidade digital em processos operacionais" },
  { id: "swot-o1", quadrante: "O", texto: "Expansão para mercado sul (SC/RS) com demanda mapeada" },
  { id: "swot-o2", quadrante: "O", texto: "Linha de crédito verde BNDES para modernização" },
  { id: "swot-o3", quadrante: "O", texto: "Parceria de P&D com UFMG" },
  { id: "swot-t1", quadrante: "T", texto: "Nova RDC 658/2022 amplia exigências até 2027" },
  { id: "swot-t2", quadrante: "T", texto: "Concorrente asiático com preço 18% abaixo" },
  { id: "swot-t3", quadrante: "T", texto: "Escassez regional de soldadores e operadores" },
];

const seedPartes: ParteInteressada[] = [
  {
    id: "pi-1",
    nome: "Clientes Corporativos (Top 20)",
    categoria: "Cliente",
    influencia: 5,
    interesse: 5,
    necessidades: "Prazo, qualidade e rastreabilidade",
    requisitos: "ISO 9001, SLA ≤ 5 dias",
  },
  {
    id: "pi-2",
    nome: "Colaboradores diretos",
    categoria: "Colaborador",
    influencia: 4,
    interesse: 5,
    necessidades: "Ambiente seguro e desenvolvimento",
    requisitos: "NR-05, NR-35, plano de carreira",
  },
  {
    id: "pi-3",
    nome: "Fornecedores críticos (Classe A)",
    categoria: "Fornecedor",
    influencia: 4,
    interesse: 3,
    necessidades: "Previsibilidade de compra e pagamento",
    requisitos: "Homologação + auditoria anual",
  },
  {
    id: "pi-4",
    nome: "ANVISA",
    categoria: "Órgão regulador",
    influencia: 5,
    interesse: 3,
    necessidades: "Conformidade sanitária plena",
    requisitos: "RDC 658/2022 — BPF",
  },
  {
    id: "pi-5",
    nome: "Comunidade do entorno",
    categoria: "Comunidade",
    influencia: 2,
    interesse: 4,
    necessidades: "Baixo impacto ambiental e ruído",
    requisitos: "Licenciamento IBAMA",
  },
  {
    id: "pi-6",
    nome: "Acionistas / Board",
    categoria: "Acionista",
    influencia: 5,
    interesse: 4,
    necessidades: "Retorno financeiro sustentável",
    requisitos: "Relatórios trimestrais + compliance",
  },
];

const ESCOPO_INICIAL =
  "O Sistema de Gestão Integrada da Indústria Nova Aurora Ltda. abrange as atividades de recebimento, fabricação, envase, controle de qualidade, armazenagem e expedição de produtos alimentícios e farmacêuticos nas unidades da Matriz (Betim/MG) e Filial SP (Guarulhos/SP), contemplando todos os processos de suporte relacionados — suprimentos, engenharia, manutenção, recursos humanos, segurança do trabalho e meio ambiente.";

const seedRevisoes: EscopoRevisao[] = [
  {
    rev: "05",
    data: "2025-08-14T10:00:00Z",
    texto: "Inclusão da Filial SP no escopo operacional.",
    autor: "Ana Ribeiro",
  },
  {
    rev: "06",
    data: "2026-01-22T10:00:00Z",
    texto: "Filial RS adicionada como centro de distribuição.",
    autor: "Rafael Costa",
  },
  { rev: "07", data: "2026-03-12T10:00:00Z", texto: ESCOPO_INICIAL, autor: "Ana Ribeiro" },
];

const seedExclusoes: Exclusao[] = [
  {
    id: "exc-1",
    requisito: "ISO 9001 · 8.3",
    descricao: "Projeto e desenvolvimento de produtos",
    justificativa:
      "A organização atua exclusivamente na fabricação sob especificação do cliente, não realizando projeto próprio.",
  },
  {
    id: "exc-2",
    requisito: "ISO 9001 · 7.1.5.2",
    descricao: "Rastreabilidade de medição",
    justificativa: "Aplicável apenas a instrumentos críticos — em revisão pela metrologia.",
  },
];

function seedNotifications(
  state: Pick<JawdaState, "planosDeAcao" | "naoConformidades" | "auditorias">,
): AppNotification[] {
  const notifs: AppNotification[] = [];
  state.planosDeAcao
    .filter((p) => p.status === "Atrasado")
    .slice(0, 3)
    .forEach((p, i) => {
      notifs.push({
        id: `notif-atraso-${p.id}`,
        title: `Plano de ação atrasado: ${p.codigo}`,
        description: p.descricao.slice(0, 80),
        at: new Date(Date.parse(NOW_ISO) - (i + 1) * 3600000).toISOString(),
        read: false,
        tone: "danger",
        link: `/planos-de-acao/${p.id}`,
      });
    });
  const vencidas = state.naoConformidades.filter((n) => n.slaStatus === "vencido").slice(0, 2);
  vencidas.forEach((n, i) => {
    notifs.push({
      id: `notif-nc-${n.id}`,
      title: `NC ${n.codigo} com SLA vencido`,
      description: n.descricao.slice(0, 80),
      at: new Date(Date.parse(NOW_ISO) - (i + 4) * 3600000).toISOString(),
      read: false,
      tone: "warning",
      link: `/nao-conformidades/${n.id}`,
    });
  });
  const emAndamento = state.auditorias.find((a) => a.status === "Em andamento");
  if (emAndamento) {
    notifs.push({
      id: `notif-aud-${emAndamento.id}`,
      title: `Auditoria ${emAndamento.codigo} em andamento`,
      description: emAndamento.escopo,
      at: new Date(Date.parse(NOW_ISO) - 8 * 3600000).toISOString(),
      read: false,
      tone: "info",
      link: `/auditorias/${emAndamento.id}`,
    });
  }
  return notifs;
}

function seedActivities(state: Pick<JawdaState, "naoConformidades" | "planosDeAcao">): Activity[] {
  const acts: Activity[] = [];
  const auth = { nome: "Sistema", iniciais: "SJ", cargo: "Jáwda" };
  state.naoConformidades.slice(0, 4).forEach((n, i) => {
    acts.push({
      id: `act-nc-${n.id}`,
      at: new Date(Date.parse(NOW_ISO) - (i + 1) * 5400000).toISOString(),
      actor: { nome: n.responsavel.nome, iniciais: n.responsavel.iniciais, cargo: "Responsável" },
      verb: "atualizou",
      target: n.codigo,
      targetType: "NC",
      refId: n.id,
    });
  });
  state.planosDeAcao.slice(0, 3).forEach((p, i) => {
    acts.push({
      id: `act-plano-${p.id}`,
      at: new Date(Date.parse(NOW_ISO) - (i + 5) * 5400000).toISOString(),
      actor: {
        nome: p.responsavel.nome,
        iniciais: p.responsavel.iniciais,
        cargo: p.responsavel.departamento,
      },
      verb: p.status === "Concluído" ? "concluiu" : "avançou",
      target: p.codigo,
      targetType: "Plano",
      refId: p.id,
    });
  });
  acts.push({
    id: "act-seed-sys",
    at: new Date(Date.parse(NOW_ISO) - 20 * 3600000).toISOString(),
    actor: auth,
    verb: "iniciou sessão",
    target: "Jáwda",
    targetType: "Sistema",
  });
  return acts.sort((a, b) => (a.at < b.at ? 1 : -1));
}

/* ============================================================
 * Provider
 * ============================================================ */

export function JawdaProvider({ children }: { children: ReactNode }) {
  const [ncs, setNCs] = useState<NC[]>(mockNCs);
  const [planos, setPlanos] = useState<PlanoAcao[]>(mockPlanos);
  const [auditorias, setAuditorias] = useState<Auditoria[]>(mockAuditorias);
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [riscos, setRiscos] = useState<Risco[]>([]);
  const [indicadores] = useState<Indicador[]>(mockIndicadores);
  const [documentos] = useState<Documento[]>([]);
  const [fornecedores] = useState<Fornecedor[]>([]);
  const [partesInteressadas, setPartes] = useState<ParteInteressada[]>(seedPartes);
  const [swotItens, setSwot] = useState<SwotItem[]>(seedSwot);
  const [escopoRevisoes, setEscopoRevisoes] = useState<EscopoRevisao[]>(seedRevisoes);
  const [exclusoes, setExclusoes] = useState<Exclusao[]>(seedExclusoes);
  const [colaboradores] = useState<Colaborador[]>([]);
  const [notificacoes, setNotificacoes] = useState<AppNotification[]>(() =>
    seedNotifications({
      planosDeAcao: mockPlanos,
      naoConformidades: mockNCs,
      auditorias: mockAuditorias,
    }),
  );
  const [logAtividades, setLog] = useState<Activity[]>(() =>
    seedActivities({ naoConformidades: mockNCs, planosDeAcao: mockPlanos }),
  );

  const nextCode = useCallback(
    (prefix: CodePrefix) => {
      const year = 2026;
      const source: string[] =
        prefix === "NC"
          ? ncs.map((n) => n.codigo)
          : prefix === "PA"
            ? planos.map((p) => p.codigo)
            : prefix === "AUD"
              ? auditorias.map((a) => a.codigo)
              : prefix === "APT"
                ? apontamentos.map((a) => a.codigo)
                : prefix === "RISCO"
                  ? riscos.map((r) => r.codigo)
                  : indicadores.map((i) => i.codigo);
      const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
      const max = source.reduce((acc, code) => {
        const m = code.match(re);
        if (m) return Math.max(acc, parseInt(m[1], 10));
        return acc;
      }, 0);
      const pad = prefix === "NC" || prefix === "PA" ? 6 : 3;
      return `${prefix}-${year}-${String(max + 1).padStart(pad, "0")}`;
    },
    [ncs, planos, auditorias, apontamentos, riscos, indicadores],
  );

  const logActivity = useCallback((a: Omit<Activity, "id" | "at" | "actor">) => {
    setLog((prev) => [
      {
        ...a,
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        at: new Date().toISOString(),
        actor: CURRENT_USER,
      },
      ...prev,
    ]);
  }, []);

  const addNotification = useCallback((n: Omit<AppNotification, "id" | "at" | "read">) => {
    setNotificacoes((prev) => [
      {
        ...n,
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        at: new Date().toISOString(),
        read: false,
      },
      ...prev,
    ]);
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const addNC = useCallback(
    (input: Partial<NC> & { descricao: string }): NC => {
      const origem: NC["origem"] = input.origem ?? "Rotina do Processo";
      const ano = 2026;
      const seq =
        ncs.reduce((acc, n) => {
          const m = n.codigo.match(new RegExp(`_(\\d+)_${ano}$`));
          return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
        }, 0) + 1;
      const codigo = input.codigo ?? ncCodigo(origem, seq, ano);
      const nc: NC = {
        id: `nc-${Date.now()}`,
        codigo,
        descricao: input.descricao,
        origem,
        gravidade: input.gravidade ?? "Média",
        responsavel: input.responsavel ?? {
          nome: CURRENT_USER.nome,
          iniciais: CURRENT_USER.iniciais,
        },
        status: input.status ?? "Em Classificação",
        prazoSLA: input.prazoSLA ?? new Date(Date.now() + 5 * 86400000).toISOString(),
        slaStatus: input.slaStatus ?? "ok",
        reincidente: input.reincidente ?? false,
        criadoEm: new Date().toISOString(),
        local: input.local ?? "Produção",
      };
      setNCs((prev) => [nc, ...prev]);
      logActivity({ verb: "criou", target: codigo, targetType: "NC", refId: nc.id });
      addNotification({
        title: `Nova NC registrada: ${codigo}`,
        description: nc.descricao.slice(0, 90),
        tone: "info",
        link: `/nao-conformidades/${nc.id}`,
      });
      return nc;
    },
    [ncs, logActivity, addNotification],
  );

  const addPlano = useCallback(
    (input: Partial<PlanoAcao> & { descricao: string }): PlanoAcao => {
      const codigo = input.codigo ?? nextCode("PA");
      const plano: PlanoAcao = {
        id: `plano-${Date.now()}`,
        codigo,
        descricao: input.descricao,
        motivo: input.motivo ?? "",
        origemTipo: input.origemTipo ?? "Melhoria Contínua",
        vinculadoCodigo: input.vinculadoCodigo ?? null,
        vinculadoLink: input.vinculadoLink ?? null,
        responsavel: input.responsavel ?? {
          nome: CURRENT_USER.nome,
          iniciais: CURRENT_USER.iniciais,
          departamento: "Qualidade",
        },
        pdca: input.pdca ?? "Plan",
        status: input.status ?? "Planejado",
        inicio: input.inicio ?? new Date().toISOString(),
        prazo: input.prazo ?? new Date(Date.now() + 30 * 86400000).toISOString(),
        percentual: input.percentual ?? 0,
        custo: input.custo ?? 0,
        eficaciaAprovadaPrimeira: input.eficaciaAprovadaPrimeira ?? null,
        marcos: input.marcos ?? [],
        concluidoNoPrazo: input.concluidoNoPrazo ?? null,
      };
      setPlanos((prev) => [plano, ...prev]);
      logActivity({ verb: "criou", target: codigo, targetType: "Plano", refId: plano.id });
      addNotification({
        title: `Novo plano de ação: ${codigo}`,
        description: plano.descricao.slice(0, 90),
        tone: "success",
        link: `/planos-de-acao/${plano.id}`,
      });
      return plano;
    },
    [nextCode, logActivity, addNotification],
  );

  const updatePlano = useCallback((id: string, patch: Partial<PlanoAcao>) => {
    setPlanos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const updatePlanoStatus = useCallback(
    (id: string, status: PlanoStatus) => {
      updatePlano(id, { status });
      const plano = planos.find((p) => p.id === id);
      if (plano) {
        logActivity({
          verb: `moveu para ${status}`,
          target: plano.codigo,
          targetType: "Plano",
          refId: id,
        });
      }
    },
    [planos, updatePlano, logActivity],
  );

  const addAuditoria = useCallback(
    (input: Partial<Auditoria> & { escopo: string }): Auditoria => {
      const codigo = input.codigo ?? nextCode("AUD");
      const aud: Auditoria = {
        id: `aud-${Date.now()}`,
        codigo,
        tipo: input.tipo ?? "Interna",
        certificadora: input.certificadora,
        normas: input.normas ?? ["ISO 9001"],
        evento: input.evento ?? "Auditoria Interna Ciclo 2026",
        escopo: input.escopo,
        status: input.status ?? "Programada",
        mesInicio: input.mesInicio ?? new Date().getMonth() + 1,
        mesFim: input.mesFim ?? new Date().getMonth() + 1,
        dataInicio: input.dataInicio ?? new Date().toISOString().slice(0, 10),
        dataFim: input.dataFim ?? new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        auditorLider: input.auditorLider ?? {
          nome: CURRENT_USER.nome,
          iniciais: CURRENT_USER.iniciais,
        },
        locais: input.locais ?? ["Sede/Escritório"],
        apontamentos: input.apontamentos ?? { opm: 0, ncSimples: 0, ncModerada: 0, ncCritica: 0 },
      };
      setAuditorias((prev) => [aud, ...prev]);
      logActivity({ verb: "programou", target: codigo, targetType: "Auditoria", refId: aud.id });
      addNotification({
        title: `Auditoria programada: ${codigo}`,
        description: aud.escopo,
        tone: "info",
        link: `/auditorias/${aud.id}`,
      });
      return aud;
    },
    [nextCode, logActivity, addNotification],
  );

  const updateAuditoria = useCallback((id: string, patch: Partial<Auditoria>) => {
    setAuditorias((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const updateAuditoriaStatus = useCallback(
    (id: string, status: Auditoria["status"]) => {
      updateAuditoria(id, { status });
      const aud = auditorias.find((a) => a.id === id);
      if (aud) {
        logActivity({
          verb: `moveu para ${status}`,
          target: aud.codigo,
          targetType: "Auditoria",
          refId: id,
        });
      }
    },
    [auditorias, updateAuditoria, logActivity],
  );

  const addApontamento = useCallback(
    (
      input: Partial<Apontamento> & {
        auditoriaId: string;
        requisito: string;
        tipo: Apontamento["tipo"];
      },
    ): Apontamento => {
      const codigo = input.codigo ?? nextCode("APT");
      const apt: Apontamento = {
        id: `apt-${Date.now()}`,
        codigo,
        auditoriaId: input.auditoriaId,
        norma: input.norma ?? "ISO 9001",
        requisito: input.requisito,
        tipo: input.tipo,
        descricao: input.descricao ?? "",
        status: input.status ?? "Aguardando tratativa",
        responsavel: input.responsavel ?? CURRENT_USER.nome,
        criadoEm: new Date().toISOString(),
      };
      setApontamentos((prev) => [apt, ...prev]);
      logActivity({
        verb: `registrou apontamento ${apt.tipo}`,
        target: codigo,
        targetType: "Apontamento",
        refId: apt.id,
      });
      return apt;
    },
    [nextCode, logActivity],
  );

  const addRisco = useCallback(
    (input: Partial<Risco> & { descricao: string }): Risco => {
      const codigo = input.codigo ?? nextCode("RISCO");
      const risco: Risco = {
        id: `risco-${Date.now()}`,
        codigo,
        descricao: input.descricao,
        processo: input.processo ?? "Produção",
        probabilidade: input.probabilidade ?? 3,
        impacto: input.impacto ?? 3,
        categoria: input.categoria ?? "Risco",
        planosVinculados: input.planosVinculados ?? [],
        criadoEm: new Date().toISOString(),
      };
      setRiscos((prev) => [risco, ...prev]);
      logActivity({
        verb: "registrou risco",
        target: codigo,
        targetType: "Risco",
        refId: risco.id,
      });
      return risco;
    },
    [nextCode, logActivity],
  );

  const addSwotItem = useCallback(
    (item: Omit<SwotItem, "id">) => {
      const s: SwotItem = { ...item, id: `swot-${Date.now()}` };
      setSwot((prev) => [s, ...prev]);
      logActivity({ verb: "adicionou item SWOT", target: item.quadrante, targetType: "Sistema" });
      return s;
    },
    [logActivity],
  );

  const updateSwotItem = useCallback((id: string, patch: Partial<SwotItem>) => {
    setSwot((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeSwotItem = useCallback((id: string) => {
    setSwot((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const moveSwotItem = useCallback((id: string, quadrante: SwotItem["quadrante"]) => {
    setSwot((prev) => prev.map((s) => (s.id === id ? { ...s, quadrante } : s)));
  }, []);

  const addParte = useCallback(
    (p: Omit<ParteInteressada, "id">) => {
      const parte: ParteInteressada = { ...p, id: `pi-${Date.now()}` };
      setPartes((prev) => [parte, ...prev]);
      logActivity({ verb: "cadastrou parte interessada", target: p.nome, targetType: "Sistema" });
      return parte;
    },
    [logActivity],
  );

  const updateParte = useCallback((id: string, patch: Partial<ParteInteressada>) => {
    setPartes((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removeParte = useCallback((id: string) => {
    setPartes((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateEscopoTexto = useCallback(
    (novoTexto: string) => {
      setEscopoRevisoes((prev) => {
        const ultimaRev = prev[prev.length - 1]?.rev ?? "00";
        const proxRev = String(parseInt(ultimaRev, 10) + 1).padStart(2, "0");
        const nova: EscopoRevisao = {
          rev: proxRev,
          data: new Date().toISOString(),
          texto: novoTexto,
          autor: CURRENT_USER.nome,
        };
        return [...prev, nova];
      });
      logActivity({ verb: "revisou escopo do SGI", target: "DOC-SG-001", targetType: "Sistema" });
      addNotification({
        title: "Escopo do SGI revisado",
        description: "Nova revisão registrada no histórico.",
        tone: "success",
      });
    },
    [logActivity, addNotification],
  );

  const addExclusao = useCallback(
    (e: Omit<Exclusao, "id">) => {
      const ex: Exclusao = { ...e, id: `exc-${Date.now()}` };
      setExclusoes((prev) => [...prev, ex]);
      if (!e.justificativa.trim()) {
        addNotification({
          title: "Exclusão sem justificativa",
          description: `${e.requisito} — risco de NC no item 4.3`,
          tone: "danger",
          link: "/escopo-sistema",
        });
      }
      return ex;
    },
    [addNotification],
  );

  const updateExclusao = useCallback((id: string, patch: Partial<Exclusao>) => {
    setExclusoes((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const removeExclusao = useCallback((id: string) => {
    setExclusoes((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const kpis = useMemo(() => {
    const encerradas = ncs.filter((n) => n.status === "Encerrada").length;
    const total = ncs.length;
    const conformidade = total ? Math.round((encerradas / total) * 100) : 0;
    const ncsAbertas = ncs.filter(
      (n) => n.status !== "Encerrada" && n.status !== "Cancelada",
    ).length;
    const ncsVencidas = ncs.filter((n) => n.slaStatus === "vencido").length;
    const proximasAuditorias = auditorias.filter((a) => a.status === "Programada").length;
    const planosAtrasados = planos.filter((p) => p.status === "Atrasado").length;
    const planosEmExecucao = planos.filter((p) => p.status === "Em Execução").length;
    const avaliados = planos.filter((p) => p.eficaciaAprovadaPrimeira !== null);
    const eficazes = avaliados.filter((p) => p.eficaciaAprovadaPrimeira === true).length;
    const eficaciaAtual = avaliados.length ? Math.round((eficazes / avaliados.length) * 100) : 87;
    return {
      conformidade: Math.max(conformidade, 60),
      ncsAbertas,
      ncsVencidas,
      proximasAuditorias,
      planosAtrasados,
      planosEmExecucao,
      eficaciaAtual,
    };
  }, [ncs, planos, auditorias]);

  const unreadCount = notificacoes.filter((n) => !n.read).length;

  const value: JawdaContextValue = {
    naoConformidades: ncs,
    planosDeAcao: planos,
    auditorias,
    apontamentos,
    riscos,
    indicadores,
    documentos,
    fornecedores,
    partesInteressadas,
    swotItens,
    colaboradores,
    notificacoes,
    logAtividades,
    escopoTexto: escopoRevisoes[escopoRevisoes.length - 1]?.texto ?? ESCOPO_INICIAL,
    escopoRevisoes,
    exclusoes,
    usuario: CURRENT_USER,
    nextCode,
    logActivity,
    addNotification,
    markNotificationsRead,
    unreadCount,
    addNC,
    addPlano,
    updatePlano,
    updatePlanoStatus,
    addAuditoria,
    updateAuditoria,
    updateAuditoriaStatus,
    addApontamento,
    addRisco,
    addSwotItem,
    updateSwotItem,
    removeSwotItem,
    moveSwotItem,
    addParte,
    updateParte,
    removeParte,
    updateEscopoTexto,
    addExclusao,
    updateExclusao,
    removeExclusao,
    kpis,
  };

  return <JawdaContext.Provider value={value}>{children}</JawdaContext.Provider>;
}

export function useJawda() {
  const ctx = useContext(JawdaContext);
  if (!ctx) throw new Error("useJawda deve ser usado dentro de <JawdaProvider>");
  return ctx;
}

export function useJawdaOptional() {
  return useContext(JawdaContext);
}

/* ============================================================
 * Utilidades de formatação
 * ============================================================ */

export function formatRelative(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
