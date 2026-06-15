// Server-only — verifica se a requisição vem de um usuário autenticado.
// Lê o cookie de sessão do Supabase (definido pelo @supabase/ssr no browser)
// e valida o JWT via supabase.auth.getUser(). Lança AuthError(401) se inválido.

import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const COOKIE_PREFIX = "sb-sptfmfeoikukrhbekitl-auth-token";

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 1) continue;
    out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return out;
}

function extractAccessToken(request: Request): string | null {
  // 1. Authorization header (usado por clientes externos / testes)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

  // 2. Cookie Supabase SSR — pode ser único ou chunked (.0, .1, …)
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = parseCookies(cookieHeader);

  let raw = cookies[COOKIE_PREFIX];
  if (!raw) {
    let chunked = "";
    for (let i = 0; cookies[`${COOKIE_PREFIX}.${i}`]; i++) {
      chunked += cookies[`${COOKIE_PREFIX}.${i}`];
    }
    if (chunked) raw = chunked;
  }
  if (!raw) return null;

  // O @supabase/ssr armazena como JSON URL-encoded: {"access_token":"…",…}
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return typeof parsed === "string" ? parsed : parsed.access_token ?? null;
  } catch {
    return raw; // JWT puro (sem wrapper JSON)
  }
}

/**
 * Valida que a requisição atual vem de um usuário autenticado.
 * Deve ser chamada dentro de um handler de `createServerFn`.
 *
 * @returns `{ id, email }` do usuário autenticado.
 * @throws  `AuthError` (status 401) se não autenticado ou sessão expirada.
 */
export async function requireAuth(): Promise<{ id: string; email: string }> {
  const request = getRequest();
  const token = extractAccessToken(request);
  if (!token) throw new AuthError("Não autenticado");

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new AuthError("Configuração do Supabase ausente", 500);

  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new AuthError("Sessão inválida ou expirada");

  return { id: user.id, email: user.email ?? "" };
}
