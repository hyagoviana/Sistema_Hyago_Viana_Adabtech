import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

// Singleton — evita instanciar múltiplos clientes a cada render.
export function getSupabaseBrowserClient() {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase browser: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes.");
  }

  client = createBrowserClient<Database>(url, anonKey);
  return client;
}
