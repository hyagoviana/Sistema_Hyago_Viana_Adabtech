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
} as const;
