// Server-only — verifica se a requisição vem de um usuário autenticado.
// Lê o cookie de sessão do Supabase (definido pelo @supabase/ssr no browser)
// e valida o JWT via supabase.auth.getUser(). Lança AuthError(401) se inválido.

import { createClient } from "@supabase/supabase-js";
import { getCookies, getRequestHeader } from "@tanstack/react-start/server";

import { getSupabaseAdmin } from "./server";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const COOKIE_KEY = "sb-sptfmfeoikukrhbekitl-auth-token";

function extractAccessToken(): string | null {
  // 1. Authorization header (usado por clientes externos / testes)
  const authHeader = getRequestHeader("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

  // 2. Cookie Supabase SSR via getCookies() do TanStack Start
  let cookies: Record<string, string>;
  try {
    cookies = getCookies();
  } catch {
    cookies = {};
  }
  // Cookie único
  let raw = cookies[COOKIE_KEY];

  // Chunked: sb-xxx-auth-token.0, sb-xxx-auth-token.1, …
  if (!raw) {
    let chunked = "";
    for (let i = 0; cookies[`${COOKIE_KEY}.${i}`]; i++) {
      chunked += cookies[`${COOKIE_KEY}.${i}`];
    }
    if (chunked) raw = chunked;
  }
  if (!raw) return null;

  // Supabase SSR codifica o cookie em vários formatos possíveis:
  // - "base64-<base64 do JSON>"  (formato mais recente)
  // - URL-encoded JSON direto
  // - JSON puro
  try {
    let jsonStr: string;

    if (raw.startsWith("base64-")) {
      // Formato "base64-..." — decodificar base64 após o prefixo
      jsonStr = atob(raw.slice(7));
    } else {
      jsonStr = decodeURIComponent(raw);
      if (!jsonStr.startsWith("{")) {
        try {
          jsonStr = atob(jsonStr);
        } catch {
          /* keep as-is */
        }
      }
    }

    const parsed = JSON.parse(jsonStr);
    return typeof parsed === "string" ? parsed : (parsed.access_token ?? null);
  } catch {
    // JWT puro (sem wrapper JSON)
    if (raw.includes(".")) return raw;
    return null;
  }
}

/**
 * Valida que a requisição atual vem de um usuário autenticado.
 * Deve ser chamada dentro de um handler de `createServerFn`.
 *
 * @returns `{ id, email }` do usuário autenticado.
 * @throws  `AuthError` (status 401) se não autenticado ou sessão expirada.
 */
// Cache de validação de token — evita chamadas repetidas ao Supabase para o mesmo JWT
const tokenCache = new Map<string, { user: { id: string; email: string }; expiresAt: number }>();
const TOKEN_CACHE_TTL = 60 * 1000; // 1 min

export async function requireAuth(): Promise<{ id: string; email: string }> {
  const token = extractAccessToken();
  if (!token) throw new AuthError("Não autenticado");

  // Verifica cache para evitar revalidação do mesmo token
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

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

  const result = { id: user.id, email: user.email ?? "" };

  // Cacheia resultado para evitar N chamadas getUser() no mesmo request batch
  tokenCache.set(token, { user: result, expiresAt: Date.now() + TOKEN_CACHE_TTL });

  // Limpa entradas antigas periodicamente
  if (tokenCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of tokenCache) {
      if (v.expiresAt < now) tokenCache.delete(k);
    }
  }

  return result;
}

/**
 * Valida que o usuário autenticado tem um dos papéis permitidos.
 * Busca o papel em system_users (via admin client). Lança AuthError(403) se não.
 *
 * @returns `{ id, email, role }` do usuário autenticado.
 */
export async function requireRole(
  allowed: readonly string[],
): Promise<{ id: string; email: string; role: string }> {
  const user = await requireAuth();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new AuthError("Falha ao verificar permissões", 500);
  if (!data || data.status !== "active") throw new AuthError("Usuário inativo ou sem perfil", 403);
  if (!allowed.includes(data.role)) {
    throw new AuthError("Você não tem permissão para esta ação", 403);
  }
  return { id: user.id, email: user.email, role: data.role };
}
