import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  cancelCharge,
  createCharge,
  getChargeStatus,
  getParcelaPixQrCode,
  listClientCharges,
  syncAsaasPagamentos,
  syncClientToAsaas,
  type CreateChargeInput,
} from "@/lib/asaas/service";
import { ping } from "@/lib/asaas/client";
import { AuthError, requireAuth, requireModule } from "@/lib/supabase/auth-guard";
import type { ModuleAction } from "@/lib/rbac";

// R4-03 — mapeamento de erro compartilhado (AuthError→status; 403 já tratado).
function mapError(err: unknown): never {
  if (err instanceof AuthError) {
    setResponseStatus(err.status);
    throw new Error(err.message);
  }
  const status = (err as { status?: number })?.status;
  setResponseStatus(typeof status === "number" ? status : 500);
  throw err instanceof Error ? new Error(err.message) : err;
}

// R4-03 — RPCs de $ (Asaas): exigem permissão EFETIVA no módulo `financeiro`
// (respeita overrides por usuário, igual à UI). Leitura → `view`, escrita/sync →
// `edit`. Não-financeiro recebe 403. Nenhum RPC daqui é chamado pelo cron.
async function handle<T>(action: ModuleAction, fn: () => Promise<T>): Promise<T> {
  try {
    await requireModule("financeiro", action);
    return await fn();
  } catch (err: unknown) {
    mapError(err);
  }
}

// `pingFn` é health-check e NÃO expõe $ — mantém só `requireAuth` (aceita
// qualquer autenticado, sem gate de módulo). Documentado em R4-03 (AC-5).
async function handleAuthOnly<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await requireAuth();
    return await fn();
  } catch (err: unknown) {
    mapError(err);
  }
}

// ─── Sync Cliente ────────────────────────────────────────────────────────────

const syncClientSchema = z.object({ clientId: z.string().uuid() });

export const syncClientToAsaasFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => syncClientSchema.parse(data))
  .handler(async ({ data }) => handle("edit", () => syncClientToAsaas(data.clientId)));

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
    handle("edit", () => createCharge(data as CreateChargeInput)),
  );

// ─── Status da Cobrança ──────────────────────────────────────────────────────

const parcelaIdSchema = z.object({ parcelaId: z.string().uuid() });

export const getChargeStatusFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => parcelaIdSchema.parse(data))
  .handler(async ({ data }) => handle("view", () => getChargeStatus(data.parcelaId)));

// ─── Pix QR Code ─────────────────────────────────────────────────────────────

export const getPixQrCodeFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => parcelaIdSchema.parse(data))
  .handler(async ({ data }) => handle("view", () => getParcelaPixQrCode(data.parcelaId)));

// ─── Cancelar Cobrança ───────────────────────────────────────────────────────

export const cancelChargeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => parcelaIdSchema.parse(data))
  .handler(async ({ data }) => handle("edit", () => cancelCharge(data.parcelaId)));

// ─── Listar Cobranças do Cliente ─────────────────────────────────────────────

const clientIdSchema = z.object({ clientId: z.string().uuid() });

export const listClientChargesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => clientIdSchema.parse(data))
  .handler(async ({ data }) => handle("view", () => listClientCharges(data.clientId)));

// ─── Sync de Pagamentos (manual — o cron chama o mesmo motor) ───────────────

const syncPagamentosSchema = z.object({ caseId: z.string().uuid().optional() });

export const syncAsaasPagamentosFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => syncPagamentosSchema.parse(data ?? {}))
  .handler(async ({ data }) => handle("edit", () => syncAsaasPagamentos(data.caseId)));

// ─── Health Check ────────────────────────────────────────────────────────────

export const asaasPingFn = createServerFn({ method: "GET" }).handler(async () =>
  handleAuthOnly(() => ping()),
);
