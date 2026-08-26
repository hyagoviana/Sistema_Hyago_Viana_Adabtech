// Server functions da AUDITORIA (AU1 — reunião 2026-08-26).
//
// Gate: `sistema:view`. É trilha de quem-mexeu-no-quê do escritório inteiro —
// não é informação de rotina, é informação de administração.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuditoriaServiceError, listAuditActions, listAuditEvents } from "@/lib/auditoria-service";
import { AuthError, requireModule } from "@/lib/supabase/auth-guard";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await requireModule("sistema", "view");
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    if (err instanceof AuditoriaServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

const filtrosSchema = z
  .object({
    from: z.string().nullish(),
    to: z.string().nullish(),
    userId: z.string().uuid().nullish(),
    caseId: z.string().uuid().nullish(),
    action: z.string().nullish(),
    q: z.string().nullish(),
    limit: z.number().int().min(1).max(200).optional(),
    cursor: z.string().nullish(),
  })
  .default({});

export const listAuditEventsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => filtrosSchema.parse(d ?? {}))
  .handler(async ({ data }) => handle(() => listAuditEvents(data)));

export const listAuditActionsFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listAuditActions()),
);
