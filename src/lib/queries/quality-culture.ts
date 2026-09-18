import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";

/* ============================================================
 * "Cultura da Qualidade" (item 5, Bloco 6) — autodiagnóstico anual de
 * maturidade, aplicado a TODOS os usuários ativos da organização (não um
 * respondente só, porque cultura é coletiva). Resultado = média agregada
 * das respostas, virando % de maturidade geral e por dimensão.
 *
 * Reaproveita `org_climate_surveys` (kind='cultura_qualidade') pra
 * janela/período — mesmo mecanismo já usado pela pesquisa de clima. As
 * respostas ficam numa tabela própria (quality_culture_survey_answers),
 * porque as 24 afirmações não cabem nas colunas fixas de
 * org_climate_survey_responses (ver comentário na migration
 * 20260918090100_quality_culture_survey.sql).
 * ============================================================ */

export type QualityCultureDimensao =
  | "lideranca"
  | "foco_cliente"
  | "melhoria_continua"
  | "processos"
  | "evidencias"
  | "relacionamento"
  | "engajamento";

export const DIMENSAO_LABEL: Record<QualityCultureDimensao, string> = {
  lideranca: "Liderança e Comprometimento",
  foco_cliente: "Foco no Cliente",
  melhoria_continua: "Melhoria Contínua",
  processos: "Abordagem por Processos",
  evidencias: "Tomada de Decisão Baseada em Evidências",
  relacionamento: "Gestão de Relacionamento",
  engajamento: "Engajamento das Pessoas",
};

export interface QualityCultureQuestion {
  codigo: string;
  dimensao: QualityCultureDimensao;
  texto: string;
}

/** As 24 afirmações, mapeando os 7 princípios de gestão da qualidade da
 * ISO 9001 — versionadas em código (não no banco) porque ajustar o texto
 * de uma afirmação não deve exigir migração. Mudar o SENTIDO de uma
 * afirmação já aplicada, no entanto, invalida a comparação histórica —
 * nesse caso o certo é aposentar o `codigo` antigo e criar um novo, nunca
 * reescrever o texto de um código já usado numa rodada passada. */
export const QUALITY_CULTURE_QUESTIONS: QualityCultureQuestion[] = [
  {
    codigo: "lid_1",
    dimensao: "lideranca",
    texto:
      "A liderança da empresa demonstra, na prática (não só em discurso), comprometimento com a qualidade.",
  },
  {
    codigo: "lid_2",
    dimensao: "lideranca",
    texto: "As decisões da direção consideram o impacto na qualidade e na satisfação do cliente.",
  },
  {
    codigo: "lid_3",
    dimensao: "lideranca",
    texto: "Os líderes das áreas cobram e reconhecem boas práticas de qualidade das suas equipes.",
  },
  {
    codigo: "lid_4",
    dimensao: "lideranca",
    texto:
      "Existem recursos (tempo, pessoas, orçamento) suficientes para as ações de qualidade acontecerem de verdade.",
  },
  {
    codigo: "cli_1",
    dimensao: "foco_cliente",
    texto:
      "As pessoas da empresa entendem quem é o cliente e o que ele espera do nosso produto/serviço.",
  },
  {
    codigo: "cli_2",
    dimensao: "foco_cliente",
    texto: "Reclamações e feedbacks de clientes são tratados com seriedade e viram ação concreta.",
  },
  {
    codigo: "cli_3",
    dimensao: "foco_cliente",
    texto:
      "Decisões do dia a dia levam em conta o impacto no cliente final, não só no processo interno.",
  },
  {
    codigo: "cli_4",
    dimensao: "foco_cliente",
    texto: "A satisfação do cliente é acompanhada e discutida regularmente pela equipe.",
  },
  {
    codigo: "mel_1",
    dimensao: "melhoria_continua",
    texto: "As pessoas se sentem à vontade para sugerir melhorias nos processos que executam.",
  },
  {
    codigo: "mel_2",
    dimensao: "melhoria_continua",
    texto:
      "Erros e não conformidades são vistos como oportunidade de aprender, não só como motivo de punição.",
  },
  {
    codigo: "mel_3",
    dimensao: "melhoria_continua",
    texto: "Ações corretivas realmente eliminam a causa dos problemas, não só o sintoma.",
  },
  {
    codigo: "mel_4",
    dimensao: "melhoria_continua",
    texto: "Há espaço para testar e implementar melhorias sem burocracia excessiva.",
  },
  {
    codigo: "proc_1",
    dimensao: "processos",
    texto:
      "As pessoas entendem como o trabalho delas se conecta com o processo como um todo, não só a própria tarefa.",
  },
  {
    codigo: "proc_2",
    dimensao: "processos",
    texto: "Os processos estão documentados de forma clara e acessível a quem precisa deles.",
  },
  {
    codigo: "proc_3",
    dimensao: "processos",
    texto:
      "Mudanças em um processo consideram o impacto em processos vizinhos antes de serem implementadas.",
  },
  {
    codigo: "evi_1",
    dimensao: "evidencias",
    texto:
      "Decisões importantes são baseadas em dados e indicadores, não só em opinião ou intuição.",
  },
  {
    codigo: "evi_2",
    dimensao: "evidencias",
    texto: "Os indicadores de qualidade são conhecidos e acompanhados pelas pessoas certas.",
  },
  {
    codigo: "evi_3",
    dimensao: "evidencias",
    texto:
      "Quando um indicador foge da meta, isso gera uma investigação real, não só um registro burocrático.",
  },
  {
    codigo: "rel_1",
    dimensao: "relacionamento",
    texto:
      "A empresa mantém um bom relacionamento e comunicação clara com fornecedores e parceiros críticos.",
  },
  {
    codigo: "rel_2",
    dimensao: "relacionamento",
    texto:
      "Problemas com fornecedores são resolvidos de forma colaborativa, buscando solução conjunta.",
  },
  {
    codigo: "rel_3",
    dimensao: "relacionamento",
    texto: "As áreas internas colaboram entre si em vez de trabalhar de forma isolada.",
  },
  {
    codigo: "eng_1",
    dimensao: "engajamento",
    texto:
      "As pessoas entendem por que o sistema de gestão da qualidade existe e qual o valor dele.",
  },
  {
    codigo: "eng_2",
    dimensao: "engajamento",
    texto:
      "Existe reconhecimento real para quem contribui com a qualidade (não só cobrança quando algo dá errado).",
  },
  {
    codigo: "eng_3",
    dimensao: "engajamento",
    texto:
      "As pessoas se sentem donas da qualidade do que produzem, não como responsabilidade só do setor de Qualidade.",
  },
];

export interface QualityCultureSurvey {
  id: string;
  janelaInicio: string;
  janelaFim: string;
  createdAt: string;
}

const keys = {
  all: ["quality-culture-surveys"] as const,
  list: () => [...keys.all, "list"] as const,
  myStatus: () => [...keys.all, "my-status"] as const,
  results: (surveyId: string) => [...keys.all, "results", surveyId] as const,
  latestResults: () => [...keys.all, "latest-results"] as const,
};

interface SurveyRow {
  id: string;
  janela_inicio: string;
  janela_fim: string;
  created_at: string;
}

function mapSurvey(s: SurveyRow): QualityCultureSurvey {
  return {
    id: s.id,
    janelaInicio: s.janela_inicio,
    janelaFim: s.janela_fim,
    createdAt: s.created_at,
  };
}

/** Rodadas de Cultura da Qualidade já programadas, mais recente primeiro. */
export function useQualityCultureSurveys() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: keys.list(),
    queryFn: async (): Promise<QualityCultureSurvey[]> => {
      const { data, error } = await supabase
        .from("org_climate_surveys")
        .select("id, janela_inicio, janela_fim, created_at")
        .eq("kind", "cultura_qualidade")
        .order("janela_inicio", { ascending: false });
      if (error) throw error;
      return ((data as unknown as SurveyRow[]) ?? []).map(mapSurvey);
    },
  });
}

/** Programa uma nova rodada anual — Administrador/Gestor da Qualidade
 * (is_hr_authorized), mesma régua da pesquisa de clima. */
export function useCreateQualityCultureSurvey() {
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
        .insert({ janela_inicio: janelaInicio, janela_fim: janelaFim, kind: "cultura_qualidade" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.list() });
      queryClient.invalidateQueries({ queryKey: keys.myStatus() });
    },
  });
}

/** A rodada aberta agora que EU ainda não respondi — ou null. Mesmo padrão
 * de useMyOpenOrgClimateSurvey (pessoas.ts), só filtrando kind e checando
 * a tabela de respostas própria de Cultura da Qualidade. */
export function useMyOpenQualityCultureSurvey() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: keys.myStatus(),
    queryFn: async (): Promise<QualityCultureSurvey | null> => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: surveys, error } = await supabase
        .from("org_climate_surveys")
        .select("id, janela_inicio, janela_fim, created_at")
        .eq("kind", "cultura_qualidade")
        .lte("janela_inicio", hoje)
        .gte("janela_fim", hoje)
        .order("janela_inicio", { ascending: false });
      if (error) throw error;
      const abertas = ((surveys as unknown as SurveyRow[]) ?? []).map(mapSurvey);
      if (abertas.length === 0) return null;

      const { data: minhas, error: respErr } = await supabase
        .from("quality_culture_survey_answers")
        .select("survey_id")
        .in(
          "survey_id",
          abertas.map((s) => s.id),
        );
      if (respErr) throw respErr;
      const respondidas = new Set(
        ((minhas as unknown as { survey_id: string }[]) ?? []).map((r) => r.survey_id),
      );

      return abertas.find((s) => !respondidas.has(s.id)) ?? null;
    },
  });
}

export function useSubmitQualityCultureSurveyResponse() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { surveyId: string; respostas: Record<string, number> }) => {
      const { error } = await supabase
        .from("quality_culture_survey_answers")
        .insert({ survey_id: input.surveyId, respostas: input.respostas });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.myStatus() });
      queryClient.invalidateQueries({ queryKey: keys.results("") });
      queryClient.invalidateQueries({ queryKey: keys.latestResults() });
    },
  });
}

export interface QualityCultureResults {
  totalRespostas: number;
  /** 0-100, média geral convertida em % de maturidade. `null` sem resposta. */
  maturidadeGeral: number | null;
  porDimensao: { dimensao: QualityCultureDimensao; label: string; maturidade: number | null }[];
}

function agregarRespostas(rows: { respostas: Record<string, number> }[]): QualityCultureResults {
  const porCodigo = new Map<string, number[]>();
  for (const row of rows) {
    for (const [codigo, nota] of Object.entries(row.respostas)) {
      const lista = porCodigo.get(codigo) ?? [];
      lista.push(nota);
      porCodigo.set(codigo, lista);
    }
  }

  const mediaParaNota = (media: number) => Math.round(((media - 1) / 4) * 100);

  const porDimensao = (Object.keys(DIMENSAO_LABEL) as QualityCultureDimensao[]).map((dimensao) => {
    const notas = QUALITY_CULTURE_QUESTIONS.filter((q) => q.dimensao === dimensao).flatMap(
      (q) => porCodigo.get(q.codigo) ?? [],
    );
    const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
    return {
      dimensao,
      label: DIMENSAO_LABEL[dimensao],
      maturidade: media === null ? null : mediaParaNota(media),
    };
  });

  const todasNotas = [...porCodigo.values()].flat();
  const mediaGeral = todasNotas.length
    ? todasNotas.reduce((a, b) => a + b, 0) / todasNotas.length
    : null;

  return {
    totalRespostas: rows.length,
    maturidadeGeral: mediaGeral === null ? null : mediaParaNota(mediaGeral),
    porDimensao,
  };
}

/** Resultado agregado de uma rodada — só quem tem governança
 * (is_hr_authorized) enxerga as respostas de outras pessoas via RLS;
 * agregação em memória (mesmo padrão de useOrgClimateSurveyResults e de
 * aggregateByCreator em reconhecimento.ts — não dá pra GROUP BY jsonb
 * direto no PostgREST). */
export function useQualityCultureSurveyResults(surveyId: string | undefined) {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: keys.results(surveyId ?? ""),
    enabled: !!surveyId,
    queryFn: async (): Promise<QualityCultureResults> => {
      const { data, error } = await supabase
        .from("quality_culture_survey_answers")
        .select("respostas")
        .eq("survey_id", surveyId as string);
      if (error) throw error;
      return agregarRespostas((data as unknown as { respostas: Record<string, number> }[]) ?? []);
    },
  });
}

/** Indicador da Gestão à Vista (item 5) — resultado da rodada de Cultura
 * da Qualidade mais recente que já tem pelo menos 1 resposta, seja ela
 * aberta ou encerrada. `null` quando nenhuma rodada foi programada ainda. */
export function useLatestQualityCultureIndicator() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: keys.latestResults(),
    refetchInterval: 60_000,
    queryFn: async (): Promise<
      (QualityCultureResults & { survey: QualityCultureSurvey }) | null
    > => {
      const { data: surveys, error } = await supabase
        .from("org_climate_surveys")
        .select("id, janela_inicio, janela_fim, created_at")
        .eq("kind", "cultura_qualidade")
        .order("janela_inicio", { ascending: false })
        .limit(1);
      if (error) throw error;
      const ultima = ((surveys as unknown as SurveyRow[]) ?? [])[0];
      if (!ultima) return null;

      const { data: respostas, error: respErr } = await supabase
        .from("quality_culture_survey_answers")
        .select("respostas")
        .eq("survey_id", ultima.id);
      if (respErr) throw respErr;

      return {
        ...agregarRespostas(
          (respostas as unknown as { respostas: Record<string, number> }[]) ?? [],
        ),
        survey: mapSurvey(ultima),
      };
    },
  });
}
