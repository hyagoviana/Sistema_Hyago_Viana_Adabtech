// Server-only — verifica se a requisição vem de um usuário autenticado.
// Lê o cookie de sessão do Supabase (definido pelo @supabase/ssr no browser)
// e valida o JWT via supabase.auth.getUser(). Lança AuthError(401) se inválido.

import { createClient } from "@supabase/supabase-js";
import { getCookies, getRequestHeader } from "@tanstack/react-start/server";

import { getUserModulePerms, getRoleModuleDefaults } from "../rbac-perms-service";
import { permissaoEfetiva, type Module, type ModuleAction, type Role } from "../rbac";
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

  // Revogação de acesso: mesmo com JWT válido, o usuário PRECISA ter perfil ativo
  // em system_users. Se foi EXCLUÍDO (linha some / deleted_at) ou SUSPENSO, o acesso
  // é negado imediatamente (na próxima requisição). INVITED é permitido — está em
  // onboarding (define senha/ativa). Antes, suspender/excluir não tirava o acesso
  // da sessão já aberta (o JWT continuava valendo ~1h).
  const { data: prof } = await getSupabaseAdmin()
    .from("system_users")
    .select("status, deleted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof || prof.deleted_at || prof.status?.toUpperCase() === "SUSPENDED") {
    tokenCache.delete(token);
    throw new AuthError("Acesso revogado. Fale com o administrador.", 403);
  }

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
  // status em system_users é MAIÚSCULO (ACTIVE/INVITED/SUSPENDED). Comparar com
  // "active" minúsculo barrava TODO usuário válido (403) — inclusive o admin.
  if (!data || data.status?.toUpperCase() !== "ACTIVE")
    throw new AuthError("Usuário inativo ou sem perfil", 403);
  if (!allowed.includes(data.role)) {
    throw new AuthError("Você não tem permissão para esta ação", 403);
  }
  return { id: user.id, email: user.email, role: data.role };
}

/**
 * Guard de MÓDULO server-side — versão de servidor de `permissaoEfetiva` (R3-01).
 * Antecipa parte de R3-03: em vez de exigir uma lista fixa de papéis
 * (`requireRole`), respeita a régua "por módulo com overrides por usuário"
 * (`system_user_module_perms`), exatamente como a UI. É o gate correto para os
 * RPCs de $ do épico R4, onde advogados têm a rota financeira no NAV mas NÃO
 * devem ver valores (a régua base do módulo `financeiro` já limita a
 * admin/financeiro; overrides liberam quem precisar).
 *
 * Fluxo: (1) `requireAuth()` p/ obter o usuário; (2) lê `role`/`status` de
 * `system_users` (reuse da mesma query de `requireRole`); (3) carrega overrides
 * via `getUserModulePerms`; (4) combina com `permissaoEfetiva(role, overrides,
 * module, action)`; (5) `false` ⇒ `AuthError(403)`.
 *
 * Exige status **ACTIVE** (rejeita INVITED) — mesma postura de `requireRole` e
 * aceitável/desejável para os RPCs de $.
 *
 * @returns `{ id, email, role }` do usuário autenticado e autorizado.
 * @throws  `AuthError(403)` se o usuário não tem a permissão efetiva no módulo.
 */
export async function requireModule(
  module: Module,
  action: ModuleAction,
): Promise<{ id: string; email: string; role: string }> {
  const user = await requireAuth();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new AuthError("Falha ao verificar permissões", 500);
  // status em system_users é MAIÚSCULO (ACTIVE/INVITED/SUSPENDED).
  if (!data || data.status?.toUpperCase() !== "ACTIVE")
    throw new AuthError("Usuário inativo ou sem perfil", 403);

  // S5-01 — o padrão do PAPEL agora pode vir da matriz (system_role_module_perms).
  // Papel sem linhas lá ⇒ `{}` ⇒ cai no mapa derivado de sempre.
  const [overrides, roleDefaults] = await Promise.all([
    getUserModulePerms(user.id),
    getRoleModuleDefaults(data.role as string),
  ]);
  if (!permissaoEfetiva(data.role as Role, overrides, module, action, roleDefaults)) {
    throw new AuthError("Você não tem permissão para esta ação", 403);
  }
  return { id: user.id, email: user.email, role: data.role };
}

/**
 * Guard de MÓDULO server-side para entidades COMPARTILHADAS entre módulos —
 * autoriza se o usuário tiver a permissão efetiva (`action`) em QUALQUER um dos
 * `modules`. Usado por escritas que acontecem em mais de uma aba: p.ex. criar/
 * editar CLIENTE (aba Comercial/Cadastro OU aba Clientes/Operacional) e criar
 * CASO (ficha do cliente OU funil comercial). Assim, um colaborador com "view"
 * no comercial (e sem edição no operacional) é barrado, mas um usuário que pode
 * editar em qualquer uma das abas continua funcionando (regressão zero p/ quem
 * já editava). Mesmo fluxo de `requireModule` (auth → role/status → overrides).
 */
export async function requireAnyModule(
  modules: readonly Module[],
  action: ModuleAction,
): Promise<{ id: string; email: string; role: string }> {
  const user = await requireAuth();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new AuthError("Falha ao verificar permissões", 500);
  if (!data || data.status?.toUpperCase() !== "ACTIVE")
    throw new AuthError("Usuário inativo ou sem perfil", 403);

  const [overrides, roleDefaults] = await Promise.all([
    getUserModulePerms(user.id),
    getRoleModuleDefaults(data.role as string),
  ]);
  const ok = modules.some((m) =>
    permissaoEfetiva(data.role as Role, overrides, m, action, roleDefaults),
  );
  if (!ok) throw new AuthError("Você não tem permissão para esta ação", 403);
  return { id: user.id, email: user.email, role: data.role };
}
