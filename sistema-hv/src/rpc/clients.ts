import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  ClientServiceError,
  createClient,
  findOrCreateClient,
  getClient,
  hardDeleteClient,
  listClients,
  listClientsByLifecycle,
  resyncClientDriveFolder,
  tornarCliente,
  updateClient,
} from "@/lib/clients-service";
import { checkEmailDeliverability } from "@/lib/email-verify";
import { AuthError, requireAnyModule, requireAuth } from "@/lib/supabase/auth-guard";
import { clientCreateSchema, clientUpdateSchema } from "@/lib/validators/client";

const idSchema = z.object({ id: z.string().uuid("ID inválido") });

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
      if (err instanceof ClientServiceError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err;
    }
  })();
}

// Leitura: qualquer usuário autenticado.
function handle<T>(fn: () => Promise<T>): Promise<T> {
  return run(() => requireAuth(), fn);
}

// Escrita de CADASTRO (2026-07-19) — cliente/lead é criado/editado tanto na aba
// Comercial/Cadastro quanto na aba Clientes/Operacional. Exige edição em QUALQUER
// uma das duas; um colaborador com "view" nas duas é barrado (403).
function handleWrite<T>(fn: () => Promise<T>): Promise<T> {
  return run(() => requireAnyModule(["comercial", "operacional"], "edit"), fn);
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

// S1-05 — abas Leads / Clientes / Perdidos (filtros por lifecycle do caso).
const lifecycleTabSchema = z.object({ tab: z.enum(["lead", "cliente", "perdido"]) });

export const listClientsByLifecycleFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => lifecycleTabSchema.parse(data))
  .handler(async ({ data }) => handle(() => listClientsByLifecycle(data.tab)));

// ----------------------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------------------
export const createClientFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => clientCreateSchema.parse(data))
  .handler(async ({ data }) => handleWrite(() => createClient(data)));

// S1-04 — find-or-create por CPF: reutiliza a pessoa ativa existente (nunca 500
// por unique_violation), merge só de campos vazios, retorna conflitos ao front.
export const findOrCreateClientFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => clientCreateSchema.parse(data))
  .handler(async ({ data }) => handleWrite(() => findOrCreateClient(data)));

// Verificação de entregabilidade do e-mail (DNS/MX + sugestão de typo). Usada
// pelo formulário no onBlur do campo e-mail para avisar/sugerir antes de salvar.
export const checkEmailFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().trim().min(3).max(200) }).parse(data),
  )
  .handler(async ({ data }) => handle(() => checkEmailDeliverability(data.email)));

const updateInputSchema = z.object({
  id: z.string().uuid("ID inválido"),
  input: clientUpdateSchema,
});

export const updateClientFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInputSchema.parse(data))
  .handler(async ({ data }) => handleWrite(() => updateClient(data.id, data.input)));

// HARD-DELETE — exclusão PERMANENTE do cliente e de tudo que depende dele
// (casos + filhos, docs, notas, consentimentos). Substitui o antigo soft-delete.
export const hardDeleteClientFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handleWrite(() => hardDeleteClient(data.id)));

export const resyncDriveFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handleWrite(() => resyncClientDriveFolder(data.id)));

// TORNAR CLIENTE — botão "Tornar esse lead um cliente" na ficha.
export const tornarClienteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => handleWrite(() => tornarCliente(data.id)));
