import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createWorkflowRuleFn,
  deleteWorkflowRuleFn,
  listWorkflowRulesFn,
  updateWorkflowRuleFn,
} from "@/rpc/workflows";

const KEY = ["workflow-rules"] as const;

export function useWorkflowRules() {
  const fn = useServerFn(listWorkflowRulesFn);
  return useQuery({ queryKey: KEY, queryFn: () => fn() });
}

type RuleInput = {
  name: string;
  temaId?: string | null;
  triggerType: "status_changed" | "checklist_completed" | "task_created" | "task_completed";
  triggerConfig?: Record<string, unknown>;
  actions?: Array<Record<string, unknown>>;
  active?: boolean;
};

export function useCreateWorkflowRule() {
  const fn = useServerFn(createWorkflowRuleFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RuleInput) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateWorkflowRule() {
  const fn = useServerFn(updateWorkflowRuleFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Partial<RuleInput> }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteWorkflowRule() {
  const fn = useServerFn(deleteWorkflowRuleFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
