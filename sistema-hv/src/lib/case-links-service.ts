// Server-only — #13 (2026-08-17) — CASOS VINCULADOS (link manual entre casos).
// Lista os vínculos de um caso (nos dois sentidos) devolvendo um ESPELHO do caso
// vinculado (cliente, tema, etapa na pipeline principal, dias no estado). Escrita
// = add/remove vínculo. ZERO efeito colateral no caso vinculado.

import { getSupabaseAdmin } from "@/lib/supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class CaseLinkError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CaseLinkError";
  }
}

export interface LinkedCase {
  linkId: string;
  caseId: string;
  caseCode: string | null;
  caseName: string | null;
  clientName: string | null;
  temaName: string | null;
  stageLabel: string | null;
  daysInState: number | null;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** Lista os casos vinculados a `caseId` (link em qualquer direção). */
export async function listLinkedCases(caseId: string): Promise<LinkedCase[]> {
  const sb = getSupabaseAdmin();
  const { data: links, error } = await sb
    .from("system_case_links")
    .select("id, case_id, linked_case_id")
    .or(`case_id.eq.${caseId},linked_case_id.eq.${caseId}`);
  if (error) throw new CaseLinkError(error.message, 500);
  const rows = links ?? [];
  if (rows.length === 0) return [];

  // O "outro" caso de cada vínculo + o id do vínculo.
  const otherByCase = new Map<string, string>(); // otherCaseId -> linkId
  for (const l of rows) {
    const other = l.case_id === caseId ? l.linked_case_id : l.case_id;
    if (other && !otherByCase.has(other)) otherByCase.set(other, l.id);
  }
  const ids = [...otherByCase.keys()];
  if (ids.length === 0) return [];

  const { data: cases } = await sb
    .from("system_cases")
    .select(
      "id, case_code, caso_pasta_nome, client_id, tema_id, service_type_id, macrostatus_op, status_changed_at",
    )
    .in("id", ids)
    .is("deleted_at", null);
  const caseList = (cases ?? []) as Array<{
    id: string;
    case_code: string | null;
    caso_pasta_nome: string | null;
    client_id: string | null;
    tema_id: string | null;
    service_type_id: string | null;
    macrostatus_op: string | null;
    status_changed_at: string | null;
  }>;

  // De-paras auxiliares (cliente, tema, etapa) numa query cada.
  const clientIds = [...new Set(caseList.map((c) => c.client_id).filter(Boolean) as string[])];
  const temaIds = [...new Set(caseList.map((c) => c.tema_id).filter(Boolean) as string[])];
  const stypeIds = [...new Set(caseList.map((c) => c.service_type_id).filter(Boolean) as string[])];

  const clientName = new Map<string, string>();
  if (clientIds.length) {
    const { data } = await sb.from("system_clients").select("id, full_name").in("id", clientIds);
    for (const c of data ?? []) if (c.full_name) clientName.set(c.id, c.full_name);
  }
  const temaName = new Map<string, string>();
  if (temaIds.length) {
    const { data } = await sb.from("system_temas").select("id, name").in("id", temaIds);
    for (const t of data ?? []) if (t.name) temaName.set(t.id, t.name);
  }
  // Etapa (label) da pipeline principal: system_pipeline_stages por (service_type, slug).
  const stageLabel = new Map<string, string>(); // `${stypeId}:${slug}` -> label
  if (stypeIds.length) {
    const { data } = await sb
      .from("system_pipeline_stages")
      .select("service_type_id, slug, label")
      .in("service_type_id", stypeIds);
    for (const s of data ?? []) {
      if (s.slug && s.label) stageLabel.set(`${s.service_type_id}:${s.slug}`, s.label);
    }
  }

  return caseList.map((c) => ({
    linkId: otherByCase.get(c.id)!,
    caseId: c.id,
    caseCode: c.case_code,
    caseName: c.caso_pasta_nome,
    clientName: c.client_id ? (clientName.get(c.client_id) ?? null) : null,
    temaName: c.tema_id ? (temaName.get(c.tema_id) ?? null) : null,
    stageLabel:
      c.service_type_id && c.macrostatus_op
        ? (stageLabel.get(`${c.service_type_id}:${c.macrostatus_op}`) ?? c.macrostatus_op)
        : c.macrostatus_op,
    daysInState: daysSince(c.status_changed_at),
  }));
}

/** Cria um vínculo caso→caso (idempotente por UNIQUE). */
export async function addCaseLink(
  caseId: string,
  linkedCaseId: string,
  userId: string,
): Promise<{ ok: true }> {
  if (caseId === linkedCaseId)
    throw new CaseLinkError("Não dá para vincular o caso a ele mesmo.", 422);
  const sb = getSupabaseAdmin();
  const { data: caso } = await sb
    .from("system_cases")
    .select("organization_id")
    .eq("id", caseId)
    .maybeSingle();
  const orgId = caso?.organization_id ?? DEFAULT_ORG;
  const { error } = await sb
    .from("system_case_links")
    .upsert(
      { organization_id: orgId, case_id: caseId, linked_case_id: linkedCaseId, created_by: userId },
      { onConflict: "case_id,linked_case_id", ignoreDuplicates: true },
    );
  if (error) throw new CaseLinkError(error.message, 500);
  return { ok: true };
}

export interface CaseSearchHit {
  caseId: string;
  caseCode: string | null;
  caseName: string | null;
  clientName: string | null;
}

/** Busca casos para o seletor de vínculo (por código do caso OU nome do cliente). */
export async function searchCasesForLink(
  query: string,
  excludeCaseId: string,
): Promise<CaseSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const sb = getSupabaseAdmin();
  const like = `%${q}%`;

  // 1) clientes cujo nome casa → seus casos.
  const { data: clients } = await sb
    .from("system_clients")
    .select("id, full_name")
    .ilike("full_name", like)
    .limit(10);
  const clientById = new Map<string, string>();
  for (const c of clients ?? []) if (c.full_name) clientById.set(c.id, c.full_name);
  const clientIds = [...clientById.keys()];

  // 2) casos por código OU por client_id casado.
  const ors: string[] = [`case_code.ilike.${like}`];
  if (clientIds.length) ors.push(`client_id.in.(${clientIds.join(",")})`);
  const { data: cases } = await sb
    .from("system_cases")
    .select("id, case_code, caso_pasta_nome, client_id")
    .or(ors.join(","))
    .is("deleted_at", null)
    .neq("id", excludeCaseId)
    .limit(15);

  // Nomes de clientes que não vieram na busca por nome (casados por código).
  const extraClientIds = [
    ...new Set(
      (cases ?? [])
        .map((c) => c.client_id)
        .filter((id): id is string => !!id && !clientById.has(id)),
    ),
  ];
  if (extraClientIds.length) {
    const { data } = await sb
      .from("system_clients")
      .select("id, full_name")
      .in("id", extraClientIds);
    for (const c of data ?? []) if (c.full_name) clientById.set(c.id, c.full_name);
  }

  return (cases ?? []).slice(0, 10).map((c) => ({
    caseId: c.id,
    caseCode: c.case_code,
    caseName: c.caso_pasta_nome,
    clientName: c.client_id ? (clientById.get(c.client_id) ?? null) : null,
  }));
}

/** Remove um vínculo pelo id. */
export async function removeCaseLink(linkId: string): Promise<{ ok: true }> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("system_case_links").delete().eq("id", linkId);
  if (error) throw new CaseLinkError(error.message, 500);
  return { ok: true };
}
