// RPC (server-only) — #2 Workflows: CRUD das regras. Gate: sistema (view/edit).

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import {
  createWorkflowRule,
  deleteWorkflowRule,
  listWorkflowRules,
  updateWorkflowRule,
  type WorkflowRule,
} from "@/lib/workflow-rules-service";

export type { WorkflowRule } from "@/lib/workflow-rules-service";

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

const actionSchema = z.record(z.string(), z.unknown());
const ruleInputSchema = z.object({
  name: z.string().min(1),
  temaId: z.string().uuid().nullish(),
  triggerType: z.enum(["status_changed", "checklist_completed", "task_created", "task_completed"]),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  actions: z.array(actionSchema).optional(),
  active: z.boolean().optional(),
});

export const listWorkflowRulesFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async (): Promise<WorkflowRule[]> => {
    await requireModule("sistema", "view");
    return listWorkflowRules();
  }),
);

export const createWorkflowRuleFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ruleInputSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireModule("sistema", "edit");
      return createWorkflowRule(data, userId);
    }),
  );

export const updateWorkflowRuleFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: ruleInputSchema.partial() }).parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("sistema", "edit");
      return updateWorkflowRule(data.id, data.patch);
    }),
  );

export const deleteWorkflowRuleFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("sistema", "edit");
      return deleteWorkflowRule(data.id);
    }),
  );
