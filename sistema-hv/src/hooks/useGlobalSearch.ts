import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { globalSearchFn } from "@/rpc/search";

// Busca global da topbar com debounce. Só dispara com termo >= 2 chars.
export function useGlobalSearch(term: string) {
  const fn = useServerFn(globalSearchFn);
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(id);
  }, [term]);

  const enabled = debounced.trim().length >= 2;
  return useQuery({
    queryKey: ["global-search", debounced.trim()],
    queryFn: () => fn({ data: { term: debounced } }),
    enabled,
    staleTime: 30 * 1000,
  });
}
