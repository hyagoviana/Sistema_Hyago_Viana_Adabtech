// RPC (server-only) — #13 Casos vinculados. Leitura = view; escrita = edit
// (comercial|operacional), mesma régua das notas/dossiê do caso.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireAnyModule } from "@/lib/supabase/auth-guard";
import {
  addCaseLink,
  listLinkedCases,
  removeCaseLink,
  searchCasesForLink,
  type LinkedCase,
  type CaseSearchHit,
} from "@/lib/case-links-service";

export type { LinkedCase, CaseSearchHit } from "@/lib/case-links-service";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err instanceof Error ? new Error(err.message) : new Error(String(err));
  }
}

export const listLinkedCasesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async (): Promise<LinkedCase[]> => {
      await requireAnyModule(["comercial", "operacional"], "view");
      return listLinkedCases(data.caseId);
    }),
  );

export const searchCasesForLinkFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ query: z.string(), excludeCaseId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async (): Promise<CaseSearchHit[]> => {
      await requireAnyModule(["comercial", "operacional"], "view");
      return searchCasesForLink(data.query, data.excludeCaseId);
    }),
  );

export const addCaseLinkFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ caseId: z.string().uuid(), linkedCaseId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireAnyModule(["comercial", "operacional"], "edit");
      return addCaseLink(data.caseId, data.linkedCaseId, userId);
    }),
  );

export const removeCaseLinkFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ linkId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireAnyModule(["comercial", "operacional"], "edit");
      return removeCaseLink(data.linkId);
    }),
  );
