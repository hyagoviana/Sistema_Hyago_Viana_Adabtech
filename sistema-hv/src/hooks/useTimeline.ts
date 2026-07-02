import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { queryKeys } from "@/lib/queryKeys";
import {
  addManualCaseEventFn,
  deleteManualCaseEventFn,
  updateManualCaseEventFn,
} from "@/rpc/timeline";

type ManualAction = "nota_manual" | "marco";

export function useAddManualCaseEvent(caseId: string) {
  const fn = useServerFn(addManualCaseEventFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { action: ManualAction; body: string }) =>
      fn({ data: { caseId, action: vars.action, body: vars.body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.events(caseId) }),
  });
}

export function useUpdateManualCaseEvent(caseId: string) {
  const fn = useServerFn(updateManualCaseEventFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { eventId: string; body: string }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.events(caseId) }),
  });
}

export function useDeleteManualCaseEvent(caseId: string) {
  const fn = useServerFn(deleteManualCaseEventFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => fn({ data: { eventId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cases.events(caseId) }),
  });
}
