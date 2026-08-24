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
import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import { requireJudicial } from "@/lib/judicial-authz";
import {
  JudicialSyncError,
  listCaseJudicialAndamentos,
  syncCaseJudicial,
} from "@/lib/projuris/judicial-sync";
import {
  listAndamentoPins,
  pinAndamento,
  unpinAndamento,
  type AndamentoPin,
} from "@/lib/judicial-timeline-service";

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
          .select(
            "id, projuris_codigo_processo, projuris_numero_processo, sigiloso, honorarios_estimados_centavos, honorarios_provisionados_centavos",
          )
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
        // Honorários MANUAIS do SHV (não vêm do ProJuris) — em centavos.
        honorariosEstimadosCentavos:
          (caso as { honorarios_estimados_centavos?: number | null } | null)
            ?.honorarios_estimados_centavos ?? null,
        honorariosProvisionadosCentavos:
          (caso as { honorarios_provisionados_centavos?: number | null } | null)
            ?.honorarios_provisionados_centavos ?? null,
      };
    }),
  );

// ----------------------------------------------------------------------------
// ESCRITA do VÍNCULO ProJuris (Story M5) — preenche/edita MANUALMENTE o
// identificador do processo no ProJuris que casa caso↔ProJuris.
//   - `codigoProcesso` (BIGINT) = código INTERNO do ProJuris. O identificador
//     amigável `PRO.0007713` é ESTE código: `PRO.` + zeros à esquerda → 7713.
//     O input aceita `PRO.0007713` OU o número puro (`7713`); a normalização
//     defensiva (strip `PRO.`/não-dígitos/zeros à esquerda) roda no SERVIDOR.
//   - `numeroProcesso` (TEXT) = nº judicial CNJ (ex.: 0733583-07.2026.8.07.0016),
//     texto livre.
// Valores vazios/nulos → limpam o vínculo (NULL). Gate: requireJudicial(caseId)
// (sigilo, G4) + requireModule("controladoria","edit") — o judicial é da
// controladoria, e o 403 é no SERVIDOR (não só na UI).
// ----------------------------------------------------------------------------
const linkSchema = z.object({
  caseId: z.string().uuid(),
  // aceita `PRO.0007713`, `7713`, "" ou null; normalizado abaixo.
  codigoProcesso: z.union([z.string(), z.number(), z.null()]).optional(),
  numeroProcesso: z.union([z.string(), z.null()]).optional(),
});

/** Normaliza o identificador do código do processo → BIGINT ou null.
 *  De `PRO.0007713` extrai `7713`; aceita número puro; strip de não-dígitos e
 *  zeros à esquerda. Vazio/sem-dígito → null. Lança 4xx se o valor tem dígitos
 *  mas estoura o range de BIGINT (defensivo). */
function normalizeCodigoProcesso(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "").replace(/^0+/, "");
  if (digits === "") return null;
  const n = Number(digits);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new AuthError("Código do processo inválido.", 422);
  }
  return n;
}

export const setCaseProjurisLinkFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => linkSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireJudicial(data.caseId); // sigilo (G4)
      await requireModule("controladoria", "edit"); // gate de EDIÇÃO
      const codigo = normalizeCodigoProcesso(data.codigoProcesso);
      const numeroRaw = data.numeroProcesso;
      const numero =
        typeof numeroRaw === "string" && numeroRaw.trim() !== "" ? numeroRaw.trim() : null;
      const sb = getSupabaseAdmin();
      const { error } = await sb
        .from("system_cases")
        .update({
          projuris_codigo_processo: codigo,
          projuris_numero_processo: numero,
        })
        .eq("id", data.caseId);
      if (error) throw new AuthError("Falha ao salvar o vínculo ProJuris.", 500);
      return { codigoProcesso: codigo, numeroProcesso: numero };
    }),
  );

// ----------------------------------------------------------------------------
// Honorários contratuais MANUAIS (estimados/provisionados) — campos do SHV, NÃO
// vêm do ProJuris. Em centavos; null limpa. Gate: judicial (sigilo) + controladoria:edit.
// ----------------------------------------------------------------------------
const honorariosSchema = z.object({
  caseId: z.string().uuid(),
  estimadosCentavos: z.number().int().nonnegative().nullable().optional(),
  provisionadosCentavos: z.number().int().nonnegative().nullable().optional(),
});

export const setCaseHonorariosJudicialFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => honorariosSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireJudicial(data.caseId);
      await requireModule("controladoria", "edit");
      const patch: Record<string, number | null> = {};
      if (data.estimadosCentavos !== undefined)
        patch.honorarios_estimados_centavos = data.estimadosCentavos;
      if (data.provisionadosCentavos !== undefined)
        patch.honorarios_provisionados_centavos = data.provisionadosCentavos;
      if (Object.keys(patch).length === 0) return { ok: true as const };
      const sb = getSupabaseAdmin();
      const { error } = await sb
        .from("system_cases")
        .update(patch as never)
        .eq("id", data.caseId);
      if (error) throw new AuthError("Falha ao salvar os honorários.", 500);
      return { ok: true as const };
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

// ----------------------------------------------------------------------------
// "Aparece na linha do tempo do caso" (doc 21.08, menu Judicial). Mesmo gate de
// sigilo dos demais RPCs judiciais: quem não pode ver o processo não marca nada.
// ----------------------------------------------------------------------------
export const listAndamentoPinsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => caseSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<AndamentoPin[]> => {
      await requireJudicial(data.caseId);
      return listAndamentoPins(data.caseId);
    }),
  );

export const pinAndamentoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        key: z.string().min(1),
        descricao: z.string().nullish(),
        data: z.string().nullish(),
        autor: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireModule("operacional", "edit");
      await requireJudicial(data.caseId);
      return pinAndamento(
        data.caseId,
        {
          key: data.key,
          descricao: data.descricao ?? null,
          data: data.data ?? null,
          autor: data.autor ?? null,
        },
        userId,
      );
    }),
  );

export const unpinAndamentoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ caseId: z.string().uuid(), key: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("operacional", "edit");
      await requireJudicial(data.caseId);
      await unpinAndamento(data.caseId, data.key);
      return { ok: true as const };
    }),
  );
