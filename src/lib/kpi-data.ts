/**
 * Vocabulário e matemática de domínio do módulo de Indicadores — sem mock,
 * sem estado. Dado real vive em src/lib/queries/indicators.ts; este arquivo
 * só guarda tipos de UI (em português, como o resto do protótipo), tabelas
 * de tradução DB<->UI e funções puras (semáforo, tendência, ciclos fora,
 * progresso do objetivo) reaproveitadas pelos componentes de src/components/kpis.
 */

export type Polaridade = "maior_melhor" | "menor_melhor" | "faixa_ideal";
export type FonteDados = "manual" | "derivado" | "importado";
export type SemaforoKpi = "verde" | "amarelo" | "vermelho" | "novo";

export const origemSigla: Record<FonteDados, string> = {
  manual: "MAN",
  derivado: "DER",
  importado: "IMP",
};

export const fonteLabel: Record<FonteDados, string> = {
  manual: "Manual",
  derivado: "Derivado do sistema",
  importado: "Importado (planilha)",
};

/** Parâmetros de meta necessários para os cálculos abaixo — formato mínimo,
 * não o indicador inteiro, pra essas funções servirem tanto pro indicador
 * já salvo quanto pro rascunho do wizard antes de existir no banco. */
export interface MetaIndicador {
  meta: number;
  faixaMin?: number | null;
  faixaMax?: number | null;
  polaridade: Polaridade;
  toleranciaPct: number;
}

export function foraDaMeta(valor: number, m: Omit<MetaIndicador, "toleranciaPct">): boolean {
  if (m.polaridade === "menor_melhor") return valor > m.meta;
  if (m.polaridade === "faixa_ideal") {
    return valor < (m.faixaMin ?? m.meta) || valor > (m.faixaMax ?? m.meta);
  }
  return valor < m.meta;
}

export function semaforo(valor: number | null, m: MetaIndicador): SemaforoKpi {
  if (valor === null) return "novo";
  const tol = (m.meta * m.toleranciaPct) / 100;
  if (m.polaridade === "menor_melhor") {
    if (valor <= m.meta) return "verde";
    return valor <= m.meta + tol ? "amarelo" : "vermelho";
  }
  if (m.polaridade === "faixa_ideal") {
    const min = m.faixaMin ?? m.meta;
    const max = m.faixaMax ?? m.meta;
    return valor >= min && valor <= max ? "verde" : "vermelho";
  }
  if (valor >= m.meta) return "verde";
  return valor >= m.meta - tol ? "amarelo" : "vermelho";
}

export function tendencia(valores: number[]): "up" | "down" | "flat" {
  if (valores.length < 2) return "flat";
  const a = valores[valores.length - 2];
  const b = valores[valores.length - 1];
  if (Math.abs(b - a) < 0.001) return "flat";
  return b > a ? "up" : "down";
}

export function tendenciaBoa(valores: number[], polaridade: Polaridade): boolean | null {
  const t = tendencia(valores);
  if (t === "flat") return null;
  return polaridade === "menor_melhor" ? t === "down" : t === "up";
}

/** Conta ciclos fora da meta consecutivos, olhando do mais recente pra trás.
 * Recebe as medições já ordenadas cronologicamente (mais antiga primeiro),
 * com o out_of_target calculado pelo banco (compute_measurement_out_of_target). */
export function ciclosFora(outOfTargetCronologico: boolean[]): number {
  let n = 0;
  for (let i = outOfTargetCronologico.length - 1; i >= 0; i--) {
    if (!outOfTargetCronologico[i]) break;
    n++;
  }
  return n;
}

/** Severidade sugerida pra NC gerada pelo gatilho de ciclos fora, calculada
 * pela distância percentual entre o último valor e a meta (ou a borda mais
 * próxima da faixa ideal). Heurística simples, sem pretensão de precisão
 * estatística — só para pré-preencher o campo, o humano decide de verdade. */
export function severidadeGatilho(
  valor: number,
  m: MetaIndicador,
): "Baixa" | "Média" | "Alta" | "Crítica" {
  const alvo =
    m.polaridade === "faixa_ideal"
      ? valor < (m.faixaMin ?? m.meta)
        ? (m.faixaMin ?? m.meta)
        : (m.faixaMax ?? m.meta)
      : m.meta;
  const desvioPct = (Math.abs(valor - alvo) / Math.max(Math.abs(alvo), 0.001)) * 100;
  if (desvioPct <= 10) return "Baixa";
  if (desvioPct <= 25) return "Média";
  if (desvioPct <= 50) return "Alta";
  return "Crítica";
}

export function progressoObjetivo(
  itens: { valor: number | null; meta: number; polaridade: Polaridade }[],
): number {
  const comDados = itens.filter((i) => i.valor !== null);
  if (!comDados.length) return 0;
  const soma = comDados.reduce((acc, i) => {
    const v = i.valor as number;
    const pct =
      i.polaridade === "menor_melhor"
        ? (i.meta / Math.max(v, 0.001)) * 100
        : (v / Math.max(i.meta, 0.001)) * 100;
    return acc + Math.min(120, pct);
  }, 0);
  return Math.round(soma / comDados.length);
}

export const semaforoClasses: Record<SemaforoKpi, string> = {
  verde:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  amarelo:
    "bg-[color:var(--warning)]/20 text-[color:var(--severity-high)] border-[color:var(--warning)]/40",
  vermelho:
    "bg-[color:var(--danger-deep)]/10 text-[color:var(--danger-deep)] border-[color:var(--danger-deep)]/30",
  novo: "bg-muted text-muted-foreground border-border",
};

export const semaforoLabel: Record<SemaforoKpi, string> = {
  verde: "Atingindo a meta",
  amarelo: "Em atenção",
  vermelho: "Fora da meta",
  novo: "Sem histórico",
};

export const semaforoCor: Record<SemaforoKpi, string> = {
  verde: "var(--success)",
  amarelo: "var(--warning)",
  vermelho: "var(--danger-deep)",
  novo: "var(--muted-foreground)",
};

/* ---------------- Biblioteca de indicadores sugeridos ---------------- */
/* Conteúdo estático — igual pra toda empresa, não é dado de organização
 * (mesmo espírito do audit-checklist-template.ts). Fica de fora do banco
 * nesta aba por decisão do prompt (nota "não implementar a biblioteca de
 * 25+ indicadores prontos"); os itens abaixo só preenchem o wizard, viram
 * indicador de verdade (linha em `indicators`) só quando adotados. */

export interface BibliotecaItem {
  nome: string;
  descricao: string;
  formula: string;
  unidade: string;
  frequencia: string;
  polaridade: Polaridade;
}

export const bibliotecaIndicadores: { categoria: string; itens: BibliotecaItem[] }[] = [
  {
    categoria: "Cliente",
    itens: [
      {
        nome: "Satisfação do cliente",
        descricao: "Pesquisa periódica junto à carteira ativa.",
        formula: "Média das notas da pesquisa",
        unidade: "nota",
        frequencia: "Trimestral",
        polaridade: "maior_melhor",
      },
      {
        nome: "Reclamações no período",
        descricao: "Volume de reclamações formais recebidas.",
        formula: "Contagem de reclamações",
        unidade: "un",
        frequencia: "Mensal",
        polaridade: "menor_melhor",
      },
      {
        nome: "Tempo médio de resposta",
        descricao: "Agilidade no retorno ao cliente.",
        formula: "Soma dos tempos ÷ nº de atendimentos",
        unidade: "h",
        frequencia: "Mensal",
        polaridade: "menor_melhor",
      },
      {
        nome: "Taxa de recompra",
        descricao: "Clientes que voltaram a comprar no período.",
        formula: "(Clientes recorrentes ÷ total) × 100",
        unidade: "%",
        frequencia: "Trimestral",
        polaridade: "maior_melhor",
      },
      {
        nome: "NPS",
        descricao: "Net Promoter Score da base de clientes.",
        formula: "% promotores − % detratores",
        unidade: "pts",
        frequencia: "Semestral",
        polaridade: "maior_melhor",
      },
    ],
  },
  {
    categoria: "Produto / Serviço",
    itens: [
      {
        nome: "Índice de retrabalho",
        descricao: "Peças ou serviços refeitos.",
        formula: "(Retrabalhos ÷ total produzido) × 100",
        unidade: "%",
        frequencia: "Mensal",
        polaridade: "menor_melhor",
      },
      {
        nome: "Produtos conformes na 1ª inspeção",
        descricao: "Qualidade assegurada na origem.",
        formula: "(Aprovados 1ª inspeção ÷ inspecionados) × 100",
        unidade: "%",
        frequencia: "Mensal",
        polaridade: "maior_melhor",
      },
      {
        nome: "Devoluções",
        descricao: "Itens devolvidos por não conformidade.",
        formula: "(Itens devolvidos ÷ entregues) × 100",
        unidade: "%",
        frequencia: "Mensal",
        polaridade: "menor_melhor",
      },
      {
        nome: "Tempo de ciclo de produção",
        descricao: "Duração média do ciclo produtivo.",
        formula: "Média do tempo por ordem de produção",
        unidade: "h",
        frequencia: "Mensal",
        polaridade: "menor_melhor",
      },
    ],
  },
  {
    categoria: "Fornecedores",
    itens: [
      {
        nome: "Cumprimento de prazo do fornecedor",
        descricao: "Pontualidade das entregas externas.",
        formula: "(Entregas no prazo ÷ total) × 100",
        unidade: "%",
        frequencia: "Mensal",
        polaridade: "maior_melhor",
      },
      {
        nome: "Nota média de avaliação",
        descricao: "Avaliação periódica de fornecedores críticos.",
        formula: "Média das notas de avaliação",
        unidade: "nota",
        frequencia: "Semestral",
        polaridade: "maior_melhor",
      },
      {
        nome: "Ocorrências por fornecedor",
        descricao: "Não conformidades atribuídas a terceiros.",
        formula: "Contagem de ocorrências",
        unidade: "un",
        frequencia: "Mensal",
        polaridade: "menor_melhor",
      },
      {
        nome: "Economia em negociação",
        descricao: "Ganho obtido frente ao orçado.",
        formula: "Orçado − negociado",
        unidade: "R$",
        frequencia: "Trimestral",
        polaridade: "maior_melhor",
      },
    ],
  },
  {
    categoria: "Processos internos",
    itens: [
      {
        nome: "Eficiência de processos",
        descricao: "Saídas conformes sobre recursos aplicados.",
        formula: "(Saídas conformes ÷ entradas) × 100",
        unidade: "%",
        frequencia: "Mensal",
        polaridade: "maior_melhor",
      },
      {
        nome: "Produtividade por equipe",
        descricao: "Volume entregue por equipe no período.",
        formula: "Entregas ÷ nº de colaboradores",
        unidade: "un",
        frequencia: "Mensal",
        polaridade: "maior_melhor",
      },
      {
        nome: "Absenteísmo",
        descricao: "Ausências não programadas.",
        formula: "(Horas de ausência ÷ horas previstas) × 100",
        unidade: "%",
        frequencia: "Mensal",
        polaridade: "menor_melhor",
      },
      {
        nome: "Turnover",
        descricao: "Rotatividade de pessoas.",
        formula: "(Desligamentos ÷ headcount médio) × 100",
        unidade: "%",
        frequencia: "Mensal",
        polaridade: "menor_melhor",
      },
      {
        nome: "Horas de treinamento realizadas",
        descricao: "Capacitação efetivamente executada.",
        formula: "Soma das horas de treinamento",
        unidade: "h",
        frequencia: "Mensal",
        polaridade: "maior_melhor",
      },
    ],
  },
  {
    categoria: "Qualidade do SGQ",
    itens: [
      {
        nome: "NCs abertas no período",
        descricao: "Volume de não conformidades registradas.",
        formula: "Contagem de NCs abertas",
        unidade: "un",
        frequencia: "Mensal",
        polaridade: "menor_melhor",
      },
      {
        nome: "Tempo médio de tratativa",
        descricao: "Da abertura ao encerramento da NC.",
        formula: "Média de dias por NC encerrada",
        unidade: "dias",
        frequencia: "Mensal",
        polaridade: "menor_melhor",
      },
      {
        nome: "Taxa de eficácia na 1ª verificação",
        descricao: "Ações aprovadas já na primeira verificação.",
        formula: "(Aprovadas 1ª verificação ÷ verificadas) × 100",
        unidade: "%",
        frequencia: "Mensal",
        polaridade: "maior_melhor",
      },
      {
        nome: "Planos vencidos",
        descricao: "Planos de ação fora do prazo.",
        formula: "Contagem de planos vencidos",
        unidade: "un",
        frequencia: "Mensal",
        polaridade: "menor_melhor",
      },
      {
        nome: "Taxa de reincidência",
        descricao: "NCs que voltaram a ocorrer.",
        formula: "(NCs reincidentes ÷ total) × 100",
        unidade: "%",
        frequencia: "Trimestral",
        polaridade: "menor_melhor",
      },
    ],
  },
  {
    categoria: "Estratégicos",
    itens: [
      {
        nome: "Atingimento de objetivos estratégicos",
        descricao: "Grau de atendimento dos objetivos do SGQ.",
        formula: "(Objetivos atingidos ÷ total) × 100",
        unidade: "%",
        frequencia: "Semestral",
        polaridade: "maior_melhor",
      },
      {
        nome: "Margem de lucro por processo",
        descricao: "Rentabilidade por processo de negócio.",
        formula: "(Receita − custo) ÷ receita × 100",
        unidade: "%",
        frequencia: "Trimestral",
        polaridade: "maior_melhor",
      },
      {
        nome: "ROI de investimentos em qualidade",
        descricao: "Retorno dos investimentos no SGQ.",
        formula: "(Ganho − investimento) ÷ investimento × 100",
        unidade: "%",
        frequencia: "Anual",
        polaridade: "maior_melhor",
      },
    ],
  },
];

export const processosKpi = [
  "Comercial",
  "Atendimento",
  "Produção",
  "Qualidade",
  "Suprimentos",
  "RH & SST",
];
export const frequenciasKpi = [
  "Diária",
  "Semanal",
  "Mensal",
  "Bimestral",
  "Trimestral",
  "Semestral",
  "Anual",
];
export const unidadesMedida = ["%", "R$", "dias", "h", "un", "nota", "pts"];
export const fontesDerivadas = [
  "NCs abertas",
  "Planos vencidos",
  "Satisfação do cliente",
  "Nota do fornecedor",
  "Taxa de eficácia",
  "Outros",
];
