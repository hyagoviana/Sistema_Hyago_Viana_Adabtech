import { createFileRoute } from "@tanstack/react-router";

import { deleteClientDocument, DocumentServiceError } from "@/lib/documents-service";

export const Route = createFileRoute("/api/clients/$id/documents/$docId")({
  server: {
    handlers: {
      DELETE: async ({ params }: { params: { id: string; docId: string } }) => {
        try {
          const result = await deleteClientDocument({
            clientId: params.id,
            docId: params.docId,
          });
          return Response.json(result);
        } catch (err) {
          if (err instanceof DocumentServiceError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("api/clients/$id/documents/$docId DELETE:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Erro interno" },
            { status: 500 },
          );
        }
      },
    },
  },
});
