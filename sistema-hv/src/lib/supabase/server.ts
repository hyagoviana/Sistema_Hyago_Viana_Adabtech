import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

// Cliente server com service_role — BYPASSA RLS.
// Use APENAS em código server-side (server functions, scripts).
// Nunca exporte/importe em arquivos que rodam no browser.
export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente server.",
    );
  }

  adminClient = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
