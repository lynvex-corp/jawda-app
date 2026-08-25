import { getErrorMessage } from "@/lib/utils";

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
 * `toast.error(msg, { description: getErrorMessage(err) })`, e String(new Error(x))
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

/** Mensagem da rede de segurança do cadeado de RLS (org_can_write, migração
 * 20260801110000_delinquency_write_lock_function.sql) — cobre o caso raro
 * de a checagem visual da UI (isReadOnlyLevel/assertNotReadOnly) falhar por
 * algum motivo e a escrita chegar direto no banco. */
export const WRITE_LOCK_TOAST_MESSAGE =
  "Sua empresa está com pendência financeira e está em modo somente leitura. Regularize para voltar a editar.";

/** Detecta a rejeição do banco causada pelo cadeado de escrita:
 * - 42501: violação de RLS no INSERT (org_can_write reprovou o WITH CHECK).
 * - PGRST116: UPDATE que não afetou nenhuma linha porque a USING clause
 *   (que agora inclui org_can_write) filtrou a linha antes de chegar no
 *   .single() da chamada. Como nenhuma tabela travada tem hard delete
 *   (seção 2 do Guia), um UPDATE de um id válido do próprio usuário que não
 *   afeta nenhuma linha é, na prática, sempre o cadeado de inadimplência. */
export function isWriteLockRejection(error: unknown): boolean {
  if (error instanceof ReadOnlyModeError) return true;
  const code = (error as { code?: string } | null | undefined)?.code;
  return code === "42501" || code === "PGRST116";
}
