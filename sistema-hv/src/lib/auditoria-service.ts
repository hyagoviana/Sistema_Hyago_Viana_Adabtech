// Server-only — AU1 (reunião 2026-08-26) — leitura da trilha de auditoria.
//
// Thiago, sobre a mudança de campo do caso poluindo a linha do tempo: "essa
// mudança de dado do serviço, campo atualizado, eu acho que não precisa vir para
// a linha do tempo. Dá para a gente pensar em ter um menu de auditoria onde essa
// informação aparece, que a gente sabe qual é o campo, quem mexeu e como mexeu".
//
// NÃO existe tabela nova: `system_case_events` JÁ é a trilha (action, diff,
// triggered_by, created_at). O que faltava era tela e valor anterior. Criar uma
// segunda tabela produziria duas versões da verdade.
//
// NUNCA importe este arquivo em código que roda no browser (usa service_role).

import { getSupabaseAdmin } from "./supabase/server";
import type { Json } from "./supabase/types";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class AuditoriaServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuditoriaServiceError";
  }
}

export interface AuditEvent {
  id: string;
  created_at: string;
  action: string;
  case_id: string;
  case_code: string | null;
  client_name: string | null;
  user_id: string | null;
  user_name: string | null;
  // `Json` (e não `unknown`): o validador de serialização das server functions
  // do TanStack Start recusa `unknown` no retorno.
  diff: Json | null;
  from_macrostatus_op: string | null;
  to_macrostatus_op: string | null;
  /** Campos alterados, já achatados em "campo: de → para" (quando o evento é de campo). */
  mudancas: Array<{ campo: string; de: Json; para: Json }>;
}

export interface AuditFilters {
  from?: string | null;
  to?: string | null;
  userId?: string | null;
  caseId?: string | null;
  action?: string | null;
  /** Texto livre: casa com código do caso, cliente, nome do campo ou valor. */
  q?: string | null;
  limit?: number;
  /** Paginação por cursor: `created_at` do último item da página anterior. */
  cursor?: string | null;
}

/**
 * Achata o diff em uma lista "campo: de → para".
 *
 * Aceita os DOIS formatos: o novo `{ from, to }` (a partir da AU1) e o antigo, em
 * que o diff era só o patch (valores novos). No antigo, "de" fica `null` e a tela
 * mostra "—" — melhor do que esconder o histórico que já existe.
 */
function achatar(diff: Record<string, unknown> | null): AuditEvent["mudancas"] {
  if (!diff) return [];
  const temFromTo = Object.prototype.hasOwnProperty.call(diff, "to") && typeof diff.to === "object";
  const to = (temFromTo ? diff.to : diff) as Record<string, unknown> | null;
  const from = (temFromTo ? diff.from : null) as Record<string, unknown> | null;
  if (!to) return [];

  return Object.keys(to)
    .filter((k) => !["manual", "from", "to", "workflow_code"].includes(k))
    .map((campo) => ({
      campo,
      de: (from ? (from[campo] ?? null) : null) as Json,
      para: (to[campo] ?? null) as Json,
    }));
}

export async function listAuditEvents(
  filters: AuditFilters = {},
): Promise<{ items: AuditEvent[]; nextCursor: string | null }> {
  const sb = getSupabaseAdmin();
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  // QA-15 — a busca livre é aplicada DEPOIS do de-para (o termo pode ser o nome
  // do cliente ou do campo, que não estão na tabela de eventos). Para ela não
  // "filtrar só a página", com termo o lote lido é bem maior antes do corte.
  const termoBusca = (filters.q ?? "").trim().toLowerCase();
  const loteLeitura = termoBusca ? Math.min(limit * 20, 1000) : limit;

  // Paginação por `created_at` desc + limite. A tabela cresce todo dia — carregar
  // tudo de uma vez seria questão de tempo até travar a tela.
  let q = sb
    .from("system_case_events")
    .select(
      "id, created_at, action, case_id, diff, from_macrostatus_op, to_macrostatus_op, triggered_by",
    )
    .eq("organization_id", DEFAULT_ORG)
    .order("created_at", { ascending: false })
    .limit(loteLeitura + 1);

  if (filters.caseId) q = q.eq("case_id", filters.caseId);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.userId) q = q.eq("triggered_by", filters.userId);
  if (filters.from) q = q.gte("created_at", `${filters.from}T00:00:00`);
  if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59`);
  if (filters.cursor) q = q.lt("created_at", filters.cursor);

  const { data, error } = await q;
  if (error) throw new AuditoriaServiceError(error.message, 500);

  const linhas = data ?? [];
  const temMais = linhas.length > loteLeitura;
  const pagina = temMais ? linhas.slice(0, loteLeitura) : linhas;

  // De-para de nomes numa query só (o erro clássico aqui é mostrar UUID).
  const caseIds = [...new Set(pagina.map((e) => e.case_id).filter(Boolean))];
  const userIds = [...new Set(pagina.map((e) => e.triggered_by).filter(Boolean))] as string[];

  const casos = new Map<string, { code: string | null; cliente: string | null }>();
  if (caseIds.length) {
    const { data: cs } = await sb
      .from("system_cases")
      .select("id, case_code, client:system_clients!client_id(full_name)")
      .in("id", caseIds);
    for (const c of cs ?? []) {
      casos.set(c.id as string, {
        code: (c.case_code as string) ?? null,
        cliente: (c.client as { full_name?: string } | null)?.full_name ?? null,
      });
    }
  }

  const usuarios = new Map<string, string>();
  if (userIds.length) {
    const { data: us } = await sb.from("system_users").select("id, full_name").in("id", userIds);
    for (const u of us ?? []) if (u.full_name) usuarios.set(u.id as string, u.full_name as string);
  }

  let items: AuditEvent[] = pagina.map((e) => ({
    id: e.id as string,
    created_at: e.created_at as string,
    action: e.action as string,
    case_id: e.case_id as string,
    case_code: casos.get(e.case_id as string)?.code ?? null,
    client_name: casos.get(e.case_id as string)?.cliente ?? null,
    user_id: (e.triggered_by as string) ?? null,
    user_name: e.triggered_by ? (usuarios.get(e.triggered_by as string) ?? null) : null,
    diff: (e.diff as Json) ?? null,
    from_macrostatus_op: (e.from_macrostatus_op as string) ?? null,
    to_macrostatus_op: (e.to_macrostatus_op as string) ?? null,
    mudancas: achatar((e.diff as Record<string, unknown>) ?? null),
  }));

  // Busca livre: aplicada DEPOIS do de-para, porque o termo pode ser o nome do
  // cliente ou do campo — nenhum dos dois está na tabela de eventos.
  const termo = termoBusca;
  if (termo) {
    items = items.filter((i) =>
      [
        i.case_code,
        i.client_name,
        i.user_name,
        i.action,
        ...i.mudancas.map((m) => m.campo),
        ...i.mudancas.map((m) => String(m.para ?? "")),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(termo)),
    );
  }

  // Com termo, corta no `limit` DEPOIS de filtrar (senão a página viria com o
  // lote inteiro de leitura).
  const recorte = termo ? items.slice(0, limit) : items;

  return {
    items: recorte,
    nextCursor: temMais ? (pagina[pagina.length - 1]?.created_at as string) : null,
  };
}

/** Ações distintas já registradas — alimenta o filtro sem lista fixa no código. */
export async function listAuditActions(): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_case_events")
    .select("action")
    .eq("organization_id", DEFAULT_ORG)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new AuditoriaServiceError(error.message, 500);
  return [...new Set((data ?? []).map((r) => r.action as string))].sort();
}
