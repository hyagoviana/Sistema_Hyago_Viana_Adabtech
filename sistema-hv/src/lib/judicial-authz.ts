// Server-only — GATE POR-CASO do submenu Judicial (Story G4).
//
// Regra (fonte única): um usuário PODE ver o Judicial de um caso se:
//   (a) é ADMIN; OU
//   (b) o caso NÃO é sigiloso (regra geral: todos veem o Judicial); OU
//   (c) o caso é sigiloso E o usuário está autorizado — está em
//       system_case_sigilo_users, OU é o CRIADOR (created_by), OU é o
//       RESPONSÁVEL do caso (system_cases.responsavel ou
//       system_case_responsaveis). O criador/responsável entram por padrão
//       (D-G4) para evitar auto-trancamento de quem marcou o sigilo.
//
// SEGURANÇA: este é o gate REAL (servidor). A UI (usePodeVerJudicial) apenas
// espelha a regra para esconder o menu; o 403 do servidor é a garantia.
// NUNCA importe este módulo no bundle do browser.

import { getSupabaseAdmin } from "./supabase/server";
import { AuthError, requireAuth } from "./supabase/auth-guard";

/**
 * Fonte única da autorização por-caso do Judicial (Story G4, AC-2).
 * @returns `true` se o usuário pode ver os dados judiciais do caso.
 */
export async function isAutorizadoJudicial(
  caseId: string,
  userId: string,
  role: string,
): Promise<boolean> {
  if (role === "admin") return true; // admin sempre passa (nunca trancar o admin)

  const sb = getSupabaseAdmin();
  const { data: caso } = await sb
    .from("system_cases")
    .select("id, sigiloso, created_by, responsavel")
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();

  // Caso inexistente → deixa o RPC de dados devolver seu próprio vazio/404; aqui
  // não bloqueamos por autorização (não é sigiloso "conhecido").
  if (!caso) return true;

  // Regra geral: caso não-sigiloso → todos veem.
  if (!caso.sigiloso) return true;

  // Sigiloso: criador/responsável entram por padrão (D-G4).
  if (caso.created_by && caso.created_by === userId) return true;
  if (caso.responsavel && caso.responsavel === userId) return true;

  // Responsável multi (system_case_responsaveis).
  const { data: resp } = await sb
    .from("system_case_responsaveis")
    .select("user_id")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (resp) return true;

  // Autorizado explicitamente.
  const { data: auth } = await sb
    .from("system_case_sigilo_users")
    .select("id")
    .eq("case_id", caseId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!auth;
}

/**
 * Guard server-side — `requireAuth` → resolve role/status → `isAutorizadoJudicial`
 * → `AuthError(403)` se negado. Usar em TODOS os RPCs de dados judiciais (G1).
 * @returns `{ id, email, role }` do usuário autorizado.
 */
export async function requireJudicial(
  caseId: string,
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

  const ok = await isAutorizadoJudicial(caseId, user.id, data.role);
  if (!ok) throw new AuthError("Você não tem permissão para ver o judicial deste caso.", 403);
  return { id: user.id, email: user.email, role: data.role };
}
