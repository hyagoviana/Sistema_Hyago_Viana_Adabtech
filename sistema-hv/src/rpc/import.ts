import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  createImportTemplate,
  deleteImportTemplate,
  executeImport,
  getImportTemplate,
  ImportServiceError,
  listImportRuns,
  listImportTemplates,
} from "@/lib/import-service";
import { AuthError, requireAnyModule, requireAuth } from "@/lib/supabase/auth-guard";
import { importExecuteSchema, importTemplateCreateSchema } from "@/lib/validators/import";

const idSchema = z.object({ id: z.string().uuid("ID invalido") });

function run<T>(guard: () => Promise<unknown>, fn: () => Promise<T>): Promise<T> {
  return (async () => {
    try {
      await guard();
      return await fn();
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      if (err instanceof ImportServiceError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err;
    }
  })();
}

function handle<T>(fn: () => Promise<T>): Promise<T> {
  return run(() => requireAuth(), fn);
}

function handleWrite<T>(fn: () => Promise<T>): Promise<T> {
  return run(() => requireAnyModule(["comercial", "operacional"], "edit"), fn);
}

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------
export const listImportTemplatesFn = createServerFn({ method: "GET" })
  .inputValidator((_: unknown) => ({}))
  .handler(async () => handle(() => listImportTemplates()));

export const getImportTemplateFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle(() => getImportTemplate(data.id)));

export const createImportTemplateFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => importTemplateCreateSchema.parse(data))
  .handler(async ({ data }) => handleWrite(() => createImportTemplate(data)));

export const deleteImportTemplateFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handleWrite(() => deleteImportTemplate(data.id)));

// ----------------------------------------------------------------------------
// Execucao
// ----------------------------------------------------------------------------
export const executeImportFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => importExecuteSchema.parse(data))
  .handler(async ({ data }) => handleWrite(() => executeImport(data)));

// ----------------------------------------------------------------------------
// Historico
// ----------------------------------------------------------------------------
export const listImportRunsFn = createServerFn({ method: "GET" })
  .inputValidator((_: unknown) => ({}))
  .handler(async () => handle(() => listImportRuns()));
