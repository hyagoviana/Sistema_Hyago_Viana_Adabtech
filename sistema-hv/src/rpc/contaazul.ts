import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createContaAzulCharge,
  syncClientToContaAzul,
  syncContaAzulPagamentos,
  type CreateContaAzulChargeInput,
} from "@/lib/contaazul/service";
import { ping } from "@/lib/contaazul/client";
import { AuthError, requireAuth, requireModule } from "@/lib/supabase/auth-guard";
import type { ModuleAction } from "@/lib/rbac";

// R4-03 — mapeamento de erro compartilhado (AuthError→status; 403 já tratado).
function mapError(err: unknown): never {
  console.error("contaazul-rpc: mapError:", err instanceof Error ? err.message : err);
  if (err instanceof AuthError) {
    setResponseStatus(err.status);
    throw new Error(err.message);
  }
  const status = (err as { status?: number })?.status;
  setResponseStatus(typeof status === "number" ? status : 500);
  throw err instanceof Error ? new Error(err.message) : err;
}

// R4-03 — RPCs de $ (Conta Azul): exigem permissão EFETIVA no módulo
// `financeiro` (respeita overrides por usuário, igual à UI). Escrita/sync →
// `edit`. Não-financeiro recebe 403.
// IMPORTANTE (C5): o cron das 08:30 NÃO passa por aqui — ele chama o SERVICE
// `syncContaAzulPagamentos` direto em api.cron.sync-contaazul.tsx (autenticado
// por CRON_SECRET). Reforçar `syncContaAzulPagamentosFn` não afeta o cron.
async function handle<T>(action: ModuleAction, fn: () => Promise<T>): Promise<T> {
  try {
    await requireModule("financeiro", action);
    return await fn();
  } catch (err: unknown) {
    mapError(err);
  }
}

// `pingFn` é health-check e NÃO expõe $ — mantém só `requireAuth`. R4-03 (AC-5).
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

export const syncClientToContaAzulFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => syncClientSchema.parse(data))
  .handler(async ({ data }) => handle("edit", () => syncClientToContaAzul(data.clientId)));

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
    handle("edit", () => createContaAzulCharge(data as CreateContaAzulChargeInput)),
  );

// ─── Sync de Pagamentos (manual — o cron das 08:30 chama o mesmo motor) ──────

const syncPagamentosSchema = z.object({ caseId: z.string().uuid().optional() });

export const syncContaAzulPagamentosFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => syncPagamentosSchema.parse(data ?? {}))
  .handler(async ({ data }) => handle("edit", () => syncContaAzulPagamentos(data.caseId)));

// ─── Health Check ────────────────────────────────────────────────────────────

export const contaAzulPingFn = createServerFn({ method: "GET" }).handler(async () =>
  handleAuthOnly(() => ping()),
);
