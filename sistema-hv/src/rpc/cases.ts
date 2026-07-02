import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { MACRO_FIN, MACRO_OP } from "@/lib/cases/constants";
import {
  CaseServiceError,
  createCase,
  createComercialCaseAndGenerateProcuracao,
  getCase,
  liberarCasoComercial,
  listCaseEvents,
  listCases,
  listComercialCases,
  marcarCasoPerdido,
  moveCaseStatus,
  moveCaseStatusFin,
  previewProcuracao,
  promoverCasoManual,
  softDeleteCase,
  updateCase,
} from "@/lib/cases-service";
import { AuthError, requireAuth } from "@/lib/supabase/auth-guard";
import {
  caseCreateSchema,
  caseUpdateSchema,
  createComercialProcuracaoSchema,
  previewProcuracaoSchema,
} from "@/lib/validators/case";

const idSchema = z.object({ id: z.string().uuid() });

async function handle<T>(fn: (userId: string) => Promise<T>): Promise<T> {
  try {
    const { id: userId } = await requireAuth();
    return await fn(userId);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    if (err instanceof CaseServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  }
}

// ----------------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------------

const listFiltersSchema = z
  .object({
    search: z.string().optional(),
    macrostatus_op: z.enum(MACRO_OP).optional(),
    macrostatus_fin: z.enum(MACRO_FIN).optional(),
    client_id: z.string().uuid().optional(),
  })
  .optional()
  .default({});

export const listCasesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => listFiltersSchema.parse(data))
  .handler(async ({ data }) => handle(() => listCases(data)));

export const getCaseFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle(() => getCase(data.id)));

export const listCaseEventsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle(() => listCaseEvents(data.id)));

// ----------------------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------------------

export const createCaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => caseCreateSchema.parse(data))
  .handler(async ({ data }) => handle((userId) => createCase(data, userId)));

// Procuração comercial — preview dos campos <...> + valores do cadastro.
export const previewProcuracaoFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => previewProcuracaoSchema.parse(data))
  .handler(async ({ data }) =>
    handle(() =>
      previewProcuracao({
        clientId: data.client_id,
        templateId: data.template_id,
        municipio: data.municipio,
        responsavel: data.responsavel,
      }),
    ),
  );

// Procuração comercial — cria o caso + gera + finaliza (sem enviar ao ZapSign).
export const createComercialProcuracaoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createComercialProcuracaoSchema.parse(data))
  .handler(async ({ data }) =>
    handle((userId) =>
      createComercialCaseAndGenerateProcuracao(
        {
          case: data.case,
          templateId: data.template_id,
          values: data.values,
        },
        userId,
      ),
    ),
  );

const updateInputSchema = z.object({
  id: z.string().uuid(),
  input: caseUpdateSchema,
});

export const updateCaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInputSchema.parse(data))
  .handler(async ({ data }) => handle((userId) => updateCase(data.id, data.input, userId)));

const moveSchema = z.object({ id: z.string().uuid(), to: z.enum(MACRO_OP) });

export const moveCaseStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => moveSchema.parse(data))
  .handler(async ({ data }) => handle((userId) => moveCaseStatus(data.id, data.to, userId)));

const moveFinSchema = z.object({ id: z.string().uuid(), to: z.enum(MACRO_FIN) });

export const moveCaseStatusFinFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => moveFinSchema.parse(data))
  .handler(async ({ data }) => handle((userId) => moveCaseStatusFin(data.id, data.to, userId)));

export const softDeleteCaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle((userId) => softDeleteCase(data.id, userId)));

// ----------------------------------------------------------------------------
// Comercial (Melhoria 3)
// ----------------------------------------------------------------------------
export const listComercialCasesFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listComercialCases()),
);

// Liberação manual: usuário confirma que a procuração foi assinada.
export const liberarCasoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) =>
    handle((userId) => liberarCasoComercial(data.id, { via: "manual", userId })),
  );

// ----------------------------------------------------------------------------
// S1-03 / S1-01b — Botões manuais lead→cliente e lead/cliente→perdido.
// Qualquer usuário autenticado pode (sem gate por cargo); auditoria obrigatória.
// ----------------------------------------------------------------------------
export const promoverCasoManualFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle((userId) => promoverCasoManual(data.id, userId)));

const marcarPerdidoSchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().min(1, "Informe o motivo da perda"),
});

export const marcarCasoPerdidoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => marcarPerdidoSchema.parse(data))
  .handler(async ({ data }) => handle((userId) => marcarCasoPerdido(data.id, data.motivo, userId)));
