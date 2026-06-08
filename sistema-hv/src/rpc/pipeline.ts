import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  bifurcarCaseToFinanceiro,
  createServiceType,
  createStage,
  listCasesByServiceType,
  listServiceTypes,
  listStages,
  moveCaseToStageFin,
  moveCaseToStageOp,
  reorderStages,
  setAcertoParcial,
  softDeleteStage,
  updateStage,
} from "@/lib/pipeline-service";

function handle<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    const status = (err as { status?: number })?.status;
    setResponseStatus(typeof status === "number" ? status : 500);
    throw err instanceof Error ? new Error(err.message) : err;
  });
}

const kindSchema = z.enum(["op", "fin"]);

export const listServiceTypesFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listServiceTypes()),
);

export const listStagesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ serviceTypeId: z.string().uuid(), kind: kindSchema }).parse(d),
  )
  .handler(async ({ data }) => handle(() => listStages(data.serviceTypeId, data.kind)));

export const listCasesByServiceTypeFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ serviceTypeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => listCasesByServiceType(data.serviceTypeId)));

export const moveCaseToStageOpFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ caseId: z.string().uuid(), stageId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => handle(() => moveCaseToStageOp(data.caseId, data.stageId)));

export const moveCaseToStageFinFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ caseId: z.string().uuid(), stageId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => handle(() => moveCaseToStageFin(data.caseId, data.stageId)));

export const bifurcarCaseFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => bifurcarCaseToFinanceiro(data.caseId)));

export const setAcertoParcialFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        acerto_parcial: z.boolean(),
        tem_pendencia_judicial: z.boolean(),
        obs: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(() =>
      setAcertoParcial(data.caseId, {
        acerto_parcial: data.acerto_parcial,
        tem_pendencia_judicial: data.tem_pendencia_judicial,
        obs: data.obs,
      }),
    ),
  );

export const createServiceTypeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(1), slug: z.string().min(1), ordem: z.number().optional() }).parse(d),
  )
  .handler(async ({ data }) => handle(() => createServiceType(data)));

const createStageSchema = z.object({
  service_type_id: z.string().uuid(),
  kind: kindSchema,
  slug: z.string().min(1),
  label: z.string().min(1),
  stage_role: z.enum(["normal", "won", "lost", "closed"]).optional(),
  color: z.string().nullish(),
  ordem: z.number().optional(),
});

export const createStageFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createStageSchema.parse(d))
  .handler(async ({ data }) =>
    handle(() =>
      createStage({
        service_type_id: data.service_type_id,
        kind: data.kind,
        slug: data.slug,
        label: data.label,
        stage_role: data.stage_role,
        color: data.color,
        ordem: data.ordem,
      }),
    ),
  );

export const updateStageFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          label: z.string().optional(),
          stage_role: z.enum(["normal", "won", "lost", "closed"]).optional(),
          color: z.string().nullish(),
          ordem: z.number().optional(),
          active: z.boolean().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => handle(() => updateStage(data.id, data.patch)));

export const reorderStagesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data }) => handle(() => reorderStages(data.ids)));

export const softDeleteStageFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => handle(() => softDeleteStage(data.id)));
