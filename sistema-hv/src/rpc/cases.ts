import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { MACRO_FIN, MACRO_OP } from "@/lib/cases/constants";
import {
  CaseServiceError,
  createCase,
  getCase,
  listCaseEvents,
  listCases,
  moveCaseStatus,
  moveCaseStatusFin,
  softDeleteCase,
  updateCase,
} from "@/lib/cases-service";
import { caseCreateSchema, caseUpdateSchema } from "@/lib/validators/case";

const idSchema = z.object({ id: z.string().uuid() });

function handle<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    if (err instanceof CaseServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  });
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
  .handler(async ({ data }) => handle(() => createCase(data)));

const updateInputSchema = z.object({
  id: z.string().uuid(),
  input: caseUpdateSchema,
});

export const updateCaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInputSchema.parse(data))
  .handler(async ({ data }) => handle(() => updateCase(data.id, data.input)));

const moveSchema = z.object({ id: z.string().uuid(), to: z.enum(MACRO_OP) });

export const moveCaseStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => moveSchema.parse(data))
  .handler(async ({ data }) => handle(() => moveCaseStatus(data.id, data.to)));

const moveFinSchema = z.object({ id: z.string().uuid(), to: z.enum(MACRO_FIN) });

export const moveCaseStatusFinFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => moveFinSchema.parse(data))
  .handler(async ({ data }) => handle(() => moveCaseStatusFin(data.id, data.to)));

export const softDeleteCaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle(() => softDeleteCase(data.id)));
