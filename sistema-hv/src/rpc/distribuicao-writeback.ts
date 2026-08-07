// RPC (server-only, Node) — WRITE-BACK ao ProJuris (Story H3, RISCO ALTO).
//
// Wrapper HTTP + gate de permissão em volta de runWriteback (src/lib/distribuicao/
// writeback.ts). Duas server functions:
//
//   previewWritebackFn  — SEMPRE dry-run (confirm=false). Monta o plano e registra
//                         tentativas 'pending'. NÃO escreve no ProJuris. Use na UI
//                         para o operador REVISAR antes de efetivar.
//
//   efetivarWritebackFn — Efetivação REAL (irreversível, R1). Exige confirmação
//                         humana EXPLÍCITA: `confirm:true` + `confirmText` igual à
//                         data (o operador digita a data para liberar o batch).
//                         Ainda assim, o PUT real só dispara se a INFRA habilitar
//                         (PROJURIS_WRITEBACK_ENABLED='1') — 2ª trava, validação com
//                         o owner (ver writeback.ts). Sem a env, comporta-se como
//                         dry-run mesmo com confirm=true.
//
// Gate: requireModule("controladoria","edit") — mesma régua do sync/aprovação.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import { runWriteback, type WritebackSummary } from "@/lib/distribuicao/writeback";

export type { WritebackSummary } from "@/lib/distribuicao/writeback";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "distributionDate deve ser YYYY-MM-DD");

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
// Preview (dry-run) — NUNCA escreve no ProJuris.
// ---------------------------------------------------------------------------
export const previewWritebackFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ distributionDate: dateSchema }).parse(d ?? {}))
  .handler(
    ({ data }): Promise<WritebackSummary> =>
      wrapAuth(async () => {
        await requireModule("controladoria", "edit");
        return runWriteback(data.distributionDate, false);
      }),
  );

// ---------------------------------------------------------------------------
// Efetivação (irreversível) — confirmação humana obrigatória.
// ---------------------------------------------------------------------------
export const efetivarWritebackFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        distributionDate: dateSchema,
        confirm: z.literal(true),
        // O operador digita a DATA para liberar o batch (evita clique acidental).
        confirmText: z.string(),
      })
      .parse(d),
  )
  .handler(
    ({ data }): Promise<WritebackSummary> =>
      wrapAuth(async () => {
        await requireModule("controladoria", "edit");
        if (data.confirmText.trim() !== data.distributionDate) {
          throw new AuthError(
            "Confirmação inválida: digite a data da distribuição para efetivar o write-back.",
            422,
          );
        }
        return runWriteback(data.distributionDate, true);
      }),
  );
