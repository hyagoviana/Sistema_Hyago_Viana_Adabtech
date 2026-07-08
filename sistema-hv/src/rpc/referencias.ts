import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  deleteMunicipio,
  deletePerfil,
  listMunicipios,
  listPerfis,
  upsertMunicipio,
  upsertPerfil,
} from "@/lib/referencias-service";
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

const idSchema = z.object({ id: z.string().uuid() });

const municipioSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1, "Informe o município"),
  populacao: z.string().trim().optional().default(""),
  densidade: z.string().trim().optional().default(""),
  salario_medio: z.string().trim().optional().default(""),
  percentual: z.string().trim().optional().default(""),
  ibge: z.string().trim().optional().default(""),
  secretario_nome: z.string().trim().optional().default(""),
  secretario_cargo: z.string().trim().optional().default(""),
});

const perfilSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1, "Informe o nome do perfil"),
  texto: z.string().trim().optional().default(""),
});

// --- Municípios ---
export const listMunicipiosFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listMunicipios()),
);

export const upsertMunicipioFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => municipioSchema.parse(d))
  .handler(async ({ data }) => handle(() => upsertMunicipio(data)));

export const deleteMunicipioFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => handle(() => deleteMunicipio(data.id)));

// --- Perfis ---
export const listPerfisFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listPerfis()),
);

export const upsertPerfilFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => perfilSchema.parse(d))
  .handler(async ({ data }) => handle(() => upsertPerfil(data)));

export const deletePerfilFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => handle(() => deletePerfil(data.id)));
