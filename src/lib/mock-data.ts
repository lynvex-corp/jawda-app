export type Severity = "Baixa" | "Média" | "Alta" | "Crítica";
export type NCStatus =
  | "Rascunho"
  | "Em Classificação"
  | "Em Análise"
  | "Plano em Execução"
  | "Em Avaliação"
  | "Encerrada"
  | "Cancelada";

export type Origem =
  | "Auditoria Interna"
  | "Auditoria Externa"
  | "Rotina do Processo"
  | "Documental"
  | "Reclamação de Cliente"
  | "Análise Crítica pela Direção"
  | "Incidente / Acidente"
  | "Fornecedor"
  | "Indicador";

/** Sigla usada na composição do código da NC: NC_[ORIGEM]_[Nº]_[ANO] */
export const origemSiglas: Record<Origem, string> = {
  "Auditoria Interna": "AI",
  "Auditoria Externa": "AE",
  "Rotina do Processo": "RP",
  Documental: "DO",
  "Reclamação de Cliente": "RC",
  "Análise Crítica pela Direção": "AC",
  "Incidente / Acidente": "IN",
  Fornecedor: "FO",
  Indicador: "ID",
};

export const origensNC = Object.keys(origemSiglas) as Origem[];

/** Prefixo do código — configurável pelo cliente */
export const PREFIXO_NC_PADRAO = "NC";

export function ncCodigo(
  origem: Origem,
  seq: number,
  ano: number,
  prefixo: string = PREFIXO_NC_PADRAO,
) {
  return `${prefixo}_${origemSiglas[origem]}_${String(seq).padStart(3, "0")}_${ano}`;
}

export function origemClasses(origem: Origem) {
  switch (origem) {
    case "Auditoria Interna":
      return "bg-brand-soft text-brand border-brand/25";
    case "Auditoria Externa":
      return "bg-[color:var(--severity-critical)]/12 text-[color:var(--severity-critical)] border-[color:var(--severity-critical)]/25";
    case "Rotina do Processo":
      return "bg-muted text-muted-foreground border-border";
    case "Documental":
      return "bg-[color:var(--warning)]/18 text-[color:var(--severity-high)] border-[color:var(--warning)]/35";
    case "Reclamação de Cliente":
      return "bg-[color:var(--severity-high)]/12 text-[color:var(--severity-high)] border-[color:var(--severity-high)]/25";
    case "Análise Crítica pela Direção":
      return "bg-[color:var(--severity-medium)]/12 text-[color:var(--severity-medium)] border-[color:var(--severity-medium)]/25";
    case "Incidente / Acidente":
      return "bg-[color:var(--severity-critical)]/12 text-[color:var(--severity-critical)] border-[color:var(--severity-critical)]/25";
    case "Fornecedor":
      return "bg-[color:var(--success)]/12 text-[color:var(--success)] border-[color:var(--success)]/25";
    case "Indicador":
      return "bg-brand-soft text-brand border-brand/25";
  }
}

/** Setores de ocorrência da NC */
export const setoresOcorrencia = [
  "Operação",
  "Planejamento",
  "Projeto",
  "Comercial",
  "Pós-Venda",
  "Administrativo",
  "Financeiro",
  "RH",
  "Qualidade",
] as const;
export type SetorOcorrencia = (typeof setoresOcorrencia)[number];

export interface NC {
  id: string;
  codigo: string;
  descricao: string;
  origem: Origem;
  gravidade: Severity;
  responsavel: { nome: string; iniciais: string };
  status: NCStatus;
  prazoSLA: string; // ISO
  slaStatus: "ok" | "proximo" | "vencido";
  reincidente: boolean;
  criadoEm: string;
  local: string;
  setorOcorrencia?: string;
}

const nomes = [
  ["Ana Ribeiro", "AR"],
  ["Carlos Mendes", "CM"],
  ["Beatriz Souza", "BS"],
  ["Diego Almeida", "DA"],
  ["Fernanda Lima", "FL"],
  ["Rafael Costa", "RC"],
  ["Juliana Peixoto", "JP"],
  ["Marcos Vinícius", "MV"],
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

const descricoes = [
  "Divergência de peso em lote 4821 identificada na inspeção de saída",
  "Falha no registro de temperatura da câmara fria — turno noturno",
  "Etiqueta de rastreabilidade ausente em pallet expedido",
  "Reclamação de cliente: embalagem danificada no recebimento",
  "Documento de calibração vencido — balança BAL-07",
  "Desvio de procedimento na linha de envase 03",
  "Produto não conforme identificado em auditoria interna trimestral",
  "Não conformidade regulatória apontada pela ANVISA em inspeção",
  "Falta de EPI observada no setor de mistura",
  "Erro de dosagem em fórmula do lote 9921",
  "Reincidência de falha em selagem — máquina SEL-02",
  "Divergência de estoque físico x sistêmico no almoxarifado",
  "Amostra reprovada em ensaio microbiológico",
  "Ordem de produção sem assinatura do supervisor",
  "Vazamento identificado em tubulação da utilidade — vapor",
  "Rótulo com informação nutricional divergente do especificado",
  "Fornecedor entregou matéria-prima fora da especificação técnica",
  "Higienização de equipamento não registrada no checklist do turno",
  "Treinamento obrigatório NR-35 vencido para 4 colaboradores",
];

const origens: Origem[] = [
  "Auditoria Interna",
  "Reclamação de Cliente",
  "Rotina do Processo",
  "Auditoria Externa",
  "Documental",
  "Incidente / Acidente",
  "Fornecedor",
  "Indicador",
  "Análise Crítica pela Direção",
];
const gravidades: Severity[] = ["Baixa", "Média", "Alta", "Crítica"];
const statuses: NCStatus[] = [
  "Rascunho",
  "Em Classificação",
  "Em Análise",
  "Plano em Execução",
  "Em Avaliação",
  "Encerrada",
];
const locais = ["Produção", "Administrativo", "Serviço", "Almoxarifado"];

// Fixed reference date so SSR and client render identical values (no hydration mismatch)
const BASE_DATE = new Date("2026-07-15T12:00:00Z");

export const mockNCs: NC[] = descricoes.map((desc, i) => {
  const [nome, iniciais] = pick(nomes, i);
  const daysOffset = (i % 14) - 5;
  const prazo = new Date(BASE_DATE.getTime() + daysOffset * 86400000);
  const slaStatus: NC["slaStatus"] =
    daysOffset < 0 ? "vencido" : daysOffset <= 2 ? "proximo" : "ok";
  const origem = pick(origens, i);
  return {
    id: `nc-${i + 1}`,
    codigo: ncCodigo(origem, i + 1, 2026),
    descricao: desc,
    origem,
    gravidade: pick(gravidades, i * 3),
    responsavel: { nome: nome as string, iniciais: iniciais as string },
    status: pick(statuses, i * 2),
    prazoSLA: prazo.toISOString(),
    slaStatus,
    reincidente: i % 5 === 0,
    criadoEm: new Date(BASE_DATE.getTime() - i * 86400000 * 2).toISOString(),
    local: pick(locais, i),
    setorOcorrencia: pick([...setoresOcorrencia], i * 2),
  };
});

export const usuariosMock = [
  { id: "u1", nome: "Ana Ribeiro", iniciais: "AR", cargo: "Analista da Qualidade" },
  { id: "u2", nome: "Carlos Mendes", iniciais: "CM", cargo: "Coordenador de Produção" },
  { id: "u3", nome: "Beatriz Souza", iniciais: "BS", cargo: "Gerente de Qualidade" },
  { id: "u4", nome: "Diego Almeida", iniciais: "DA", cargo: "Supervisor de Envase" },
  { id: "u5", nome: "Fernanda Lima", iniciais: "FL", cargo: "Especialista SGI" },
  { id: "u6", nome: "Rafael Costa", iniciais: "RC", cargo: "Diretor Industrial" },
  { id: "u7", nome: "Juliana Peixoto", iniciais: "JP", cargo: "Analista Regulatório" },
  { id: "u8", nome: "Marcos Vinícius", iniciais: "MV", cargo: "Auditor Interno" },
];

export const requisitosNormativos = [
  { id: "iso9001-8.7", codigo: "ISO 9001:2015 — 8.7", titulo: "Controle de saídas não conformes" },
  {
    id: "iso9001-10.2",
    codigo: "ISO 9001:2015 — 10.2",
    titulo: "Não conformidade e ação corretiva",
  },
  {
    id: "iso9001-9.1",
    codigo: "ISO 9001:2015 — 9.1",
    titulo: "Monitoramento, medição, análise e avaliação",
  },
  {
    id: "iso14001-10.2",
    codigo: "ISO 14001:2015 — 10.2",
    titulo: "Não conformidade e ação corretiva (ambiental)",
  },
  {
    id: "iso45001-10.2",
    codigo: "ISO 45001:2018 — 10.2",
    titulo: "Incidente, não conformidade e ação corretiva (SSO)",
  },
  { id: "bpf-anvisa", codigo: "RDC 658/2022 — ANVISA", titulo: "Boas Práticas de Fabricação" },
  { id: "haccp-7", codigo: "HACCP — Princípio 7", titulo: "Procedimentos de verificação" },
];

export const slaPorGravidade: Record<
  Severity,
  { horas: number; label: string; escalonamento: string }
> = {
  Baixa: { horas: 240, label: "10 dias úteis", escalonamento: "Coordenador de área" },
  Média: { horas: 120, label: "5 dias úteis", escalonamento: "Gerente da Qualidade" },
  Alta: { horas: 72, label: "72 horas", escalonamento: "Gerente da Qualidade + Diretor" },
  Crítica: { horas: 24, label: "24 horas", escalonamento: "Diretoria e Comitê da Qualidade" },
};

/** Orientação de classificação — conteúdo base, personalizável por cliente */
export interface GuiaGravidade {
  definicao: string;
  exemplo: string;
  acao: string;
}

export const guiaGravidadePadrao: Record<Severity, GuiaGravidade> = {
  Baixa: {
    definicao:
      "Falha isolada ou pontual que não compromete o sistema de gestão, o processo principal ou a qualidade final.",
    exemplo:
      "Campo de formulário preenchido incorretamente ou pequeno atraso administrativo sem impacto no cliente.",
    acao: "Correção simples e imediata, sem investigação profunda de causa raiz.",
  },
  Média: {
    definicao:
      "Desvio que indica perda de controle parcial de uma etapa, mas que ainda não gerou produto defeituoso ou dano externo.",
    exemplo:
      "Equipamento operando próximo do limite de tolerância, ou falta de assinatura em verificação de rotina.",
    acao: "Intervenção planejada para ajustar o processo antes que evolua para dano real.",
  },
  Alta: {
    definicao:
      "Falha sistêmica ou grave que já afeta a qualidade, gera retrabalho expressivo ou descumpre regras contratuais e normativas importantes.",
    exemplo:
      "Lote inteiro liberado fora das especificações, ou violação de procedimento operacional essencial.",
    acao: "Bloqueio imediato do item ou processo e abertura obrigatória de plano de ação corretiva.",
  },
  Crítica: {
    definicao:
      "Desvio com potencial imediato de causar acidentes graves, danos ambientais irreversíveis, risco à vida ou fraude regulatória.",
    exemplo:
      "Falha em sistema de segurança de máquina pesada ou contaminação biológica em produto de saúde.",
    acao: "Paralisação total e imediata, envolvimento da alta gestão, resposta emergencial.",
  },
};

export const kpis = {
  conformidade: 87,
  ncsAbertas: 24,
  ncsVencidas: 5,
  proximasAuditorias: 3,
};

export const ncsPorMes = [
  { mes: "Jan", abertas: 12, fechadas: 9 },
  { mes: "Fev", abertas: 15, fechadas: 11 },
  { mes: "Mar", abertas: 9, fechadas: 13 },
  { mes: "Abr", abertas: 18, fechadas: 14 },
  { mes: "Mai", abertas: 14, fechadas: 16 },
  { mes: "Jun", abertas: 21, fechadas: 17 },
];

export const ncsPorGravidade = [
  { gravidade: "Baixa", total: 8, fill: "var(--severity-low)" },
  { gravidade: "Média", total: 11, fill: "var(--severity-medium)" },
  { gravidade: "Alta", total: 6, fill: "var(--severity-high)" },
  { gravidade: "Crítica", total: 3, fill: "var(--severity-critical)" },
];

export const empresas = [
  { id: "1", nome: "Indústria Nova Aurora — Matriz" },
  { id: "2", nome: "Nova Aurora — Filial SP" },
  { id: "3", nome: "Nova Aurora — Filial RS" },
];

export type NavItem = {
  label: string;
  to: string;
  icon: string;
  externo?: boolean;
};
export type NavGroup = { label: string; icon: string; items: NavItem[] };

export const navTop: NavItem = {
  label: "Dashboard Executivo",
  to: "/",
  icon: "LayoutDashboard",
};

export const navGroups: NavGroup[] = [
  {
    label: "Gestão da Qualidade",
    icon: "ShieldCheck",
    items: [
      { label: "Não Conformidades", to: "/nao-conformidades", icon: "AlertTriangle" },
      { label: "Planos de Ação", to: "/planos-de-acao", icon: "ListChecks" },
      { label: "Auditorias", to: "/auditorias", icon: "ClipboardCheck" },
      { label: "Indicadores e KPIs", to: "/indicadores", icon: "BarChart3" },
    ],
  },
  {
    label: "Estratégia",
    icon: "Compass",
    items: [
      { label: "Análise de Cenário", to: "/analise-cenario", icon: "Radar" },
      { label: "Partes Interessadas", to: "/partes-interessadas", icon: "Handshake" },
      { label: "Escopo do Sistema", to: "/escopo-sistema", icon: "Target" },
      { label: "Riscos e Oportunidades", to: "/riscos", icon: "ShieldAlert" },
      { label: "Mudanças no SG", to: "/mudancas-sg", icon: "Shuffle" },
      { label: "Análise Crítica pela Direção", to: "/analise-critica", icon: "Gavel" },
      { label: "Missão, Visão, Valores e Propósito", to: "/diretrizes-estrategicas", icon: "Flag" },
    ],
  },
  {
    label: "Processos e Operação",
    icon: "Workflow",
    items: [
      { label: "Processos e Fluxos", to: "/processos", icon: "GitBranch" },
      { label: "Documentos", to: "/documentos", icon: "FileText" },
      { label: "Aquisição/Fornecedores", to: "/aquisicao", icon: "Truck" },
      { label: "Produção e Serviços", to: "/producao", icon: "Factory", externo: true },
      { label: "Comunicações", to: "/comunicacoes", icon: "MessageSquare" },
    ],
  },
  {
    label: "Pessoas",
    icon: "UsersRound",
    items: [
      { label: "Cargos e Perfis", to: "/cargos", icon: "IdCard", externo: true },
      { label: "Gestão de Aprendizagem", to: "/aprendizagem", icon: "BookOpen" },
      { label: "Avaliação de Performance", to: "/avaliacao-performance", icon: "Gauge" },
    ],
  },
];

export const navFooter: NavItem[] = [
  { label: "Treinamentos da Plataforma", to: "/treinamentos", icon: "GraduationCap" },
  { label: "Usuários e Permissões", to: "/usuarios", icon: "Users" },
  { label: "Configurações", to: "/configuracoes", icon: "Settings" },
  { label: "Suporte", to: "/suporte", icon: "LifeBuoy" },
];

export function severityClasses(sev: Severity) {
  switch (sev) {
    case "Baixa":
      return "bg-muted text-muted-foreground border-border";
    case "Média":
      return "bg-[color:var(--severity-medium)]/15 text-[color:var(--severity-medium)] border-[color:var(--severity-medium)]/30";
    case "Alta":
      return "bg-[color:var(--severity-high)]/15 text-[color:var(--severity-high)] border-[color:var(--severity-high)]/30";
    case "Crítica":
      return "bg-[color:var(--severity-critical)]/15 text-[color:var(--severity-critical)] border-[color:var(--severity-critical)]/30";
  }
}

export function statusClasses(status: NCStatus) {
  switch (status) {
    case "Rascunho":
      return "bg-muted text-muted-foreground border-border";
    case "Em Classificação":
    case "Em Análise":
      return "bg-brand-soft text-brand border-brand/20";
    case "Plano em Execução":
      return "bg-[color:var(--severity-high)]/15 text-[color:var(--severity-high)] border-[color:var(--severity-high)]/30";
    case "Em Avaliação":
      return "bg-[color:var(--warning)]/20 text-[color:var(--severity-high)] border-[color:var(--warning)]/40";
    case "Encerrada":
      return "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30";
    case "Cancelada":
      return "bg-muted text-muted-foreground border-border line-through";
  }
}

// ============================================================
// Planos de Ação — mock data
// ============================================================

export type PlanoStatus =
  | "Planejado"
  | "Em Execução"
  | "Em Avaliação"
  | "Concluído"
  | "Atrasado"
  | "Cancelado";

export type PlanoOrigemTipo =
  | "Não Conformidade"
  | "Auditoria Interna"
  | "Auditoria Externa"
  | "Risco/Oportunidade"
  | "Análise Crítica"
  | "Reclamação de Cliente"
  | "Melhoria Contínua"
  | "Estratégia";

export type PDCA = "Plan" | "Do" | "Check" | "Act";

export interface PlanoAcao {
  id: string;
  codigo: string;
  descricao: string;
  /** Problema / causa raiz que originou o plano */
  motivo?: string;
  origemTipo: PlanoOrigemTipo;
  vinculadoCodigo: string | null;
  vinculadoLink: string | null;
  responsavel: { nome: string; iniciais: string; departamento: string };
  pdca: PDCA;
  status: PlanoStatus;
  inicio: string;
  prazo: string;
  percentual: number;
  custo: number;
  eficaciaAprovadaPrimeira: boolean | null; // null = ainda não avaliado
  marcos: string[]; // ISO datas
  concluidoNoPrazo: boolean | null;
}

const PLANO_BASE = new Date("2026-07-15T12:00:00Z");

function isoOffset(days: number) {
  return new Date(PLANO_BASE.getTime() + days * 86400000).toISOString();
}

const _planosSeed: Array<Omit<PlanoAcao, "id" | "codigo">> = [
  {
    descricao: "Investigar divergência de peso no lote 4821 e ajustar setup da envasadora ENV-02",
    origemTipo: "Não Conformidade",
    vinculadoCodigo: "NC-2026-000001",
    vinculadoLink: "nc-1",
    responsavel: { nome: "Diego Almeida", iniciais: "DA", departamento: "Produção" },
    pdca: "Do",
    status: "Em Execução",
    inicio: isoOffset(-9),
    prazo: isoOffset(8),
    percentual: 55,
    custo: 7400,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-5), isoOffset(0), isoOffset(6)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Recalibrar balança BAL-07 e revisar checklist de calibração mensal",
    origemTipo: "Não Conformidade",
    vinculadoCodigo: "NC-2026-000005",
    vinculadoLink: "nc-5",
    responsavel: { nome: "Fernanda Lima", iniciais: "FL", departamento: "Qualidade" },
    pdca: "Do",
    status: "Em Execução",
    inicio: isoOffset(-12),
    prazo: isoOffset(6),
    percentual: 62,
    custo: 4200,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-6), isoOffset(0)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Substituir resistência da máquina de selagem SEL-02",
    origemTipo: "Não Conformidade",
    vinculadoCodigo: "NC-2026-000011",
    vinculadoLink: "nc-11",
    responsavel: { nome: "Carlos Mendes", iniciais: "CM", departamento: "Manutenção" },
    pdca: "Do",
    status: "Atrasado",
    inicio: isoOffset(-25),
    prazo: isoOffset(-4),
    percentual: 78,
    custo: 18500,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-15), isoOffset(-8)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Treinamento NR-35 para colaboradores com certificação vencida",
    origemTipo: "Não Conformidade",
    vinculadoCodigo: "NC-2026-000019",
    vinculadoLink: "nc-19",
    responsavel: { nome: "Beatriz Souza", iniciais: "BS", departamento: "RH & SST" },
    pdca: "Plan",
    status: "Planejado",
    inicio: isoOffset(4),
    prazo: isoOffset(25),
    percentual: 5,
    custo: 6800,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(10)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Revisar procedimento POP-ENV-03 e retreinar linha de envase",
    origemTipo: "Auditoria Interna",
    vinculadoCodigo: "AUD-2026-004",
    vinculadoLink: null,
    responsavel: { nome: "Diego Almeida", iniciais: "DA", departamento: "Produção" },
    pdca: "Check",
    status: "Em Avaliação",
    inicio: isoOffset(-40),
    prazo: isoOffset(-2),
    percentual: 100,
    custo: 2100,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-30), isoOffset(-15), isoOffset(-5)],
    concluidoNoPrazo: true,
  },
  {
    descricao: "Implantar controle automático de temperatura na câmara fria",
    origemTipo: "Não Conformidade",
    vinculadoCodigo: "NC-2026-000002",
    vinculadoLink: "nc-2",
    responsavel: { nome: "Rafael Costa", iniciais: "RC", departamento: "Engenharia" },
    pdca: "Act",
    status: "Concluído",
    inicio: isoOffset(-90),
    prazo: isoOffset(-15),
    percentual: 100,
    custo: 42000,
    eficaciaAprovadaPrimeira: true,
    marcos: [isoOffset(-70), isoOffset(-40), isoOffset(-25)],
    concluidoNoPrazo: true,
  },
  {
    descricao: "Auditoria de fornecedor crítico e requalificação do MP-2231",
    origemTipo: "Auditoria Externa",
    vinculadoCodigo: "AUD-EXT-2026-01",
    vinculadoLink: null,
    responsavel: { nome: "Juliana Peixoto", iniciais: "JP", departamento: "Suprimentos" },
    pdca: "Do",
    status: "Em Execução",
    inicio: isoOffset(-20),
    prazo: isoOffset(15),
    percentual: 45,
    custo: 8900,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-10), isoOffset(5)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Implementar barreira de contenção no risco R-018 (vazamento vapor)",
    origemTipo: "Risco/Oportunidade",
    vinculadoCodigo: "R-018",
    vinculadoLink: null,
    responsavel: { nome: "Marcos Vinícius", iniciais: "MV", departamento: "Engenharia" },
    pdca: "Do",
    status: "Atrasado",
    inicio: isoOffset(-45),
    prazo: isoOffset(-12),
    percentual: 55,
    custo: 15200,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-30), isoOffset(-20)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Redesenhar formulário de ordem de produção com assinatura eletrônica",
    origemTipo: "Análise Crítica",
    vinculadoCodigo: "ACD-2026-Q1",
    vinculadoLink: null,
    responsavel: { nome: "Ana Ribeiro", iniciais: "AR", departamento: "Qualidade" },
    pdca: "Check",
    status: "Em Avaliação",
    inicio: isoOffset(-60),
    prazo: isoOffset(3),
    percentual: 92,
    custo: 3600,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-45), isoOffset(-20), isoOffset(-5)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Revisão de embalagem secundária após reclamação recorrente",
    origemTipo: "Reclamação de Cliente",
    vinculadoCodigo: "REC-2026-088",
    vinculadoLink: null,
    responsavel: { nome: "Fernanda Lima", iniciais: "FL", departamento: "Qualidade" },
    pdca: "Act",
    status: "Concluído",
    inicio: isoOffset(-120),
    prazo: isoOffset(-30),
    percentual: 100,
    custo: 12800,
    eficaciaAprovadaPrimeira: false, // reprovado na 1ª avaliação
    marcos: [isoOffset(-90), isoOffset(-60), isoOffset(-40)],
    concluidoNoPrazo: true,
  },
  {
    descricao: "Piloto de sensor IoT para monitorar dosagem em envase automático",
    origemTipo: "Melhoria Contínua",
    vinculadoCodigo: null,
    vinculadoLink: null,
    responsavel: { nome: "Diego Almeida", iniciais: "DA", departamento: "Produção" },
    pdca: "Plan",
    status: "Planejado",
    inicio: isoOffset(10),
    prazo: isoOffset(60),
    percentual: 0,
    custo: 22000,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(25), isoOffset(45)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Padronizar higienização de equipamentos entre turnos",
    origemTipo: "Não Conformidade",
    vinculadoCodigo: "NC-2026-000018",
    vinculadoLink: "nc-18",
    responsavel: { nome: "Carlos Mendes", iniciais: "CM", departamento: "Produção" },
    pdca: "Do",
    status: "Em Execução",
    inicio: isoOffset(-8),
    prazo: isoOffset(14),
    percentual: 28,
    custo: 1800,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(0), isoOffset(8)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Ajustar cadastro de rótulos no ERP e revisar aprovação regulatória",
    origemTipo: "Não Conformidade",
    vinculadoCodigo: "NC-2026-000016",
    vinculadoLink: "nc-16",
    responsavel: { nome: "Juliana Peixoto", iniciais: "JP", departamento: "Regulatório" },
    pdca: "Check",
    status: "Em Avaliação",
    inicio: isoOffset(-35),
    prazo: isoOffset(1),
    percentual: 95,
    custo: 2400,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-25), isoOffset(-10)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Inventário rotativo semanal e ajuste sistêmico do almoxarifado",
    origemTipo: "Auditoria Interna",
    vinculadoCodigo: "AUD-2026-006",
    vinculadoLink: null,
    responsavel: { nome: "Marcos Vinícius", iniciais: "MV", departamento: "Suprimentos" },
    pdca: "Do",
    status: "Em Execução",
    inicio: isoOffset(-14),
    prazo: isoOffset(21),
    percentual: 40,
    custo: 3200,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-5), isoOffset(7), isoOffset(14)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Revisar procedimento de amostragem microbiológica e requalificar analistas",
    origemTipo: "Não Conformidade",
    vinculadoCodigo: "NC-2026-000013",
    vinculadoLink: "nc-13",
    responsavel: { nome: "Ana Ribeiro", iniciais: "AR", departamento: "Qualidade" },
    pdca: "Act",
    status: "Concluído",
    inicio: isoOffset(-75),
    prazo: isoOffset(-20),
    percentual: 100,
    custo: 5600,
    eficaciaAprovadaPrimeira: true,
    marcos: [isoOffset(-55), isoOffset(-35)],
    concluidoNoPrazo: true,
  },
  {
    descricao: "Escalar disponibilidade de EPI no setor de mistura e auditar uso",
    origemTipo: "Não Conformidade",
    vinculadoCodigo: "NC-2026-000009",
    vinculadoLink: "nc-9",
    responsavel: { nome: "Beatriz Souza", iniciais: "BS", departamento: "SST" },
    pdca: "Do",
    status: "Atrasado",
    inicio: isoOffset(-30),
    prazo: isoOffset(-8),
    percentual: 65,
    custo: 4900,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-20), isoOffset(-12)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Instalar dispositivo poka-yoke na etiquetadora de rastreabilidade",
    origemTipo: "Não Conformidade",
    vinculadoCodigo: "NC-2026-000003",
    vinculadoLink: "nc-3",
    responsavel: { nome: "Rafael Costa", iniciais: "RC", departamento: "Engenharia" },
    pdca: "Do",
    status: "Em Execução",
    inicio: isoOffset(-18),
    prazo: isoOffset(10),
    percentual: 58,
    custo: 9800,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-8), isoOffset(2)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Revisar contrato de transporte após reclamação de embalagem danificada",
    origemTipo: "Reclamação de Cliente",
    vinculadoCodigo: "REC-2026-052",
    vinculadoLink: null,
    responsavel: { nome: "Juliana Peixoto", iniciais: "JP", departamento: "Logística" },
    pdca: "Plan",
    status: "Planejado",
    inicio: isoOffset(2),
    prazo: isoOffset(45),
    percentual: 8,
    custo: 1200,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(15), isoOffset(30)],
    concluidoNoPrazo: null,
  },
  {
    descricao: "Descontinuar equipamento MIX-04 e reprocessar rota — plano cancelado",
    origemTipo: "Melhoria Contínua",
    vinculadoCodigo: null,
    vinculadoLink: null,
    responsavel: { nome: "Carlos Mendes", iniciais: "CM", departamento: "Produção" },
    pdca: "Plan",
    status: "Cancelado",
    inicio: isoOffset(-50),
    prazo: isoOffset(-10),
    percentual: 20,
    custo: 0,
    eficaciaAprovadaPrimeira: null,
    marcos: [isoOffset(-40)],
    concluidoNoPrazo: null,
  },
];

export const mockPlanos: PlanoAcao[] = _planosSeed.map((p, i) => ({
  ...p,
  id: `plano-${i + 1}`,
  codigo: `PA-2026-${String(i + 1).padStart(6, "0")}`,
}));

export const planoStatusClasses: Record<PlanoStatus, { badge: string; dot: string; fill: string }> =
  {
    Planejado: {
      badge: "bg-muted text-muted-foreground border-border",
      dot: "bg-[color:var(--severity-low)]",
      fill: "var(--severity-low)",
    },
    "Em Execução": {
      badge: "bg-brand-soft text-brand border-brand/20",
      dot: "bg-brand",
      fill: "var(--brand)",
    },
    "Em Avaliação": {
      badge:
        "bg-[color:var(--warning)]/20 text-[color:var(--severity-high)] border-[color:var(--warning)]/40",
      dot: "bg-[color:var(--warning)]",
      fill: "var(--warning)",
    },
    Concluído: {
      badge:
        "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
      dot: "bg-[color:var(--success)]",
      fill: "var(--success)",
    },
    Atrasado: {
      badge:
        "bg-[color:var(--severity-critical)]/15 text-[color:var(--severity-critical)] border-[color:var(--severity-critical)]/30",
      dot: "bg-[color:var(--severity-critical)]",
      fill: "var(--severity-critical)",
    },
    Cancelado: {
      badge: "bg-muted text-muted-foreground border-border line-through",
      dot: "bg-muted-foreground",
      fill: "var(--muted-foreground)",
    },
  };

export const pdcaClasses: Record<PDCA, string> = {
  Plan: "bg-brand-soft text-brand border-brand/20",
  Do: "bg-[color:var(--warning)]/15 text-[color:var(--severity-high)] border-[color:var(--warning)]/30",
  Check:
    "bg-[color:var(--severity-high)]/15 text-[color:var(--severity-high)] border-[color:var(--severity-high)]/30",
  Act: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
};

export const planoBaseDate = PLANO_BASE.toISOString();

// Séries agregadas mockadas para gráficos
export const planosPorMes = [
  { mes: "Ago", abertos: 6, concluidos: 4, tempoMedio: 42 },
  { mes: "Set", abertos: 8, concluidos: 5, tempoMedio: 45 },
  { mes: "Out", abertos: 10, concluidos: 7, tempoMedio: 41 },
  { mes: "Nov", abertos: 7, concluidos: 9, tempoMedio: 38 },
  { mes: "Dez", abertos: 11, concluidos: 8, tempoMedio: 40 },
  { mes: "Jan", abertos: 9, concluidos: 10, tempoMedio: 36 },
  { mes: "Fev", abertos: 12, concluidos: 9, tempoMedio: 39 },
  { mes: "Mar", abertos: 8, concluidos: 11, tempoMedio: 35 },
  { mes: "Abr", abertos: 14, concluidos: 10, tempoMedio: 37 },
  { mes: "Mai", abertos: 10, concluidos: 12, tempoMedio: 33 },
  { mes: "Jun", abertos: 13, concluidos: 11, tempoMedio: 31 },
  { mes: "Jul", abertos: 9, concluidos: 13, tempoMedio: 29 },
];

export const eficaciaTrimestral = [
  { trimestre: "T3/25", taxa: 72 },
  { trimestre: "T4/25", taxa: 76 },
  { trimestre: "T1/26", taxa: 81 },
  { trimestre: "T2/26", taxa: 85 },
];

// Série mensal da eficácia dos planos de ação (últimos 6 meses)
export const eficaciaPlanosMensal = [
  { mes: "Fev", taxa: 74 },
  { mes: "Mar", taxa: 78 },
  { mes: "Abr", taxa: 81 },
  { mes: "Mai", taxa: 79 },
  { mes: "Jun", taxa: 84 },
  { mes: "Jul", taxa: 87 },
];

// ============================================================
// Indicadores e KPIs — mock data
// ============================================================

export interface Indicador {
  id: string;
  codigo: string;
  nome: string;
  categoria: "Qualidade" | "Produção" | "Segurança" | "Ambiental" | "Cliente";
  meta: number;
  atual: number;
  unidade: string;
  tendencia: "up" | "down" | "flat";
  polaridade: "maior_melhor" | "menor_melhor";
  responsavel: string;
  planosVinculados: string[]; // ids de PlanoAcao que atuam neste indicador
}

export const mockIndicadores: Indicador[] = [
  {
    id: "ind-1",
    codigo: "IND-Q-01",
    nome: "Índice de Conformidade Geral",
    categoria: "Qualidade",
    meta: 95,
    atual: 87,
    unidade: "%",
    tendencia: "up",
    polaridade: "maior_melhor",
    responsavel: "Beatriz Souza",
    planosVinculados: ["plano-1", "plano-2", "plano-6"],
  },
  {
    id: "ind-2",
    codigo: "IND-Q-02",
    nome: "Taxa de Reincidência de NCs",
    categoria: "Qualidade",
    meta: 5,
    atual: 8,
    unidade: "%",
    tendencia: "down",
    polaridade: "menor_melhor",
    responsavel: "Ana Ribeiro",
    planosVinculados: ["plano-1", "plano-16"],
  },
  {
    id: "ind-3",
    codigo: "IND-P-01",
    nome: "OEE — Linha de Envase",
    categoria: "Produção",
    meta: 85,
    atual: 78,
    unidade: "%",
    tendencia: "up",
    polaridade: "maior_melhor",
    responsavel: "Carlos Mendes",
    planosVinculados: ["plano-3", "plano-11", "plano-17"],
  },
  {
    id: "ind-4",
    codigo: "IND-S-01",
    nome: "Taxa de Acidentes com Afastamento",
    categoria: "Segurança",
    meta: 0,
    atual: 1,
    unidade: "casos",
    tendencia: "flat",
    polaridade: "menor_melhor",
    responsavel: "Beatriz Souza",
    planosVinculados: ["plano-4", "plano-16"],
  },
  {
    id: "ind-5",
    codigo: "IND-C-01",
    nome: "Índice de Reclamação de Clientes",
    categoria: "Cliente",
    meta: 2,
    atual: 3.4,
    unidade: "por 1k",
    tendencia: "down",
    polaridade: "menor_melhor",
    responsavel: "Fernanda Lima",
    planosVinculados: ["plano-10", "plano-18"],
  },
  {
    id: "ind-6",
    codigo: "IND-A-01",
    nome: "Consumo Energético por Tonelada",
    categoria: "Ambiental",
    meta: 120,
    atual: 132,
    unidade: "kWh/t",
    tendencia: "down",
    polaridade: "menor_melhor",
    responsavel: "Rafael Costa",
    planosVinculados: ["plano-8"],
  },
];
// ============================================================
// Auditorias — mock data
// ============================================================

export type AuditoriaTipo = "Interna" | "Externa";
export type AuditoriaStatus = "Programada" | "Em andamento" | "Concluída" | "Atrasada";
export type AuditoriaEvento =
  | "Certificação"
  | "Monitoração 12 meses"
  | "Monitoração 24 meses"
  | "Recertificação"
  | "Auditoria Interna Ciclo 2026";

export interface Auditoria {
  id: string;
  codigo: string;
  tipo: AuditoriaTipo;
  certificadora?: string;
  normas: string[];
  evento: AuditoriaEvento;
  escopo: string;
  status: AuditoriaStatus;
  mesInicio: number; // 1-12
  mesFim: number;
  dataInicio: string;
  dataFim: string;
  auditorLider: { nome: string; iniciais: string };
  equipe?: { nome: string }[];
  locais: string[];
  apontamentos: { opm: number; ncSimples: number; ncModerada: number; ncCritica: number };
}

export const auditoriasKPIs = {
  totalAno: 8,
  realizadas: 5,
  programadas: 2,
  emAndamento: 1,
  apontamentosAbertos: 12,
  taxaConformidade: 94,
};

export const mockAuditorias: Auditoria[] = [
  {
    id: "aud-1",
    codigo: "AUD-2026-001",
    tipo: "Interna",
    normas: ["ISO 9001"],
    evento: "Auditoria Interna Ciclo 2026",
    escopo: "Processos comerciais e engenharia — Sede",
    status: "Concluída",
    mesInicio: 2,
    mesFim: 2,
    dataInicio: "2026-02-10",
    dataFim: "2026-02-12",
    auditorLider: { nome: "Marcos Vinícius", iniciais: "MV" },
    locais: ["Sede/Escritório"],
    apontamentos: { opm: 3, ncSimples: 2, ncModerada: 1, ncCritica: 0 },
  },
  {
    id: "aud-2",
    codigo: "AUD-2026-002",
    tipo: "Externa",
    certificadora: "BRTÜV",
    normas: ["ISO 9001", "ISO 14001"],
    evento: "Monitoração 12 meses",
    escopo: "SGI — matriz e obra Zona Norte",
    status: "Concluída",
    mesInicio: 3,
    mesFim: 3,
    dataInicio: "2026-03-18",
    dataFim: "2026-03-20",
    auditorLider: { nome: "Auditor Externo — BRTÜV", iniciais: "BT" },
    locais: ["Sede/Escritório", "Obra Zona Norte"],
    apontamentos: { opm: 4, ncSimples: 3, ncModerada: 2, ncCritica: 0 },
  },
  {
    id: "aud-3",
    codigo: "AUD-2026-003",
    tipo: "Interna",
    normas: ["ISO 45001"],
    evento: "Auditoria Interna Ciclo 2026",
    escopo: "Saúde e segurança nas obras",
    status: "Concluída",
    mesInicio: 4,
    mesFim: 4,
    dataInicio: "2026-04-08",
    dataFim: "2026-04-09",
    auditorLider: { nome: "Beatriz Souza", iniciais: "BS" },
    locais: ["Obra Zona Sul", "Obra Zona Norte"],
    apontamentos: { opm: 2, ncSimples: 1, ncModerada: 1, ncCritica: 1 },
  },
  {
    id: "aud-4",
    codigo: "AUD-2026-004",
    tipo: "Interna",
    normas: ["ISO 9001", "ISO 14001"],
    evento: "Auditoria Interna Ciclo 2026",
    escopo: "Suprimentos e logística",
    status: "Concluída",
    mesInicio: 5,
    mesFim: 5,
    dataInicio: "2026-05-14",
    dataFim: "2026-05-15",
    auditorLider: { nome: "Ana Ribeiro", iniciais: "AR" },
    locais: ["Sede/Escritório", "Almoxarifado Central"],
    apontamentos: { opm: 1, ncSimples: 2, ncModerada: 0, ncCritica: 0 },
  },
  {
    id: "aud-5",
    codigo: "AUD-2026-005",
    tipo: "Interna",
    normas: ["ISO 9001"],
    evento: "Auditoria Interna Ciclo 2026",
    escopo: "Recursos humanos e treinamentos",
    status: "Concluída",
    mesInicio: 6,
    mesFim: 6,
    dataInicio: "2026-06-02",
    dataFim: "2026-06-03",
    auditorLider: { nome: "Fernanda Lima", iniciais: "FL" },
    locais: ["Sede/Escritório"],
    apontamentos: { opm: 2, ncSimples: 1, ncModerada: 0, ncCritica: 0 },
  },
  {
    id: "aud-6",
    codigo: "AUD-2026-006",
    tipo: "Externa",
    certificadora: "DNV",
    normas: ["ISO 9001", "ISO 14001", "ISO 45001"],
    evento: "Monitoração 12 meses",
    escopo: "SGI — todas as obras",
    status: "Em andamento",
    mesInicio: 7,
    mesFim: 7,
    dataInicio: "2026-07-13",
    dataFim: "2026-07-17",
    auditorLider: { nome: "Auditor Externo — DNV", iniciais: "DN" },
    locais: ["Sede/Escritório", "Obra Zona Norte", "Obra Zona Sul"],
    apontamentos: { opm: 1, ncSimples: 0, ncModerada: 0, ncCritica: 0 },
  },
  {
    id: "aud-7",
    codigo: "AUD-2026-007",
    tipo: "Interna",
    normas: ["ISO 14001"],
    evento: "Auditoria Interna Ciclo 2026",
    escopo: "Gestão ambiental — utilidades e resíduos",
    status: "Programada",
    mesInicio: 9,
    mesFim: 9,
    dataInicio: "2026-09-15",
    dataFim: "2026-09-16",
    auditorLider: { nome: "Rafael Costa", iniciais: "RC" },
    locais: ["Sede/Escritório", "Obra Zona Sul"],
    apontamentos: { opm: 0, ncSimples: 0, ncModerada: 0, ncCritica: 0 },
  },
  {
    id: "aud-8",
    codigo: "AUD-2026-008",
    tipo: "Externa",
    certificadora: "BRTÜV",
    normas: ["ISO 9001", "ISO 14001"],
    evento: "Recertificação",
    escopo: "SGI — ciclo de recertificação",
    status: "Programada",
    mesInicio: 11,
    mesFim: 11,
    dataInicio: "2026-11-09",
    dataFim: "2026-11-13",
    auditorLider: { nome: "Auditor Externo — BRTÜV", iniciais: "BT" },
    locais: ["Sede/Escritório", "Obra Zona Norte", "Obra Zona Sul", "Almoxarifado Central"],
    apontamentos: { opm: 0, ncSimples: 0, ncModerada: 0, ncCritica: 0 },
  },
];

export const auditoriaStatusClasses: Record<AuditoriaStatus, string> = {
  Programada: "bg-brand-soft text-brand border-brand/20",
  "Em andamento": "bg-brand text-white border-brand",
  Concluída:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  Atrasada:
    "bg-[color:var(--severity-critical)]/15 text-[color:var(--severity-critical)] border-[color:var(--severity-critical)]/30",
};

export const locaisAuditaveis = [
  "Sede/Escritório",
  "Obra Zona Norte",
  "Obra Zona Sul",
  "Almoxarifado Central",
  "Filial SP",
  "Filial RS",
];

export const normasDisponiveis = ["ISO 9001", "ISO 14001", "ISO 45001", "ISO 27001", "ISO 50001"];

// ===== Configuração geral — prazos governados =====
export const PRAZO_CONTINGENCIA_DIAS_UTEIS_PADRAO = 2;

export function addDiasUteis(base: Date, dias: number) {
  const d = new Date(base);
  let restantes = dias;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) restantes -= 1;
  }
  return d;
}
