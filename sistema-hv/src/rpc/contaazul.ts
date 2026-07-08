import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createContaAzulCharge,
  syncClientToContaAzul,
  type CreateContaAzulChargeInput,
} from "@/lib/contaazul/service";
import { ping } from "@/lib/contaazul/client";
import { AuthError, requireAuth } from "@/lib/supabase/auth-guard";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await requireAuth();
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    const status = (err as { status?: number })?.status;
    setResponseStatus(typeof status === "number" ? status : 500);
    throw err instanceof Error ? new Error(err.message) : err;
  }
}

// ─── Sync Cliente ────────────────────────────────────────────────────────────

const syncClientSchema = z.object({ clientId: z.string().uuid() });

export const syncClientToContaAzulFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => syncClientSchema.parse(data))
  .handler(async ({ data }) => handle(() => syncClientToContaAzul(data.clientId)));

// ─── Criar Cobrança ──────────────────────────────────────────────────────────

const createChargeSchema = z.object({
  caseId: z.string().uuid(),
  paymentMethod: z.string(),
  value: z.number().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
  installmentCount: z.number().int().min(1).optional(),
});

export const createContaAzulChargeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createChargeSchema.parse(data))
  .handler(async ({ data }) =>
    handle(() => createContaAzulCharge(data as CreateContaAzulChargeInput)),
  );

// ─── Health Check ────────────────────────────────────────────────────────────

export const contaAzulPingFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => ping()),
);
