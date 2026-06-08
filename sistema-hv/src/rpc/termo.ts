import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  aceitarTermo,
  apresentarTermo,
  aprovarTermoManual,
  calcularTermo,
  conferirTermo,
  createTermo,
  enviarParaConferencia,
  getTermo,
  listParcelas,
  listTermos,
} from "@/lib/termo-service";

function handle<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    const status = (err as { status?: number })?.status;
    setResponseStatus(typeof status === "number" ? status : 500);
    throw err instanceof Error ? new Error(err.message) : err;
  });
}

const calcSchema = z.object({
  saldoAntesCentavos: z.number().int().nonnegative(),
  saldoDepoisCentavos: z.number().int().nonnegative(),
  parcelasPagasCentavos: z.number().int().nonnegative().optional(),
  percentual: z.number().optional(),
  valorParcelaCentavos: z.number().int().positive().optional(),
  descontoAvistaPct: z.number().optional(),
});

export const listTermosFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listTermos(data.caseId)));

export const getTermoFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => getTermo(data.id)));

// Preview do cálculo (não salva) — calc autoritativo no servidor.
export const calcularTermoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => calcSchema.parse(d))
  .handler(async ({ data }) => handle(async () => calcularTermo(data)));

const createSchema = calcSchema.extend({
  caseId: z.string().uuid(),
  formaPagamento: z.enum(["PARCELADO", "A_VISTA"]).optional(),
  tipoTermo: z.enum(["PARCIAL", "COMPLEMENTAR"]).optional(),
  elaboradoPorId: z.string().uuid().nullish(),
});

export const createTermoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => handle(() => createTermo(data)));

export const enviarParaConferenciaFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ termoId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => enviarParaConferencia(data.termoId)));

export const conferirTermoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ termoId: z.string().uuid(), conferidoPorId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => handle(() => conferirTermo(data.termoId, data.conferidoPorId)));

export const aprovarTermoManualFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ termoId: z.string().uuid(), aprovadoPorId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => handle(() => aprovarTermoManual(data.termoId, data.aprovadoPorId)));

export const apresentarTermoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ termoId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => apresentarTermo(data.termoId)));

export const aceitarTermoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ termoId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => aceitarTermo(data.termoId)));

export const listParcelasFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listParcelas(data.caseId)));
