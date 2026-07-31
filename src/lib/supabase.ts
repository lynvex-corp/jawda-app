import { createBrowserClient } from "@supabase/ssr";
import { assertNotReadOnly } from "./org-access-guard";

// NUNCA importar SUPABASE_SERVICE_ROLE_KEY aqui — este módulo roda no navegador.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type BrowserClient = ReturnType<typeof createBrowserClient>;

let client: BrowserClient | undefined;

const GUARDED_METHODS = new Set(["insert", "update", "upsert"]);

/** Intercepta insert/update/upsert de QUALQUER tabela pra aplicar o cadeado
 * de somente-leitura da escada de inadimplência (seção 7 do Guia) num único
 * lugar, em vez de espalhar a checagem por cada hook de mutação do app —
 * toda mutação do app passa por getSupabaseBrowserClient().from(...), então
 * um wrapper aqui cobre NC, Plano de Ação, Auditoria e Indicador de uma vez.
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
          return (value as (...a: unknown[]) => unknown).apply(target, args);
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
