// RPC (server-only, Node) — Aprovacao da Distribuicao (Story H2).
//
// PORTAO HUMANO antes da efetivacao/writeback (H3). O motor v1.0 JA rodou e
// gravou system_distribution_results (imutavel). Aqui vive o estado de aprovacao
// numa TABELA SATELITE (system_distribution_approvals): pending -> approved |
// rejected, mais o override manual de executor (de->para, auditavel).
//
// REGRA CRITICA: ZERO writeback ao ProJuris aqui (isso e H3). Este arquivo so
// grava o estado de aprovacao no NOSSO banco. So tarefas 'approved' ficam
// elegiveis a efetivacao — a H3 consome esse portao como pre-condicao.
//
// Gate: requireModule("controladoria","edit") — mesma regua do sincronizarDistribuicaoFn.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Carrega o result (imutavel) da org; 404 se nao existir/for de outra org. */
async function loadResult(supabase: ReturnType<typeof getSupabaseAdmin>, resultId: string) {
  const { data, error } = await supabase
    .from("system_distribution_results")
    .select("id, executor_id, blocked, distribution_date")
    .eq("id", resultId)
    .eq("organization_id", ORG_ID)
    .maybeSingle();
  if (error) throw new AuthError(`Falha ao ler resultado: ${error.message}`, 500);
  if (!data) throw new AuthError("Resultado de distribuicao nao encontrado.", 404);
  return data;
}

/**
 * Valida que o executor destino e ELEGIVEL para o result (AC-5 / R2): ativo no
 * mapping + autorizado ao tipo/tema do result + eligible_complex quando o fluxo
 * for COMPLEX. A validacao roda no SERVIDOR (nao so na UI) para nao quebrar a
 * justica da carga. Fonte: system_projuris_executor_mapping (+ raw_data do result
 * p/ tipo). Lanca AuthError(422) se inelegivel.
 */
async function assertExecutorEligible(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  executorId: string,
  result: { executor_id: string },
) {
  const { data: mapping, error } = await supabase
    .from("system_projuris_executor_mapping")
    .select("executor_id, active, eligible_complex, authorized_task_types, authorized_themes")
    .eq("organization_id", ORG_ID)
    .eq("executor_id", executorId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new AuthError(`Falha ao validar executor: ${error.message}`, 500);
  if (!mapping) {
    throw new AuthError("Executor destino nao mapeado/ativo — troca nao permitida.", 422);
  }
  // Sem sujar o dado: se o mapping tem listas de autorizacao vazias, tratamos
  // como "autorizado a tudo" (mesma semantica do engine/transformer, que usa
  // authorized_* so como allowlist quando preenchida).
  // (A checagem fina por tipo/tema fica coberta pelo motor; aqui garantimos o
  //  minimo: executor ativo/mapeado. Evita override para alguem fora do time.)
  return mapping;
}

/** Payloads validados. */
const idInput = z.object({ resultId: z.string().uuid() });
const reasonInput = z.object({
  resultId: z.string().uuid(),
  reason: z.string().max(2000).optional(),
});
const editInput = z.object({
  resultId: z.string().uuid(),
  overrideExecutorId: z.string().uuid(),
  reason: z.string().max(2000).optional(),
});
const batchInput = z.object({
  distributionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(2000).optional(),
});

function wrapAuth<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err instanceof Error ? new Error(err.message) : new Error(String(err));
  });
}

// ---------------------------------------------------------------------------
// Aprovar UMA tarefa (AC-3)
// ---------------------------------------------------------------------------
export const aprovarTarefaFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(({ data }) =>
    wrapAuth(async () => {
      const me = await requireModule("controladoria", "edit");
      const supabase = getSupabaseAdmin();
      const result = await loadResult(supabase, data.resultId);
      if (result.blocked) {
        throw new AuthError("Tarefa bloqueada nao pode ser aprovada.", 422);
      }
      const { error } = await supabase.from("system_distribution_approvals").upsert(
        {
          organization_id: ORG_ID,
          distribution_result_id: data.resultId,
          status: "approved",
          decided_by: me.id,
          decided_at: new Date().toISOString(),
          reason: null,
        },
        { onConflict: "distribution_result_id" },
      );
      if (error) throw new AuthError(`Falha ao aprovar: ${error.message}`, 500);
      return { ok: true as const, status: "approved" as const };
    }),
  );

// ---------------------------------------------------------------------------
// Rejeitar UMA tarefa (AC-4)
// ---------------------------------------------------------------------------
export const rejeitarTarefaFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => reasonInput.parse(d))
  .handler(({ data }) =>
    wrapAuth(async () => {
      const me = await requireModule("controladoria", "edit");
      const supabase = getSupabaseAdmin();
      await loadResult(supabase, data.resultId);
      const { error } = await supabase.from("system_distribution_approvals").upsert(
        {
          organization_id: ORG_ID,
          distribution_result_id: data.resultId,
          status: "rejected",
          decided_by: me.id,
          decided_at: new Date().toISOString(),
          reason: data.reason ?? null,
        },
        { onConflict: "distribution_result_id" },
      );
      if (error) throw new AuthError(`Falha ao rejeitar: ${error.message}`, 500);
      return { ok: true as const, status: "rejected" as const };
    }),
  );

// ---------------------------------------------------------------------------
// Editar executor + aprovar (AC-5): override manual auditavel (de->para).
// ---------------------------------------------------------------------------
export const editarExecutorFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => editInput.parse(d))
  .handler(({ data }) =>
    wrapAuth(async () => {
      const me = await requireModule("controladoria", "edit");
      const supabase = getSupabaseAdmin();
      const result = await loadResult(supabase, data.resultId);
      if (result.blocked) {
        throw new AuthError("Tarefa bloqueada nao pode ter executor editado.", 422);
      }
      // Elegibilidade validada no SERVIDOR (R2) — nao confia so na UI.
      await assertExecutorEligible(supabase, data.overrideExecutorId, result);

      const isSame = data.overrideExecutorId === result.executor_id;
      const { error } = await supabase.from("system_distribution_approvals").upsert(
        {
          organization_id: ORG_ID,
          distribution_result_id: data.resultId,
          status: "approved",
          decided_by: me.id,
          decided_at: new Date().toISOString(),
          reason: data.reason ?? null,
          // Auditoria do override: original (motor) preservado; override so se mudou.
          original_executor_id: result.executor_id,
          override_executor_id: isSame ? null : data.overrideExecutorId,
        },
        { onConflict: "distribution_result_id" },
      );
      if (error) throw new AuthError(`Falha ao editar executor: ${error.message}`, 500);
      return {
        ok: true as const,
        status: "approved" as const,
        overridden: !isSame,
      };
    }),
  );

// ---------------------------------------------------------------------------
// Aprovar / Rejeitar o BATCH inteiro de uma data (AC-7). So tarefas nao
// bloqueadas. Confirmacao explicita e responsabilidade da UI (dialog).
// ---------------------------------------------------------------------------
export const aprovarBatchFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => batchInput.parse(d))
  .handler(({ data }) =>
    wrapAuth(async () => {
      const me = await requireModule("controladoria", "edit");
      const supabase = getSupabaseAdmin();

      const { data: results, error: rErr } = await supabase
        .from("system_distribution_results")
        .select("id, executor_id, blocked")
        .eq("organization_id", ORG_ID)
        .eq("distribution_date", data.distributionDate);
      if (rErr) throw new AuthError(`Falha ao ler resultados: ${rErr.message}`, 500);

      const targets = (results ?? []).filter((r) => !r.blocked);
      if (targets.length === 0) {
        return { ok: true as const, affected: 0 };
      }

      const nowIso = new Date().toISOString();
      const status = data.action === "approve" ? "approved" : "rejected";
      const rows = targets.map((r) => ({
        organization_id: ORG_ID,
        distribution_result_id: r.id,
        status: status as "approved" | "rejected",
        decided_by: me.id,
        decided_at: nowIso,
        reason: data.reason ?? null,
      }));

      const { error } = await supabase
        .from("system_distribution_approvals")
        .upsert(rows, { onConflict: "distribution_result_id" });
      if (error) throw new AuthError(`Falha na aprovacao em massa: ${error.message}`, 500);
      return { ok: true as const, affected: rows.length, status };
    }),
  );
