// Template estático do checklist de auditoria interna ISO 9001 (v1 —
// única norma liberada, seção 9/10 do Guia de Arquitetura). Conteúdo de
// referência escrito com palavras próprias (nunca texto literal da norma —
// seção 12 do Guia), migrado do seed que vivia hardcoded em
// src/components/auditorias/detalhe.tsx (initialChecklist).
//
// Por que é um template estático em código, e não uma tabela: é conteúdo de
// REFERÊNCIA (a mesma lista de requisitos para toda auditoria interna ISO
// 9001, igual normasDisponiveis/locaisAuditaveis em mock-data.ts), não dado
// de uma organização específica. `audit_checklist_items` (banco) guarda só
// as linhas de UMA auditoria — são semeadas a partir deste template quando
// a auditoria interna é criada (useSeedAuditChecklist em
// src/lib/queries/audits.ts), e a partir daí cada linha vive e evolui
// independente do template (reclassificação não altera o template).
//
// requirement_code usa o id da pergunta (granularidade abaixo da cláusula
// ISO, ex. "4.3.1"/"4.3.2" dentro da cláusula 4.3) para preservar os dois
// pontos de verificação que 4.3 já tinha no protótipo — o campo aceita
// qualquer texto, não precisa ser exatamente o número da cláusula.

export interface AuditChecklistTemplateItem {
  sectionNumero: string;
  sectionTitulo: string;
  itemNumero: string;
  itemTitulo: string;
  requirementCode: string;
  requirementTitle: string;
  guidance: string;
}

export const AUDIT_CHECKLIST_TEMPLATE_ISO_9001: AuditChecklistTemplateItem[] = [
  {
    sectionNumero: "4",
    sectionTitulo: "Contexto da Organização",
    itemNumero: "4.1",
    itemTitulo: "Compreendendo a organização e seu contexto",
    requirementCode: "4.1.1",
    requirementTitle:
      "A organização determinou questões externas e internas pertinentes ao propósito?",
    guidance:
      "Verifique registros de análise de contexto (SWOT, PESTEL) e evidências de revisão periódica pela direção.",
  },
  {
    sectionNumero: "4",
    sectionTitulo: "Contexto da Organização",
    itemNumero: "4.3",
    itemTitulo: "Determinando o escopo do SGI",
    requirementCode: "4.3.1",
    requirementTitle: "O escopo do SGI está documentado, disponível e considera produtos/serviços?",
    guidance:
      "Confirme se o documento de escopo está publicado, acessível e cobre todos os produtos/serviços oferecidos.",
  },
  {
    sectionNumero: "4",
    sectionTitulo: "Contexto da Organização",
    itemNumero: "4.3",
    itemTitulo: "Determinando o escopo do SGI",
    requirementCode: "4.3.2",
    requirementTitle: "As unidades/filiais abrangidas pelo escopo estão claramente definidas?",
    guidance:
      "Confirme se as unidades/filiais cobertas pelo escopo estão listadas de forma explícita.",
  },
  {
    sectionNumero: "4",
    sectionTitulo: "Contexto da Organização",
    itemNumero: "4.4",
    itemTitulo: "SGI e seus processos",
    requirementCode: "4.4.1",
    requirementTitle: "Os processos necessários ao SGI estão determinados e interagem entre si?",
    guidance:
      "Verifique o mapa de processos e sua atualização frente a mudanças organizacionais recentes.",
  },
  {
    sectionNumero: "5",
    sectionTitulo: "Liderança",
    itemNumero: "5.1",
    itemTitulo: "Liderança e comprometimento",
    requirementCode: "5.1.1",
    requirementTitle: "A alta direção demonstra liderança e comprometimento com o SGI?",
    guidance:
      "Busque evidências de participação da alta direção em reuniões, análises críticas e comunicação da política.",
  },
  {
    sectionNumero: "5",
    sectionTitulo: "Liderança",
    itemNumero: "5.2",
    itemTitulo: "Política",
    requirementCode: "5.2.1",
    requirementTitle: "A política é apropriada e comunicada?",
    guidance:
      "Verifique se a política está documentada, comunicada e compreendida pelos colaboradores.",
  },
  {
    sectionNumero: "6",
    sectionTitulo: "Planejamento",
    itemNumero: "6.1",
    itemTitulo: "Ações para abordar riscos e oportunidades",
    requirementCode: "6.1.1",
    requirementTitle: "Riscos e oportunidades foram determinados e tratados?",
    guidance: "Verifique a matriz de riscos e oportunidades e sua atualização periódica.",
  },
  {
    sectionNumero: "6",
    sectionTitulo: "Planejamento",
    itemNumero: "6.2",
    itemTitulo: "Objetivos e planejamento",
    requirementCode: "6.2.1",
    requirementTitle: "Objetivos são coerentes com a política e mensuráveis?",
    guidance: "Verifique se os objetivos da qualidade são mensuráveis e coerentes com a política.",
  },
  {
    sectionNumero: "7",
    sectionTitulo: "Apoio",
    itemNumero: "7.1.3",
    itemTitulo: "Infraestrutura",
    requirementCode: "7.1.3.1",
    requirementTitle: "A infraestrutura necessária é determinada, provida e mantida?",
    guidance:
      "Verifique planos de manutenção e evidências de infraestrutura adequada aos processos.",
  },
  {
    sectionNumero: "7",
    sectionTitulo: "Apoio",
    itemNumero: "7.2",
    itemTitulo: "Competência",
    requirementCode: "7.2.1",
    requirementTitle: "Competências são determinadas e há registros de treinamento?",
    guidance: "Verifique matriz de competências, registros de treinamento e avaliação de eficácia.",
  },
  {
    sectionNumero: "7",
    sectionTitulo: "Apoio",
    itemNumero: "7.5",
    itemTitulo: "Informação documentada",
    requirementCode: "7.5.1",
    requirementTitle: "Existe controle de emissão, análise e distribuição de documentos?",
    guidance: "Verifique controle de emissão, revisão, aprovação e distribuição de documentos.",
  },
  {
    sectionNumero: "8",
    sectionTitulo: "Operação",
    itemNumero: "8.1",
    itemTitulo: "Planejamento e controle operacionais",
    requirementCode: "8.1.1",
    requirementTitle: "As operações estão planejadas, implementadas e controladas?",
    guidance: "Verifique planejamento operacional, critérios de aceitação e controles aplicados.",
  },
  {
    sectionNumero: "8",
    sectionTitulo: "Operação",
    itemNumero: "8.4",
    itemTitulo: "Controle de processos providos externamente",
    requirementCode: "8.4.1",
    requirementTitle: "Fornecedores externos são avaliados e monitorados?",
    guidance: "Verifique critérios de avaliação, seleção e monitoramento de fornecedores externos.",
  },
  {
    sectionNumero: "9",
    sectionTitulo: "Avaliação de Desempenho",
    itemNumero: "9.1",
    itemTitulo: "Monitoramento, medição, análise e avaliação",
    requirementCode: "9.1.1",
    requirementTitle: "O que precisa ser monitorado/medido está definido?",
    guidance:
      "Verifique se métodos, critérios e periodicidade de monitoramento/medição estão definidos.",
  },
  {
    sectionNumero: "9",
    sectionTitulo: "Avaliação de Desempenho",
    itemNumero: "9.2",
    itemTitulo: "Auditoria interna",
    requirementCode: "9.2.1",
    requirementTitle: "Auditorias internas são realizadas em intervalos planejados?",
    guidance:
      "Verifique programa de auditoria interna, critérios de imparcialidade e evidências de execução.",
  },
  {
    sectionNumero: "9",
    sectionTitulo: "Avaliação de Desempenho",
    itemNumero: "9.3",
    itemTitulo: "Análise crítica pela direção",
    requirementCode: "9.3.1",
    requirementTitle: "A alta direção realiza análise crítica em intervalos planejados?",
    guidance:
      "Verifique atas de análise crítica pela direção e suas entradas/saídas conforme a norma.",
  },
  {
    sectionNumero: "10",
    sectionTitulo: "Melhoria",
    itemNumero: "10.2",
    itemTitulo: "Não conformidade e ação corretiva",
    requirementCode: "10.2.1",
    requirementTitle: "NCs são tratadas com análise de causa e ação corretiva?",
    guidance:
      "Verifique tratamento de NCs: análise de causa, ação corretiva e verificação de eficácia.",
  },
  {
    sectionNumero: "10",
    sectionTitulo: "Melhoria",
    itemNumero: "10.3",
    itemTitulo: "Melhoria contínua",
    requirementCode: "10.3.1",
    requirementTitle: "A melhoria contínua é promovida a partir dos resultados?",
    guidance: "Verifique evidências de melhoria contínua a partir de resultados de desempenho.",
  },
];
