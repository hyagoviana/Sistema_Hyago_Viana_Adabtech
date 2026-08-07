// RPCs do submenu JUDICIAL (Story G1) — LEITURA do espelho do ProJuris.
//
// TODOS os RPCs que devolvem dados judiciais passam por `requireJudicial(caseId)`
// (Story G4): admin sempre; caso não-sigiloso → todos; caso sigiloso → só admin +
// autorizados. Uma chamada direta ao RPC de um não-autorizado recebe 403 (a
// segurança é no SERVIDOR, não só na UI). O client ProJuris é server-only — o
// browser só recebe o espelho já normalizado.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AuthError } from "@/lib/supabase/auth-guard";
import { requireJudicial } from "@/lib/judicial-authz";
import {
  JudicialSyncError,
  listCaseJudicialAndamentos,
  syncCaseJudicial,
} from "@/lib/projuris/judicial-sync";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError || err instanceof JudicialSyncError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err instanceof Error ? new Error(err.message) : err;
  }
}

const caseSchema = z.object({ caseId: z.string().uuid() });

// ----------------------------------------------------------------------------
// LEITURA do espelho: resumo do processo + tarefas + status de sigilo/vínculo.
// ----------------------------------------------------------------------------
export const getCaseJudicialFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => caseSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireJudicial(data.caseId);
      const sb = getSupabaseAdmin();
      const [{ data: caso }, { data: processo }, { data: tarefas }] = await Promise.all([
        sb
          .from("system_cases")
          .select("id, projuris_codigo_processo, projuris_numero_processo, sigiloso")
          .eq("id", data.caseId)
          .maybeSingle(),
        sb
          .from("system_case_judicial_processos")
          .select("*")
          .eq("case_id", data.caseId)
          .maybeSingle(),
        sb
          .from("system_case_judicial_tasks")
          .select("*")
          .eq("case_id", data.caseId)
          .order("prazo_fatal", { ascending: true, nullsFirst: false }),
      ]);
      return {
        vinculado: !!caso?.projuris_codigo_processo,
        codigoProcesso: caso?.projuris_codigo_processo ?? null,
        numeroProcesso: caso?.projuris_numero_processo ?? processo?.numero_processo ?? null,
        processo: processo ?? null,
        tarefas: tarefas ?? [],
      };
    }),
  );

// ----------------------------------------------------------------------------
// SYNC (LEITURA no ProJuris → espelho). Idempotente. Gate por-caso.
// ----------------------------------------------------------------------------
export const syncCaseJudicialFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => caseSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireJudicial(data.caseId);
      return syncCaseJudicial(data.caseId);
    }),
  );

// ----------------------------------------------------------------------------
// ANDAMENTOS (LEITURA com limite/keyset) — modal (G5). Gate por-caso.
// ----------------------------------------------------------------------------
const andamentosSchema = z.object({
  caseId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});
export const listCaseJudicialAndamentosFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => andamentosSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireJudicial(data.caseId);
      return listCaseJudicialAndamentos(data.caseId, data.limit ?? 30, data.offset ?? 0);
    }),
  );

// ----------------------------------------------------------------------------
// Status de SIGILO do caso (para a UI decidir se mostra o menu Judicial) — G4.
// Retorna sigiloso + lista de user_ids autorizados. Leitura leve (autenticado
// não precisa passar pelo gate judicial: saber SE é sigiloso não vaza dados).
// ----------------------------------------------------------------------------
export const getCaseSigiloStatusFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => caseSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      const sb = getSupabaseAdmin();
      const [{ data: caso }, { data: autorizados }] = await Promise.all([
        sb
          .from("system_cases")
          .select("sigiloso, created_by, responsavel")
          .eq("id", data.caseId)
          .maybeSingle(),
        sb.from("system_case_sigilo_users").select("user_id").eq("case_id", data.caseId),
      ]);
      return {
        sigiloso: !!caso?.sigiloso,
        created_by: caso?.created_by ?? null,
        responsavel: caso?.responsavel ?? null,
        autorizados: (autorizados ?? []).map((r) => r.user_id),
      };
    }),
  );
