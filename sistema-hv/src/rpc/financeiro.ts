import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  getClientPaymentStatus,
  getDashboardFinanceiro,
  getRastroFinanceiroCaso,
  getRelatorioFinanceiroPorCaso,
  listAllParcelas,
} from "@/lib/financeiro-service";
import { syncAsaasPagamentos } from "@/lib/asaas/service";
import { syncContaAzulPagamentos } from "@/lib/contaazul/service";
import { AuthError, requireAuth, requireModule } from "@/lib/supabase/auth-guard";
import type { ModuleAction } from "@/lib/rbac";

// R4-03 — todos os RPCs deste arquivo expõem/movimentam $ (módulo `financeiro`).
// O `handle()` exige a permissão EFETIVA no módulo (respeita overrides por
// usuário, igual à UI): leitura → `view`, escrita/sync → `edit`. Não-financeiro
// recebe 403 (o mapeamento AuthError→status abaixo já trata). Nenhum RPC daqui é
// chamado pelo cron (o cron das 08:30 chama o SERVICE `syncContaAzulPagamentos`
// direto em api.cron.sync-contaazul.tsx, autenticado por CRON_SECRET).
async function handle<T>(action: ModuleAction, fn: () => Promise<T>): Promise<T> {
  try {
    await requireModule("financeiro", action);
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
  handle("view", () => getDashboardFinanceiro()),
);

const listParcelasFiltersSchema = z.object({
  clientId: z.string().uuid().optional(),
  status: z.string().optional(),
});

export const listAllParcelasFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => listParcelasFiltersSchema.parse(d ?? {}))
  .handler(async ({ data }) => handle("view", () => listAllParcelas(data)));

// R4-04 (AC-3) — SELO BINÁRIO "Em dia / Devendo" do cliente.
// ATENÇÃO: este RPC usa `requireAuth` (qualquer autenticado), NÃO
// `requireModule('financeiro','view')`. Isso é INTENCIONAL: o retorno é apenas
// `{ emDia: boolean }` — um sinal binário NÃO-SENSÍVEL, sem nenhum centavo/valor.
// Se fosse gated por `financeiro:view`, o operacional (que pode ver a ficha do
// cliente mas não os $) receberia 403 e o selo não apareceria — justamente o
// caso de uso. O serviço `getClientPaymentStatus` só lê `status`/`vencimento`
// das parcelas e nunca expõe valor, então é seguro liberar a todo autenticado.
const clientStatusSchema = z.object({ clientId: z.string().uuid() });

export const getClientPaymentStatusFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => clientStatusSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      await requireAuth();
      return await getClientPaymentStatus(data.clientId);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      const status = (err as { status?: number })?.status;
      setResponseStatus(typeof status === "number" ? status : 500);
      throw err instanceof Error ? new Error(err.message) : err;
    }
  });

// Relatório financeiro por CASO (pago/pendente/vencido) — item 3.
export const getRelatorioFinanceiroFn = createServerFn({ method: "GET" }).handler(async () =>
  handle("view", () => getRelatorioFinanceiroPorCaso()),
);

// F1 (AC-4) — rastro financeiro RESUMIDO de UM caso (a pagar/vencido/pago).
// Gate `financeiro:view` (via handle) — nunca expõe $ a quem não tem acesso.
const rastroCasoSchema = z.object({ caseId: z.string().uuid() });
export const getRastroFinanceiroCasoFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => rastroCasoSchema.parse(d))
  .handler(async ({ data }) => handle("view", () => getRastroFinanceiroCaso(data.caseId)));

// Sync de pagamentos — dispara sync simultâneo no Asaas e Conta Azul.
export const syncAllPagamentosFn = createServerFn({ method: "POST" }).handler(async () =>
  handle("edit", async () => {
    const [asaas, contaAzul] = await Promise.allSettled([
      syncAsaasPagamentos(),
      syncContaAzulPagamentos(),
    ]);
    return {
      asaas:
        asaas.status === "fulfilled"
          ? asaas.value
          : { ok: false, nota: String((asaas as PromiseRejectedResult).reason) },
      contaAzul:
        contaAzul.status === "fulfilled"
          ? contaAzul.value
          : { ok: false, nota: String((contaAzul as PromiseRejectedResult).reason) },
    };
  }),
);
