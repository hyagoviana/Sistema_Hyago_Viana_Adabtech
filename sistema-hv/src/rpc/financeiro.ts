import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { getDashboardFinanceiro, listAllParcelas } from "@/lib/financeiro-service";
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
