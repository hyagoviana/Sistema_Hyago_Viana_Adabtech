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
// Fase B — cache dos overrides da chave "ver valores".
const valuesCache = new Map<
  string,
  { values: Partial<Record<Module, boolean>>; expiresAt: number }
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

/**
 * Overrides da chave "ver valores" (Fase B) do usuário `userId` como
 * `{ [module]: boolean }`. Só inclui módulos com override EXPLÍCITO (true/false);
 * ausência ⇒ o consumidor cai no padrão (`podeVerValores`). Tolerante à ausência
 * da coluna/tabela ⇒ `{}`.
 */
export async function getUserModuleValues(
  userId: string,
): Promise<Partial<Record<Module, boolean>>> {
  const cached = valuesCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.values;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_user_module_perms")
    .select("module, can_view_values")
    .eq("user_id", userId);
  if (error) return {};

  const values: Partial<Record<Module, boolean>> = {};
  for (const row of data ?? []) {
    if (MODULE_SET.has(row.module) && typeof row.can_view_values === "boolean") {
      values[row.module as Module] = row.can_view_values;
    }
  }

  valuesCache.set(userId, { values, expiresAt: Date.now() + PERMS_CACHE_TTL });
  return values;
}

export type ModulePermsInput = {
  access?: Partial<Record<Module, ModuleAccess | null>>;
  values?: Partial<Record<Module, boolean | null>>;
};

/**
 * Grava os OVERRIDES de módulo do usuário `userId` (R3 + Fase B, 2026-07-19). Por
 * módulo há DUAS dimensões independentes: `access` (none/view/edit ou null=padrão
 * do papel) e `can_view_values` (true/false ou null=padrão). MESCLA com o estado
 * atual — mexer só no access NÃO apaga a chave de valores e vice-versa. Se, após
 * mesclar, um módulo fica com access=null E can_view_values=null, a linha é
 * REMOVIDA (volta 100% ao padrão do papel). Invalida os caches.
 *
 * Só deve ser chamado por caller já autorizado (admin) — o gate fica no RPC.
 */
export async function setUserModulePerms(userId: string, input: ModulePermsInput): Promise<void> {
  const sb = getSupabaseAdmin();

  // Estado atual (para mesclar sem apagar a dimensão não mexida).
  const { data: current } = await sb
    .from("system_user_module_perms")
    .select("module, access, can_view_values")
    .eq("user_id", userId);
  const currentByMod = new Map<string, { access: ModuleAccess | null; canView: boolean | null }>();
  for (const r of current ?? []) {
    currentByMod.set(r.module, {
      access: ACCESS_SET.has(r.access as ModuleAccess) ? (r.access as ModuleAccess) : null,
      canView: typeof r.can_view_values === "boolean" ? r.can_view_values : null,
    });
  }

  const touched = new Set<string>();
  for (const m of Object.keys(input.access ?? {})) if (MODULE_SET.has(m)) touched.add(m);
  for (const m of Object.keys(input.values ?? {})) if (MODULE_SET.has(m)) touched.add(m);

  const toUpsert: {
    user_id: string;
    module: string;
    access: ModuleAccess | null;
    can_view_values: boolean | null;
  }[] = [];
  const toDelete: string[] = [];

  for (const mod of touched) {
    const cur = currentByMod.get(mod) ?? { access: null, canView: null };
    let access = cur.access;
    if (input.access && mod in input.access) {
      const a = input.access[mod as Module];
      access = a && ACCESS_SET.has(a) ? a : null;
    }
    let canView = cur.canView;
    if (input.values && mod in input.values) {
      const v = input.values[mod as Module];
      canView = typeof v === "boolean" ? v : null;
    }
    if (access === null && canView === null) {
      toDelete.push(mod);
    } else {
      toUpsert.push({ user_id: userId, module: mod, access, can_view_values: canView });
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await sb
      .from("system_user_module_perms")
      .upsert(toUpsert, { onConflict: "user_id,module" });
    if (error) throw new Error(error.message);
  }
  if (toDelete.length > 0) {
    const { error } = await sb
      .from("system_user_module_perms")
      .delete()
      .eq("user_id", userId)
      .in("module", toDelete);
    if (error) throw new Error(error.message);
  }

  permsCache.delete(userId);
  valuesCache.delete(userId);
}
