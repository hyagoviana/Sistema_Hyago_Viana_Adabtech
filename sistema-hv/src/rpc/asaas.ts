import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  cancelCharge,
  createCharge,
  getChargeStatus,
  getParcelaPixQrCode,
  listClientCharges,
  syncClientToAsaas,
  type CreateChargeInput,
} from "@/lib/asaas/service";
import { ping } from "@/lib/asaas/client";
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

export const syncClientToAsaasFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => syncClientSchema.parse(data))
  .handler(async ({ data }) => handle(() => syncClientToAsaas(data.clientId)));

// ─── Criar Cobrança ──────────────────────────────────────────────────────────

const createChargeSchema = z.object({
  caseId: z.string().uuid(),
  billingType: z.enum(["BOLETO", "PIX", "CREDIT_CARD", "UNDEFINED"]),
  value: z.number().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
  installmentCount: z.number().int().min(1).optional(),
});

export const createChargeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createChargeSchema.parse(data))
  .handler(async ({ data }) =>
    handle(() => createCharge(data as CreateChargeInput)),
  );

// ─── Status da Cobrança ──────────────────────────────────────────────────────

const parcelaIdSchema = z.object({ parcelaId: z.string().uuid() });

export const getChargeStatusFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => parcelaIdSchema.parse(data))
  .handler(async ({ data }) => handle(() => getChargeStatus(data.parcelaId)));

// ─── Pix QR Code ─────────────────────────────────────────────────────────────

export const getPixQrCodeFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => parcelaIdSchema.parse(data))
  .handler(async ({ data }) => handle(() => getParcelaPixQrCode(data.parcelaId)));

// ─── Cancelar Cobrança ───────────────────────────────────────────────────────

export const cancelChargeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => parcelaIdSchema.parse(data))
  .handler(async ({ data }) => handle(() => cancelCharge(data.parcelaId)));

// ─── Listar Cobranças do Cliente ─────────────────────────────────────────────

const clientIdSchema = z.object({ clientId: z.string().uuid() });

export const listClientChargesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => clientIdSchema.parse(data))
  .handler(async ({ data }) => handle(() => listClientCharges(data.clientId)));

// ─── Health Check ────────────────────────────────────────────────────────────

export const asaasPingFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => ping()),
);
