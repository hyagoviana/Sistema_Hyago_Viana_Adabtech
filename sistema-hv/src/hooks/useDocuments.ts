import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";
import type { Database } from "@/lib/supabase/types";

type Doc = Database["public"]["Tables"]["system_client_documents"]["Row"];

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? res.statusText;
  } catch {
    return (await res.text()) || res.statusText;
  }
}

export function useDocuments(clientId: string) {
  return useQuery<Doc[]>({
    queryKey: queryKeys.documents.byClient(clientId),
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/documents`);
      if (!res.ok) throw new Error(await parseError(res));
      return res.json();
    },
    enabled: !!clientId,
  });
}

export type UploadOptions = { file: File; description?: string };

export function useUploadDocument(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, description }: UploadOptions): Promise<Doc> => {
      const form = new FormData();
      form.append("file", file);
      if (description) form.append("description", description);
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await parseError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documents.byClient(clientId) }),
  });
}

export function useDeleteDocument(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/clients/${clientId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await parseError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.documents.byClient(clientId) }),
  });
}

export function getDocumentDownloadUrl(clientId: string, docId: string): string {
  return `/api/clients/${clientId}/documents/${docId}/download`;
}
