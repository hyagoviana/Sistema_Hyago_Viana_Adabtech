// Server-only — #2 (2026-08-17) — CRUD das regras de Workflow. A EXECUÇÃO fica no
// workflow-engine.ts; aqui só o cadastro (admin).

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class WorkflowRuleError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "WorkflowRuleError";
  }
}

export interface WorkflowRule {
  id: string;
  name: string;
  active: boolean;
  tema_id: string | null;
  trigger_type: string;
  trigger_config: Json;
  actions: Json;
  created_at: string;
}

export interface WorkflowRuleInput {
  name: string;
  temaId?: string | null;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  actions?: Array<Record<string, unknown>>;
  active?: boolean;
}

const TRIGGERS = ["status_changed", "checklist_completed", "task_created", "task_completed"];

function validate(input: WorkflowRuleInput) {
  if (!input.name?.trim()) throw new WorkflowRuleError("Nome do workflow é obrigatório", 422);
  if (!TRIGGERS.includes(input.triggerType)) throw new WorkflowRuleError("Gatilho inválido", 422);
}

export async function listWorkflowRules(): Promise<WorkflowRule[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_workflow_rules")
    .select("id, name, active, tema_id, trigger_type, trigger_config, actions, created_at")
    .eq("organization_id", DEFAULT_ORG)
    .order("created_at", { ascending: false });
  if (error) throw new WorkflowRuleError(error.message, 500);
  return (data ?? []) as WorkflowRule[];
}

export async function createWorkflowRule(
  input: WorkflowRuleInput,
  userId: string,
): Promise<{ ok: true }> {
  validate(input);
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("system_workflow_rules").insert({
    organization_id: DEFAULT_ORG,
    name: input.name.trim(),
    active: input.active ?? true,
    tema_id: input.temaId ?? null,
    trigger_type: input.triggerType,
    trigger_config: (input.triggerConfig ?? {}) as Json,
    actions: (input.actions ?? []) as unknown as Json,
    created_by: userId,
  });
  if (error) throw new WorkflowRuleError(error.message, 500);
  return { ok: true };
}

export async function updateWorkflowRule(
  id: string,
  patch: Partial<WorkflowRuleInput>,
): Promise<{ ok: true }> {
  const sb = getSupabaseAdmin();
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.active !== undefined) clean.active = patch.active;
  if (patch.temaId !== undefined) clean.tema_id = patch.temaId;
  if (patch.triggerType !== undefined) {
    if (!TRIGGERS.includes(patch.triggerType)) throw new WorkflowRuleError("Gatilho inválido", 422);
    clean.trigger_type = patch.triggerType;
  }
  if (patch.triggerConfig !== undefined) clean.trigger_config = patch.triggerConfig;
  if (patch.actions !== undefined) clean.actions = patch.actions;
  const { error } = await sb
    .from("system_workflow_rules")
    .update(clean as never)
    .eq("id", id);
  if (error) throw new WorkflowRuleError(error.message, 500);
  return { ok: true };
}

export async function deleteWorkflowRule(id: string): Promise<{ ok: true }> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("system_workflow_rules").delete().eq("id", id);
  if (error) throw new WorkflowRuleError(error.message, 500);
  return { ok: true };
}
