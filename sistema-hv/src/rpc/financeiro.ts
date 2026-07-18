import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  getDashboardFinanceiro,
  getRelatorioFinanceiroPorCaso,
  listAllParcelas,
} from "@/lib/financeiro-service";
import { syncAsaasPagamentos } from "@/lib/asaas/service";
import { syncContaAzulPagamentos } from "@/lib/contaazul/service";
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

export const getDashboardFinanceiroFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => getDashboardFinanceiro()),
);

const listParcelasFiltersSchema = z.object({
  clientId: z.string().uuid().optional(),
  status: z.string().optional(),
});

export const listAllParcelasFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => listParcelasFiltersSchema.parse(d ?? {}))
  .handler(async ({ data }) => handle(() => listAllParcelas(data)));

// Relatório financeiro por CASO (pago/pendente/vencido) — item 3.
export const getRelatorioFinanceiroFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => getRelatorioFinanceiroPorCaso()),
);

// Sync de pagamentos — dispara sync simultâneo no Asaas e Conta Azul.
export const syncAllPagamentosFn = createServerFn({ method: "POST" }).handler(async () =>
  handle(async () => {
    const [asaas, contaAzul] = await Promise.allSettled([
      syncAsaasPagamentos(),
      syncContaAzulPagamentos(),
    ]);
    return {
      asaas: asaas.status === "fulfilled" ? asaas.value : { ok: false, nota: String((asaas as PromiseRejectedResult).reason) },
      contaAzul: contaAzul.status === "fulfilled" ? contaAzul.value : { ok: false, nota: String((contaAzul as PromiseRejectedResult).reason) },
    };
  }),
);
