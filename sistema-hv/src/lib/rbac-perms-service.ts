// Server-only — carrega os OVERRIDES de permissão por usuário×módulo (R3-01).
// NUNCA importe este arquivo em código que roda no browser (usa service_role).
//
// A tabela `system_user_module_perms` guarda apenas EXCEÇÕES por pessoa. Quando
// não há linha para um módulo, o consumidor cai no papel via `permissaoEfetiva`.
// Enquanto a tabela estiver vazia, esta função retorna `{}` e nada muda (AC-4).

import { MODULES, type Module, type ModuleAccess } from "./rbac";
import { getSupabaseAdmin } from "./supabase/server";

const MODULE_SET = new Set<string>(MODULES);
const ACCESS_SET = new Set<ModuleAccess>(["none", "view", "edit"]);

// Cache por request/batch — mesma postura do tokenCache do auth-guard. Evita N
// leituras da tabela dentro do mesmo lote de server functions.
const permsCache = new Map<
  string,
  { perms: Partial<Record<Module, ModuleAccess>>; expiresAt: number }
>();
const PERMS_CACHE_TTL = 60 * 1000; // 1 min

/**
 * Overrides de módulo do usuário `userId` como `{ [module]: access }`.
 * Retorna `{}` quando não há nenhum override (front/back cai no papel).
 * Tolerante à ausência da tabela (migration ainda não aplicada) — devolve `{}`.
 */
export async function getUserModulePerms(
  userId: string,
): Promise<Partial<Record<Module, ModuleAccess>>> {
  const cached = permsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.perms;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_user_module_perms")
    .select("module, access")
    .eq("user_id", userId);

  // Regressão zero: qualquer falha (inclusive tabela inexistente) ⇒ sem overrides,
  // o consumidor cai no papel. Não quebra nenhum gate existente.
  if (error) return {};

  const perms: Partial<Record<Module, ModuleAccess>> = {};
  for (const row of data ?? []) {
    if (MODULE_SET.has(row.module) && ACCESS_SET.has(row.access as ModuleAccess)) {
      perms[row.module as Module] = row.access as ModuleAccess;
    }
  }

  permsCache.set(userId, { perms, expiresAt: Date.now() + PERMS_CACHE_TTL });
  if (permsCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of permsCache) {
      if (v.expiresAt < now) permsCache.delete(k);
    }
  }
  return perms;
}
