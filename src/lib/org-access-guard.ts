/** Espelha organizations.status no cliente (seção 7 do Guia de
 * Arquitetura: escada de inadimplência). O cliente NUNCA lê
 * delinquency_state diretamente (RLS restrita a internal_staff — o
 * financeiro é área do Admin, o cliente só vê o efeito). organizations.status
 * é o único sinal disponível via RLS própria (organizations_select_own) e
 * já é mantido em sincronia com o nível da régua pelas funções do Admin
 * (generate_invoice/mark_invoice_paid/run_delinquency_check).
 *
 * Variável em módulo (fora do React) porque o wrapper do cliente Supabase
 * em supabase.ts precisa ler o nível sincronamente, de dentro de um
 * `.insert()/.update()`, sem poder chamar hook. useOrgAccessLevel()
 * mantém isso atualizado. */
export type OrgAccessLevel = "active" | "aware" | "read_only" | "blocked" | "terminated";

let currentLevel: OrgAccessLevel = "active";

export function setOrgAccessLevel(level: OrgAccessLevel) {
  currentLevel = level;
}

export function getOrgAccessLevel(): OrgAccessLevel {
  return currentLevel;
}

export function isReadOnlyLevel(level: OrgAccessLevel): boolean {
  return level === "read_only" || level === "blocked" || level === "terminated";
}

/** toString() sem o prefixo "Error:" — o padrão de erro deste app é
 * `toast.error(msg, { description: String(err) })`, e String(new Error(x))
 * viraria "Error: x" por padrão. */
export class ReadOnlyModeError extends Error {
  constructor() {
    super(
      "Ação bloqueada: sua empresa está com pendência financeira e o acesso está em modo somente leitura. Regularize para voltar a criar e editar registros.",
    );
    this.name = "ReadOnlyModeError";
  }
  toString() {
    return this.message;
  }
}

export function assertNotReadOnly() {
  if (isReadOnlyLevel(getOrgAccessLevel())) {
    throw new ReadOnlyModeError();
  }
}
