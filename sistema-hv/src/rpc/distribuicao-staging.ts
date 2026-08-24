// RPC (server-only) — as duas etapas HUMANAS do motor (doc 21.08 Controladoria).
// Tela 1: andamentos pendentes · Tela 2: tarefas a distribuir · botão Distribuir.
// Gate: controladoria (view p/ ver, edit p/ decidir/alterar/distribuir).

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import {
  cancelStagingItem,
  decideMovement,
  distribuirStaging,
  listMovements,
  listStaging,
  enviarInicialParaDistribuicao,
  listHistoricoAndamentos,
  listHistoricoTarefas,
  syncMovements,
  updateStagingItem,
  type DistribuirResumo,
  type Movement,
  type StagingItem,
  type SyncMovementsSummary,
  type HistoricoAndamento,
  type HistoricoTarefa,
} from "@/lib/distribuicao/staging-core";

export type {
  Movement,
  StagingItem,
  DistribuirResumo,
  SyncMovementsSummary,
  HistoricoAndamento,
  HistoricoTarefa,
};

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err instanceof Error ? new Error(err.message) : new Error(String(err));
  }
}

const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida")
  .nullish();

export const listMovementsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        decisao: z.enum(["PENDENTE", "ARQUIVADO", "LIDO", "DISTRIBUIR", "TODAS"]).optional(),
        data: dataSchema,
        ocultarArquivadas: z.boolean().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async (): Promise<Movement[]> => {
      await requireModule("controladoria", "view");
      return listMovements({
        decisao: data?.decisao ?? "PENDENTE",
        data: data?.data ?? null,
        ocultarArquivadas: data?.ocultarArquivadas,
      });
    }),
  );

/** Puxa do ProJuris o que está pendente de análise. Só leitura lá. */
export const syncMovementsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ data: dataSchema, windowDays: z.number().int().min(0).max(30).optional() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async (): Promise<SyncMovementsSummary> => {
      await requireModule("controladoria", "edit");
      const hoje = new Date().toISOString().slice(0, 10);
      return syncMovements(data?.data ?? hoje, data?.windowDays ?? 3);
    }),
  );

export const decideMovementFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        movementId: z.string().uuid(),
        decisao: z.enum(["PENDENTE", "ARQUIVADO", "LIDO", "DISTRIBUIR"]),
        taskTypeId: z.string().uuid().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireModule("controladoria", "edit");
      return decideMovement(data.movementId, data.decisao, data.taskTypeId ?? null, userId);
    }),
  );

export const listStagingFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ status: z.enum(["ABERTA", "DISTRIBUIDA", "CANCELADA"]).optional() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async (): Promise<StagingItem[]> => {
      await requireModule("controladoria", "view");
      return listStaging(data?.status ?? "ABERTA");
    }),
  );

export const updateStagingItemFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          coletivo: z.boolean().optional(),
          complexo: z.boolean().optional(),
          urgente: z.boolean().optional(),
          exclusive_executor_id: z.string().uuid().nullish(),
          data_prevista: dataSchema,
          data_fatal: dataSchema,
          pontos: z.number().min(0).nullish(),
          task_type_id: z.string().uuid().nullish(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("controladoria", "edit");
      await updateStagingItem(data.id, data.patch);
      return { ok: true as const };
    }),
  );

export const cancelStagingItemFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("controladoria", "edit");
      await cancelStagingItem(data.id);
      return { ok: true as const };
    }),
  );

/** O motor só roda aqui — depois da revisão humana. */
export const distribuirStagingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1), data: dataSchema }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async (): Promise<DistribuirResumo> => {
      const { id: userId } = await requireModule("controladoria", "edit");
      return distribuirStaging(data.ids, userId, data.data ?? undefined);
    }),
  );

/**
 * Botão "Distribuir inicial judicial" da ficha do caso. Gate pelo módulo
 * OPERACIONAL (quem trabalha o caso manda a inicial; quem distribui é a
 * controladoria, na tela 1).
 */
export const enviarInicialParaDistribuicaoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireModule("operacional", "edit");
      return enviarInicialParaDistribuicao(data.caseId, userId);
    }),
  );

// Históricos (páginas 3 e 4 do doc 21.08). Leitura — gate de view.
export const listHistoricoAndamentosFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ de: dataSchema, ate: dataSchema, decisao: z.string().nullish() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async (): Promise<HistoricoAndamento[]> => {
      await requireModule("controladoria", "view");
      return listHistoricoAndamentos({
        de: data?.de ?? null,
        ate: data?.ate ?? null,
        decisao: data?.decisao ?? null,
      });
    }),
  );

export const listHistoricoTarefasFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ de: dataSchema, ate: dataSchema }).optional().parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<HistoricoTarefa[]> => {
      await requireModule("controladoria", "view");
      return listHistoricoTarefas({ de: data?.de ?? null, ate: data?.ate ?? null });
    }),
  );
