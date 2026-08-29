import type { CodePrefix } from "./jawda-store";

export interface AiChip {
  label: string;
  prompt: string;
}

export interface AiModuleContext {
  moduleName: string;
  greeting: string;
  chips: AiChip[];
}

const DEFAULT_CTX: AiModuleContext = {
  moduleName: "Jáwda",
  greeting:
    "Olá, Ana! Sou a IA Jáwda. Posso ajudar a interpretar indicadores, redigir registros e sugerir ações. Como posso ajudar?",
  chips: [
    { label: "Resumir a semana", prompt: "Resuma os principais eventos da semana no SGI." },
    { label: "O que priorizar hoje?", prompt: "O que devo priorizar hoje?" },
    { label: "Explicar um indicador", prompt: "Explique o que é o índice de conformidade geral." },
  ],
};

const MODULES: Array<{ match: (p: string) => boolean; ctx: AiModuleContext }> = [
  {
    match: (p) => p === "/" || p.startsWith("/dashboard"),
    ctx: {
      moduleName: "Dashboard Executivo",
      greeting:
        "Vejo que você está no Dashboard Executivo. Posso destacar riscos abertos, planos atrasados ou preparar um resumo para a diretoria.",
      chips: [
        { label: "Resumo executivo", prompt: "Faça um resumo executivo do momento atual do SGI." },
        {
          label: "Onde estão os gargalos?",
          prompt: "Onde estão os principais gargalos do sistema?",
        },
        { label: "Ideias de melhoria", prompt: "Sugira 3 iniciativas de melhoria contínua." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/nao-conformidades"),
    ctx: {
      moduleName: "Não Conformidades",
      greeting:
        "Estamos em Não Conformidades. Posso ajudar a redigir uma NC, sugerir gravidade/SLA ou conduzir uma análise de causa raiz.",
      chips: [
        { label: "Redigir nova NC", prompt: "Ajude-me a redigir uma nova não conformidade." },
        {
          label: "Classificar gravidade",
          prompt: "Como classificar corretamente a gravidade de uma NC?",
        },
        {
          label: "Sugerir análise de causa",
          prompt: "Sugira uma análise de causa raiz para uma NC de reincidência.",
        },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/planos-de-acao"),
    ctx: {
      moduleName: "Planos de Ação",
      greeting:
        "Você está em Planos de Ação. Posso gerar um detalhamento completo da ação a partir de uma NC ou risco e sugerir prazos por criticidade.",
      chips: [
        {
          label: "Gerar plano com IA",
          prompt: "Gere um plano de ação para uma NC crítica de reincidência.",
        },
        { label: "Riscos de atraso", prompt: "Quais planos correm risco de atraso?" },
        { label: "Sugerir contenção", prompt: "Sugira uma ação de contenção imediata." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/auditorias"),
    ctx: {
      moduleName: "Auditorias",
      greeting:
        "Estamos em Auditorias. Posso ajudar a redigir apontamentos, montar plano de auditoria por normas e sugerir escopos.",
      chips: [
        { label: "Montar plano com IA", prompt: "Monte um plano de auditoria ISO 9001 em 2 dias." },
        {
          label: "Redigir apontamento",
          prompt: "Ajude-me a redigir um apontamento no padrão de auditoria.",
        },
        { label: "Sugerir escopo", prompt: "Sugira um escopo para auditoria de suprimentos." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/riscos"),
    ctx: {
      moduleName: "Riscos e Oportunidades",
      greeting:
        "Você está em Riscos e Oportunidades. Posso sugerir riscos típicos de um processo e propor ações de tratamento.",
      chips: [
        {
          label: "Identificar riscos",
          prompt: "Identifique riscos típicos do processo de envase.",
        },
        { label: "Riscos sem ação", prompt: "Quais riscos altos estão sem plano vinculado?" },
        { label: "Sugerir oportunidade", prompt: "Sugira uma oportunidade de melhoria." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/analise-cenario"),
    ctx: {
      moduleName: "Análise de Cenário (SWOT)",
      greeting:
        "Estamos na Análise de Cenário. Posso analisar seu SWOT e propor estratégias cruzando forças com oportunidades.",
      chips: [
        { label: "Analisar SWOT", prompt: "Analise o SWOT e proponha estratégias." },
        {
          label: "Sugerir fraquezas",
          prompt: "Que fraquezas costumam faltar num SWOT industrial?",
        },
        { label: "Estratégias FO", prompt: "Sugira 3 estratégias força-oportunidade." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/partes-interessadas"),
    ctx: {
      moduleName: "Partes Interessadas",
      greeting:
        "Você está em Partes Interessadas. Posso sugerir stakeholders comumente esquecidos com necessidades e requisitos pré-preenchidos.",
      chips: [
        {
          label: "Mapear partes com IA",
          prompt: "Sugira partes interessadas para uma indústria alimentícia.",
        },
        {
          label: "Priorizar stakeholders",
          prompt: "Como priorizar stakeholders pelo mapa influência × interesse?",
        },
        { label: "Requisitos legais", prompt: "Quais requisitos legais aplicáveis considerar?" },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/indicadores"),
    ctx: {
      moduleName: "Indicadores e KPIs",
      greeting:
        "Estamos em Indicadores. Posso interpretar tendências, sugerir KPIs por processo e apontar indicadores fora de meta.",
      chips: [
        { label: "Indicadores fora da meta", prompt: "Quais indicadores estão fora da meta?" },
        { label: "Sugerir novo KPI", prompt: "Sugira um KPI para monitorar retrabalho." },
        { label: "Interpretar tendência", prompt: "Interprete a tendência do OEE." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/documentos"),
    ctx: {
      moduleName: "Documentos",
      greeting:
        "Você está em Documentos. Posso sugerir revisões pendentes e ajudar a redigir cabeçalho, escopo e controle de revisões.",
      chips: [
        { label: "Revisões vencidas", prompt: "Que documentos estão com revisão vencida?" },
        { label: "Redigir POP", prompt: "Sugira estrutura de um POP." },
        { label: "Controle de versões", prompt: "Como controlar versões corretamente?" },
      ],
    },
  },
];

export function getAssistantContext(pathname: string): AiModuleContext {
  const found = MODULES.find((m) => m.match(pathname));
  return found?.ctx ?? DEFAULT_CTX;
}

/* ============================================================
 * Respostas pré-escritas — retorna markdown + ação opcional
 * ============================================================ */

export interface AssistantAction {
  label: string;
  kind: "create_nc" | "create_plano" | "create_auditoria" | "create_risco";
  payload: Record<string, unknown>;
  code?: CodePrefix;
}

export interface AssistantResponse {
  markdown: string;
  action?: AssistantAction;
}

function has(text: string, ...keys: string[]) {
  const t = text.toLowerCase();
  return keys.some((k) => t.includes(k));
}

export function respondTo(prompt: string, moduleName: string): AssistantResponse {
  const p = prompt.toLowerCase();

  if (has(p, "redigir", "nova nc", "não conformidade", "nao conformidade") && !has(p, "plano")) {
    return {
      markdown: `## Sugestão de redação para nova NC

**Descrição proposta:**
Divergência identificada durante inspeção de rotina no processo, com potencial impacto em conformidade do produto final e requisito 8.7 da ISO 9001.

**Classificação sugerida:**
- Origem: *Rotina do processo*
- Gravidade: **Média** — impacto controlado, sem risco imediato ao cliente
- SLA: 5 dias úteis

Posso criar esta NC no seu quadro agora.`,
      action: {
        label: "Aplicar sugestão — criar NC",
        kind: "create_nc",
        code: "NC",
        payload: {
          descricao:
            "Divergência identificada durante inspeção de rotina no processo, com potencial impacto em conformidade do produto final.",
          origem: "Rotina do processo",
          gravidade: "Média",
        },
      },
    };
  }

  if (has(p, "plano de ação", "plano de acao", "5w2h", "gere um plano", "gerar plano")) {
    return {
      markdown: `## Plano de ação sugerido (Detalhamento da Ação)

**Contenção imediata:** Isolar lote e interditar processo até validação.

**Ações corretivas:**
1. **O quê:** Revisar POP-ENV-03 e retreinar operadores
   **Onde:** Linha de envase 03 — **Quem:** Diego Almeida
   **Quando:** 10 dias — **Como:** Workshop + auditoria de aderência
   **Quanto:** R$ 2.800 — **Por quê:** Eliminar variabilidade humana
2. **O quê:** Instalar poka-yoke na etiquetadora
   **Onde:** Setor de rotulagem — **Quem:** Rafael Costa
   **Quando:** 25 dias — **Como:** Projeto + aquisição
   **Quanto:** R$ 9.800 — **Por quê:** Reduzir erro de rastreabilidade

**Prazo total sugerido:** 30 dias (criticidade Alta)
**Resultado esperado:** Zerar recorrência em 60 dias.`,
      action: {
        label: "Aplicar tudo — criar plano",
        kind: "create_plano",
        code: "PA",
        payload: {
          descricao:
            "Revisar POP-ENV-03, retreinar operadores e instalar poka-yoke na etiquetadora",
          origemTipo: "Não Conformidade",
          pdca: "Plan",
          status: "Planejado",
        },
      },
    };
  }

  if (has(p, "auditoria", "montar plano", "escopo")) {
    return {
      markdown: `## Plano de auditoria sugerido

**Escopo:** ISO 9001:2015 — SGI matriz, 2 dias

**Dia 1**
- 08h30 · Reunião de abertura — 5.1, 5.2
- 09h30 · Contexto e partes interessadas — 4.1, 4.2, 4.3
- 14h00 · Suprimentos e 8.4 — sugeri incluir porque o último ciclo apontou fragilidade em qualificação

**Dia 2**
- 08h30 · Produção e realização — 8.1, 8.5
- 14h00 · Análise crítica — 9.3 · Melhoria — 10.1, 10.2
- 17h00 · Reunião de encerramento

Posso já programar essa auditoria no sistema.`,
      action: {
        label: "Aplicar sugestão — programar auditoria",
        kind: "create_auditoria",
        code: "AUD",
        payload: {
          escopo: "ISO 9001:2015 — SGI matriz, 2 dias",
          normas: ["ISO 9001"],
          tipo: "Interna",
          status: "Programada",
        },
      },
    };
  }

  if (has(p, "risco", "identificar risco")) {
    return {
      markdown: `## Riscos típicos do processo de envase

| Risco | Prob. | Impacto |
| --- | :-: | :-: |
| Falha de dosagem por descalibração | 3 | 4 |
| Contaminação cruzada entre produtos | 2 | 5 |
| Selagem inadequada gerando vazamento | 3 | 3 |

**Justificativa:** processos de envase têm alta variabilidade quando calibração e higienização não são padronizadas por turno.

Posso adicionar o primeiro risco ao seu mapa.`,
      action: {
        label: "Adicionar risco ao mapa",
        kind: "create_risco",
        code: "RISCO",
        payload: {
          descricao: "Falha de dosagem por descalibração de balança",
          processo: "Envase",
          probabilidade: 3,
          impacto: 4,
        },
      },
    };
  }

  if (has(p, "swot", "estratégia", "estrategia")) {
    return {
      markdown: `## Análise SWOT cruzada

**Estratégias força × oportunidade (FO)**
1. Usar **liderança técnica** para atender a demanda crescente do **setor de food service**
2. Alavancar a **certificação ISO** para conquistar contratos de grandes varejistas

**Estratégias fraqueza × ameaça (FA)**
3. Reduzir dependência de fornecedor único de MP-2231 para mitigar risco de desabastecimento

Cada estratégia pode virar um plano de ação com um clique.`,
    };
  }

  if (has(p, "partes interessadas", "stakeholder")) {
    return {
      markdown: `## Partes interessadas frequentemente esquecidas

- **Órgão ambiental (IBAMA/estadual)** — requer licenciamento e relatórios periódicos
- **Comunidade do entorno** — ruído, tráfego e responsabilidade social
- **Sindicato dos trabalhadores** — acordos coletivos e SST
- **Seguradora** — laudos de risco e inspeções técnicas

Todas com necessidades e requisitos já pré-preenchidos, prontas para adicionar.`,
    };
  }

  if (has(p, "resumo", "resumir", "priorizar", "priorizar hoje", "gargalo")) {
    return {
      markdown: `## Panorama do momento

- **3 planos de ação atrasados** — recomendo focar em ${moduleName === "Planos de Ação" ? "PA-2026-000003" : "manutenção da SEL-02"}
- **NCs vencidas** aguardando análise de causa
- **Auditoria externa DNV** em andamento — checklist em 62%

**Prioridade sugerida para hoje:**
1. Concluir tratativa do plano atrasado mais crítico
2. Aprovar planos em avaliação
3. Revisar apontamentos da auditoria em andamento`,
    };
  }

  if (has(p, "indicador", "kpi", "meta", "tendência", "tendencia", "oee")) {
    return {
      markdown: `## Indicadores fora da meta

- **OEE — Linha de Envase:** 78% (meta 85%) · tendência ↑
- **Reclamação de Clientes:** 3,4/1k (meta 2,0) · tendência ↓
- **Consumo energético:** 132 kWh/t (meta 120) · tendência ↓

Sugestão: priorizar plano de melhoria da linha de envase, que impacta 2 desses indicadores simultaneamente.`,
    };
  }

  return {
    markdown: `Entendi. No contexto de **${moduleName}**, posso ajudar com:

- Redigir registros no padrão de auditoria
- Sugerir classificações e prazos por criticidade
- Analisar causa raiz e propor planos de ação
- Identificar riscos e oportunidades típicos

Me diga um pouco mais sobre o que você precisa — ou toque em uma das sugestões rápidas.`,
  };
}
