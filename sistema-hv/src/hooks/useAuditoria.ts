// Hooks da auditoria (AU1). O componente de tela é reusado pelo menu global e
// pelo painel dentro do caso — só muda o filtro `caseId`.

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listAuditActionsFn, listAuditEventsFn } from "@/rpc/auditoria";

export interface AuditFiltros {
  from?: string | null;
  to?: string | null;
  userId?: string | null;
  caseId?: string | null;
  action?: string | null;
  q?: string | null;
  cursor?: string | null;
}

export function useAuditEvents(filtros: AuditFiltros = {}) {
  const fn = useServerFn(listAuditEventsFn);
  return useQuery({
    queryKey: ["auditoria", filtros],
    queryFn: () => fn({ data: filtros as never }),
    staleTime: 30 * 1000,
  });
}

export function useAuditActions() {
  const fn = useServerFn(listAuditActionsFn);
  return useQuery({
    queryKey: ["auditoria-actions"],
    queryFn: () => fn(),
    staleTime: 10 * 60 * 1000,
  });
}
