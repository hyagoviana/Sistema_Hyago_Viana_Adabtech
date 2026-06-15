import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000, // 2 min — dados ficam "frescos" e não refetch em navegação
        gcTime: 10 * 60 * 1000, // 10 min — cache mantido em memória
        refetchOnWindowFocus: false,
        retry: 1, // 1 retry em vez de 3 (evita cascata de 500s)
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
