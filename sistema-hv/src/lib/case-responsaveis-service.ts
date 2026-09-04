// Server-only — Responsáveis (advogados) vinculados a um caso (N:N).
// Fonte de verdade do vínculo/visibilidade: system_case_responsaveis.
// system_cases.responsavel (TEXT) é mantido como cache de exibição (nomes juntos).

import { seesOnlyOwnCases } from "./rbac";
import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

// Regra de negócio (2026-07-09): um advogado (papel que só vê os próprios casos)
// só pode se vincular A SI MESMO — não pode atribuir o caso a outros advogados.
// Admin/back-office podem vincular quaisquer advogados. Retorna a lista efetiva.
export async function enforceResponsavelIds(
  actorUserId: string | undefined,
  requestedIds: string[] | undefined,
): Promise<string[] | undefined> {
  if (!actorUserId) return requestedIds;
  const sb = getSupabaseAdmin();
  const { data: u } = await sb
    .from("system_users")
    .select("role")
    .eq("id", actorUserId)
    .maybeSingle();
  const role = (u?.role ?? null) as Parameters<typeof seesOnlyOwnCases>[0];
  // Advogado só vê os próprios casos → é SEMPRE o único responsável (mesmo que a
  // UI não mande nada). Admin/back-office recebem o que foi pedido.
  if (seesOnlyOwnCases(role)) return [actorUserId];
  return requestedIds;
}

export class CaseResponsaveisError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CaseResponsaveisError";
  }
}

export type CaseResponsavel = {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
};

// Lista os responsáveis (com nome/papel) de um caso.
export async function listCaseResponsaveis(caseId: string): Promise<CaseResponsavel[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_responsaveis_active")
    .select("user_id")
    .eq("case_id", caseId);
  if (error) throw new CaseResponsaveisError(error.message, 500);
  const userIds = (data ?? []).map((r) => (r as { user_id: string }).user_id);
  if (userIds.length === 0) return [];
  const { data: users } = await sb
    .from("system_users")
    .select("id, full_name, email, role")
    .in("id", userIds);
  return (users ?? []).map((u) => ({
    user_id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
  }));
}

// Substitui o conjunto de responsáveis do caso (idempotente) e sincroniza o
// cache de exibição system_cases.responsavel (nomes juntos por vírgula).
export async function setCaseResponsaveis(caseId: string, userIds: string[], actorUserId?: string) {
  const sb = getSupabaseAdmin();
  // A2 (Thiago, 04/09): "vamos manter que cada caso pode ter apenas 1 responsável
  // para fins das funções do SHV". A tabela segue N:N (não vale migração de schema
  // por causa disso, e o histórico de vínculos antigos continua legível), mas a
  // ESCRITA passa a guardar um só. Recusar seria pior que normalizar: quem chamou
  // com dois queria trocar de responsável, não criar um par.
  const uniqueIds = [...new Set(userIds.filter(Boolean))].slice(0, 1);

  // Estado atual (ativos).
  const { data: current } = await sb
    .from("system_case_responsaveis_active")
    .select("id, user_id")
    .eq("case_id", caseId);
  const currentMap = new Map(
    (current ?? []).map((r) => [(r as { user_id: string }).user_id, (r as { id: string }).id]),
  );

  const toAdd = uniqueIds.filter((id) => !currentMap.has(id));
  const toRemove = [...currentMap.entries()].filter(([uid]) => !uniqueIds.includes(uid));

  if (toRemove.length) {
    await sb
      .from("system_case_responsaveis")
      .update({ deleted_at: new Date().toISOString() })
      .in(
        "id",
        toRemove.map(([, id]) => id),
      );
  }
  if (toAdd.length) {
    await sb.from("system_case_responsaveis").upsert(
      toAdd.map((uid) => ({
        organization_id: DEFAULT_ORG,
        case_id: caseId,
        user_id: uid,
        created_by: actorUserId ?? null,
        deleted_at: null,
      })),
      { onConflict: "case_id,user_id" },
    );
  }

  // Sincroniza o cache de exibição (nomes juntos).
  const nomes =
    uniqueIds.length > 0
      ? ((await sb.from("system_users").select("full_name, email").in("id", uniqueIds)).data?.map(
          (u) => u.full_name || u.email,
        ) ?? [])
      : [];
  await sb
    .from("system_cases")
    .update({ responsavel: nomes.length ? nomes.join(", ") : null })
    .eq("id", caseId);

  return { ok: true as const, userIds: uniqueIds };
}
