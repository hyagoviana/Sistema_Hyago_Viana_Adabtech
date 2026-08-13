// Query keys centralizados — usado por TanStack Query pra cache/invalidation.

export const queryKeys = {
  clients: {
    all: ["clients"] as const,
    lists: () => [...queryKeys.clients.all, "list"] as const,
    list: (search?: string) => [...queryKeys.clients.lists(), { search: search ?? "" }] as const,
    details: () => [...queryKeys.clients.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.clients.details(), id] as const,
  },
  documents: {
    all: ["documents"] as const,
    byClient: (clientId: string) => [...queryKeys.documents.all, "client", clientId] as const,
  },
  clientFieldDefs: {
    all: ["clientFieldDefs"] as const,
  },
  checklistDefs: {
    all: ["checklistDefs"] as const,
    byStage: (serviceTypeId: string, stageSlug: string) =>
      [...queryKeys.checklistDefs.all, serviceTypeId, stageSlug] as const,
  },
  checklistItems: {
    all: ["checklistItems"] as const,
    byCase: (caseId: string) => [...queryKeys.checklistItems.all, "case", caseId] as const,
  },
  notes: {
    all: ["notes"] as const,
    byCase: (caseId: string) => [...queryKeys.notes.all, "case", caseId] as const,
    byClient: (clientId: string) => [...queryKeys.notes.all, "client", clientId] as const,
    byCaseFin: (caseId: string) => [...queryKeys.notes.all, "case-fin", caseId] as const,
  },
  cases: {
    all: ["cases"] as const,
    lists: () => [...queryKeys.cases.all, "list"] as const,
    list: (filters?: { search?: string; macrostatus_op?: string; client_id?: string }) =>
      [...queryKeys.cases.lists(), filters ?? {}] as const,
    byClient: (clientId: string) => [...queryKeys.cases.all, "client", clientId] as const,
    details: () => [...queryKeys.cases.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.cases.details(), id] as const,
    events: (caseId: string) => [...queryKeys.cases.all, "events", caseId] as const,
    comercial: () => [...queryKeys.cases.all, "comercial"] as const,
    conferenciaFin: (caseId: string) => [...queryKeys.cases.all, "conferenciaFin", caseId] as const,
  },
  import_: {
    all: ["import"] as const,
    templates: () => [...queryKeys.import_.all, "templates"] as const,
    runs: () => [...queryKeys.import_.all, "runs"] as const,
  },
} as const;
