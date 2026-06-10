import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import { getDashboardFinanceiro } from "@/lib/financeiro-service";

function handle<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    const status = (err as { status?: number })?.status;
    setResponseStatus(typeof status === "number" ? status : 500);
    throw err instanceof Error ? new Error(err.message) : err;
  });
}

// TODO(ADR-015): gate RBAC server-side (financeiro.manage) quando a fundação de
// auth server-side existir; hoje o gate é só na UI (rota restrita por papel).
export const getDashboardFinanceiroFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => getDashboardFinanceiro()),
);
