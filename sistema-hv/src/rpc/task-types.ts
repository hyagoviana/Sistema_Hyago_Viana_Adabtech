// RPC (server-only) — catálogo ÚNICO de TIPOS DE TAREFA (doc 21.08 Controladoria).
// Gate: módulo `sistema` (view para ler, edit para escrever) — é configuração.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import { criarTipoNoProjuris } from "@/lib/projuris/criar-tipo-tarefa";
import {
  createTaskType,
  listTaskTypes,
  removeThemeExclusive,
  setTaskTypeArchived,
  setThemeExclusive,
  updateTaskType,
  TASK_TYPE_CLASSES,
  type TaskType,
} from "@/lib/task-types-service";

export type { TaskType, TaskTypeThemeExclusive } from "@/lib/task-types-service";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    const status = (err as { status?: number })?.status;
    setResponseStatus(typeof status === "number" ? status : 500);
    throw err instanceof Error ? new Error(err.message) : new Error(String(err));
  }
}

const classeSchema = z.enum(TASK_TYPE_CLASSES);

const patchSchema = z.object({
  nome: z.string().min(1).optional(),
  classe: classeSchema.nullish(),
  points: z.number().min(0).optional(),
  complexity_level: z.number().int().min(0).max(2).optional(),
  temporal_level: z.number().int().min(0).max(2).optional(),
  prazo_previsto_dias: z.number().int().min(0).nullish(),
  prazo_fatal_dias: z.number().int().min(0).nullish(),
  aparece_no_motor: z.boolean().optional(),
  sync_projuris: z.boolean().optional(),
  exclusive_executor_id: z.string().uuid().nullish(),
});

export const listTaskTypesCatalogFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        estado: z.enum(["ativos", "arquivados", "todos"]).optional(),
        classe: classeSchema.nullish(),
        soMotor: z.boolean().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async (): Promise<TaskType[]> => {
      await requireModule("sistema", "view");
      return listTaskTypes({
        estado: data?.estado,
        classe: data?.classe ?? null,
        soMotor: data?.soMotor,
      });
    }),
  );

export const createTaskTypeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => patchSchema.extend({ nome: z.string().min(1) }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("sistema", "edit");
      return createTaskType(data);
    }),
  );

export const updateTaskTypeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), patch: patchSchema }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("sistema", "edit");
      await updateTaskType(data.id, data.patch);
      return { ok: true as const };
    }),
  );

export const setTaskTypeArchivedFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("sistema", "edit");
      await setTaskTypeArchived(data.id, data.archived);
      return { ok: true as const };
    }),
  );

export const setThemeExclusiveFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        taskTypeId: z.string().uuid(),
        temaId: z.string().uuid(),
        executorId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireModule("sistema", "edit");
      await setThemeExclusive(data.taskTypeId, data.temaId, data.executorId, userId);
      return { ok: true as const };
    }),
  );

export const removeThemeExclusiveFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("sistema", "edit");
      await removeThemeExclusive(data.id);
      return { ok: true as const };
    }),
  );

/**
 * Manda para o ProJuris um tipo que nasceu aqui (bloco A7 do doc 21.08).
 *
 * ESCREVE no ProJuris de produção — por isso exige `controladoria:edit` (o mesmo
 * gate do interruptor de escrita) e não `sistema:edit`, que é o gate de
 * configuração. A trava de banco vale por cima disso.
 */
export const criarTipoNoProjurisFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("controladoria", "edit");
      return criarTipoNoProjuris(data.id);
    }),
  );
