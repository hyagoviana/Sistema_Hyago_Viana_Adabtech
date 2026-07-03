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
  darBaixaParcela,
  enviarParaConferencia,
  estornarParcela,
  gerarDocumentoTermo,
  getCaseHonorarios,
  getTermo,
  listParcelas,
  listTermos,
  recusarTermo,
} from "@/lib/termo-service";
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

// S7-02 — honorários persistidos da procuração (para pré-preencher a elaboração).
export const getCaseHonorariosFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => getCaseHonorarios(data.caseId)));

// Preview do cálculo (não salva) — calc autoritativo no servidor.
export const calcularTermoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => calcSchema.parse(d))
  .handler(async ({ data }) => handle(async () => calcularTermo(data)));

const createSchema = calcSchema.extend({
  caseId: z.string().uuid(),
  formaPagamento: z.enum(["PARCELADO", "A_VISTA"]).optional(),
  tipoTermo: z.enum(["PARCIAL", "COMPLEMENTAR"]).optional(),
  elaboradoPorId: z.string().uuid().nullish(),
  // S7-02 — remanescente anterior (COMPLEMENTAR) persistido no snapshot.
  remanescenteAnteriorCentavos: z.number().int().nonnegative().nullish(),
});

export const createTermoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => handle(() => createTermo(data)));

export const enviarParaConferenciaFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ termoId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => enviarParaConferencia(data.termoId)));

// S6-04 — gera o documento editável do termo (2 opções) e grava drive_url no
// snapshot RASCUNHO. remanescenteAnteriorCentavos é input de tela (COMPLEMENTAR).
export const gerarDocumentoTermoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        termoId: z.string().uuid(),
        remanescenteAnteriorCentavos: z.number().int().nonnegative().optional(),
        // S7-02 — inputs opcionais p/ placeholders sem fonte no cálculo.
        saldoAtualCentavos: z.number().int().nonnegative().optional(),
        percentualAbatimento: z.number().nonnegative().optional(),
        saldoOriginarioCentavos: z.number().int().nonnegative().optional(),
        saldoEpocaAbatimentoCentavos: z.number().int().nonnegative().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireAuth();
      return gerarDocumentoTermo({
        termoId: data.termoId,
        remanescenteAnteriorCentavos: data.remanescenteAnteriorCentavos,
        saldoAtualCentavos: data.saldoAtualCentavos,
        percentualAbatimento: data.percentualAbatimento,
        saldoOriginarioCentavos: data.saldoOriginarioCentavos,
        saldoEpocaAbatimentoCentavos: data.saldoEpocaAbatimentoCentavos,
        triggeredBy: userId,
      });
    }),
  );

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

export const recusarTermoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ termoId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => recusarTermo(data.termoId)));

export const listParcelasFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listParcelas(data.caseId)));

export const darBaixaParcelaFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        parcelaId: z.string().uuid(),
        valorPagoCentavos: z.number().int().nonnegative(),
        dataPagamento: z.string().nullish(),
        metodoPagamento: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(() =>
      darBaixaParcela(data.parcelaId, {
        valorPagoCentavos: data.valorPagoCentavos,
        dataPagamento: data.dataPagamento,
        metodoPagamento: data.metodoPagamento,
      }),
    ),
  );

export const estornarParcelaFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ parcelaId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => estornarParcela(data.parcelaId)));
