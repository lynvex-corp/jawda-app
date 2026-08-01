import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import {
  assertNotReadOnly,
  isWriteLockRejection,
  WRITE_LOCK_TOAST_MESSAGE,
} from "./org-access-guard";

// NUNCA importar SUPABASE_SERVICE_ROLE_KEY aqui — este módulo roda no navegador.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type BrowserClient = ReturnType<typeof createBrowserClient>;

let client: BrowserClient | undefined;

const GUARDED_METHODS = new Set(["insert", "update", "upsert"]);

/** Depois de insert/update/upsert, o resto da chamada é encadeamento
 * (.eq()/.select()/.single()...) até o `await`/`.then()` final resolver a
 * promise. Embrulha esse resto recursivamente pra interceptar exatamente o
 * ponto de resolução — onde o Postgrest devolve `{ data, error }` sem
 * lançar exceção — sem precisar saber de antemão como cada hook encadeia a
 * chamada. Isso dá um único ponto de observação pra QUALQUER mutação atual
 * ou futura do app, sem precisar repetir a checagem em cada hook. */
function wrapChain<T>(value: T): T {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
  return new Proxy(value as object, {
    get(target, prop, receiver) {
      if (prop === "then") {
        const realThen = Reflect.get(target, prop, receiver) as (
          onFulfilled?: (v: unknown) => unknown,
          onRejected?: (e: unknown) => unknown,
        ) => unknown;
        return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          realThen.call(
            target,
            (result: unknown) => {
              const error = (result as { error?: unknown } | null)?.error;
              if (error && isWriteLockRejection(error)) {
                toast.error("Modo somente leitura", { description: WRITE_LOCK_TOAST_MESSAGE });
              }
              return onFulfilled ? onFulfilled(result) : result;
            },
            onRejected,
          );
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) =>
          wrapChain((value as (...a: unknown[]) => unknown).apply(target, args));
      }
      return wrapChain(value);
    },
  }) as T;
}

/** Intercepta insert/update/upsert de QUALQUER tabela pra aplicar o cadeado
 * de somente-leitura da escada de inadimplência (seção 7 do Guia) num único
 * lugar, em vez de espalhar a checagem por cada hook de mutação do app —
 * toda mutação do app passa por getSupabaseBrowserClient().from(...), então
 * um wrapper aqui cobre NC, Plano de Ação, Auditoria e Indicador de uma vez.
 * Além do bloqueio client-side (assertNotReadOnly, antes mesmo de chamar o
 * banco), wrapChain() cobre a rede de segurança do cadeado em RLS
 * (org_can_write) — para o caso raro de o estado local estar desatualizado
 * e a rejeição vir só do banco.
 * Não intercepta select() nem RPC: leitura e exportação continuam liberadas
 * em qualquer nível da régua, de propósito (seção 7: "cliente sempre pode
 * exportar"). A única RPC de escrita hoje (update_indicator_target) tem sua
 * própria checagem explícita em indicators.ts. */
function guardQueryBuilder<T extends object>(builder: T): T {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function" && GUARDED_METHODS.has(String(prop))) {
        return (...args: unknown[]) => {
          assertNotReadOnly();
          return wrapChain((value as (...a: unknown[]) => unknown).apply(target, args));
        };
      }
      return value;
    },
  });
}

function guardClient(raw: BrowserClient): BrowserClient {
  return new Proxy(raw, {
    get(target, prop, receiver) {
      if (prop === "from") {
        const original = Reflect.get(target, prop, receiver) as (...a: unknown[]) => object;
        return (...args: unknown[]) => guardQueryBuilder(original.apply(target, args));
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as BrowserClient;
}

export function getSupabaseBrowserClient() {
  if (!client) {
    client = guardClient(createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  }
  return client;
}
