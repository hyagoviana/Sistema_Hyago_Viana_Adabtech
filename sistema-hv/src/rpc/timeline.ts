// Server functions da timeline manual (S4-04). Auth-only (qualquer usuário
// autenticado) para a ENTRADA MANUAL. Os eventos AUTOMÁTICOS do sistema são
// read-only reais: o service (loadEditableManualEvent) recusa editar/apagar
// qualquer evento que não seja manual — bloqueio no servidor, não só na UI.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  addManualCaseEvent,
  CaseServiceError,
  deleteManualCaseEvent,
  MANUAL_EVENT_ACTIONS,
  updateManualCaseEvent,
} from "@/lib/cases-service";
import { AuthError, requireAuth } from "@/lib/supabase/auth-guard";

async function handle<T>(fn: (userId: string) => Promise<T>): Promise<T> {
  try {
    const { id: userId } = await requireAuth();
    return await fn(userId);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    if (err instanceof CaseServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

export const addManualCaseEventFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        action: z.enum(MANUAL_EVENT_ACTIONS),
        body: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle((userId) =>
      addManualCaseEvent(data.caseId, { action: data.action, body: data.body }, userId),
    ),
  );

export const updateManualCaseEventFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ eventId: z.string().uuid(), body: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) =>
    handle((userId) => updateManualCaseEvent(data.eventId, data.body, userId)),
  );

export const deleteManualCaseEventFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle((userId) => deleteManualCaseEvent(data.eventId, userId)));
