import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  addCaseLinkFn,
  listLinkedCasesFn,
  removeCaseLinkFn,
  searchCasesForLinkFn,
} from "@/rpc/case-links";

const key = (caseId: string) => ["case-links", caseId] as const;

export function useLinkedCases(caseId: string) {
  const fn = useServerFn(listLinkedCasesFn);
  return useQuery({
    queryKey: key(caseId),
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

export function useSearchCasesForLink() {
  const fn = useServerFn(searchCasesForLinkFn);
  return useMutation({
    mutationFn: (vars: { query: string; excludeCaseId: string }) => fn({ data: vars }),
  });
}

export function useAddCaseLink(caseId: string) {
  const fn = useServerFn(addCaseLinkFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkedCaseId: string) => fn({ data: { caseId, linkedCaseId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(caseId) }),
  });
}

export function useRemoveCaseLink(caseId: string) {
  const fn = useServerFn(removeCaseLinkFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => fn({ data: { linkId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(caseId) }),
  });
}
