import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient: QueryClient = new QueryClient({
    // AUTO-ATUALIZAÇÃO GLOBAL: após QUALQUER mutação bem-sucedida (criar/editar/
    // excluir/mover em qualquer tela), invalida todas as queries → as listas se
    // atualizam sozinhas, sem o usuário precisar dar F5. As invalidações
    // específicas nos hooks continuam valendo (esta é uma rede de segurança geral).
    mutationCache: new MutationCache({
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000, // 2 min — dados ficam "frescos" e não refetch em navegação
        gcTime: 10 * 60 * 1000, // 10 min — cache mantido em memória
        refetchOnWindowFocus: true, // volta pra aba → revalida (fica sempre atualizado)
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
