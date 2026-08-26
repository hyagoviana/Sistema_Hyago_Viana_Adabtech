// Server functions do FINANCEIRO DO CASO (FN1 — doc 25.08).
//
// Gate: módulo `financeiro`. Leitura exige `view`; escrita exige `edit` — mesma
// régua do resto do módulo (a aba financeira do caso já gateia na tela, mas o
// servidor é a proteção real).

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  FinanceiroCasoError,
  atualizarParcela,
  criarEntry,
  excluirEntry,
  listCaseFinEntries,
  listCategorias,
  resumoFinanceiroCaso,
  setEntryStatus,
  setTemaContaAzul,
} from "@/lib/financeiro-caso-service";
import { AuthError, requireModule } from "@/lib/supabase/auth-guard";

async function handle<T>(fn: (userId: string) => Promise<T>, modo: "view" | "edit"): Promise<T> {
  try {
    const { id } = await requireModule("financeiro", modo);
    return await fn(id);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    if (err instanceof FinanceiroCasoError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

const caseIdSchema = z.object({ caseId: z.string().uuid() });

export const listFinCategoriasFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ kind: z.enum(["RECEITA", "DESPESA"]).nullish() })
      .default({})
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => handle(() => listCategorias(data.kind ?? null), "view"));

export const listCaseFinEntriesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => caseIdSchema.parse(d))
  .handler(async ({ data }) => handle(() => listCaseFinEntries(data.caseId), "view"));

export const resumoFinanceiroCasoFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => caseIdSchema.parse(d))
  .handler(async ({ data }) => handle(() => resumoFinanceiroCaso(data.caseId), "view"));

const criarSchema = z.object({
  caseId: z.string().uuid(),
  kind: z.enum(["RECEITA", "DESPESA"]),
  tipo: z.string().min(1),
  categoriaId: z.string().uuid().nullish(),
  descricao: z.string().max(500).nullish(),
  valorCentavos: z.number().int().min(0),
  formaPagamento: z.string().max(80).nullish(),
  contaFinanceira: z.string().max(80).nullish(),
  dataVencimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  parcelas: z.number().int().min(1).max(240).optional(),
  periodicidadeMeses: z.number().int().min(1).max(12).optional(),
  fornecedor: z.string().max(120).nullish(),
  recorrente: z.boolean().optional(),
  reembolsavel: z.boolean().optional(),
  parcelasCustomizadas: z
    .array(
      z.object({
        numero: z.number().int().min(1),
        data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        valor_centavos: z.number().int().min(0),
      }),
    )
    .max(240)
    .optional(),
});

export const criarFinEntryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => criarSchema.parse(d))
  .handler(async ({ data }) => handle((userId) => criarEntry(data, userId), "edit"));

export const setFinEntryStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        entryId: z.string().uuid(),
        status: z.enum(["AGUARDANDO", "DISPENSADO", "LANCADO"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handle(() => setEntryStatus(data.entryId, data.status), "edit"));

export const excluirFinEntryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => excluirEntry(data.entryId), "edit"));

export const atualizarFinParcelaFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        parcelaId: z.string().uuid(),
        data_vencimento: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        valor_centavos: z.number().int().min(0).optional(),
        status: z.enum(["AGUARDANDO", "VENCIDA", "PAGA", "CANCELADA"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handle(() => atualizarParcela(data.parcelaId, data), "edit"));

export const setTemaContaAzulFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        temaId: z.string().uuid(),
        centroCustoId: z.string().max(80).nullish(),
        centroCustoNome: z.string().max(120).nullish(),
        servicoId: z.string().max(80).nullish(),
        servicoNome: z.string().max(120).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handle(() => setTemaContaAzul(data.temaId, data), "edit"));
