import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  ClientServiceError,
  createClient,
  getClient,
  listClients,
  resyncClientDriveFolder,
  softDeleteClient,
  updateClient,
} from "@/lib/clients-service";
import { AuthError, requireAuth } from "@/lib/supabase/auth-guard";
import { clientCreateSchema, clientUpdateSchema } from "@/lib/validators/client";

const idSchema = z.object({ id: z.string().uuid("ID inválido") });

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await requireAuth();
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    if (err instanceof ClientServiceError) {
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
export const listClientsFn = createServerFn({ method: "GET" })
  .inputValidator((data: { search?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => handle(() => listClients(data.search)));

export const getClientFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle(() => getClient(data.id)));

// ----------------------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------------------
export const createClientFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => clientCreateSchema.parse(data))
  .handler(async ({ data }) => handle(() => createClient(data)));

const updateInputSchema = z.object({
  id: z.string().uuid("ID inválido"),
  input: clientUpdateSchema,
});

export const updateClientFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInputSchema.parse(data))
  .handler(async ({ data }) => handle(() => updateClient(data.id, data.input)));

export const softDeleteClientFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle(() => softDeleteClient(data.id)));

export const resyncDriveFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handle(() => resyncClientDriveFolder(data.id)));
