// RPC (server-only, Node) — Sincronizacao SOB DEMANDA do Motor de Distribuicao.
//
// Dispara o MESMO motor puro do cron (engine/motor.distributeBatch) a partir de
// um botao na tela, sem depender da Edge Function / pg_cron. Toda a logica vive
// em src/lib/distribuicao/sync-core.ts (runSync) — reusada tambem por scripts
// (scripts/run-sincronizar.ts) e pelo cron futuro. Aqui fica so o wrapper HTTP +
// o gate de permissao.
//
// REGRA CRITICA: ZERO writeback ao ProJuris (ver sync-core).

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import { runSync, ymd, type SyncSummary } from "@/lib/distribuicao/sync-core";

export type { SyncSummary } from "@/lib/distribuicao/sync-core";

export const sincronizarDistribuicaoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        distributionDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "distributionDate deve ser YYYY-MM-DD")
          .optional(),
        windowDays: z.number().int().min(0).max(30).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }): Promise<SyncSummary> => {
    try {
      // Gate: mesma regua da rota (modulo controladoria, acao edit).
      await requireModule("controladoria", "edit");
      const distributionDate = data.distributionDate ?? ymd(new Date());
      const windowDays = data.windowDays ?? 3;
      return await runSync(distributionDate, windowDays);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err instanceof Error ? new Error(err.message) : new Error(String(err));
    }
  });
