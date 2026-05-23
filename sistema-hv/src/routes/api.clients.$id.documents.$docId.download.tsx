import { createFileRoute } from "@tanstack/react-router";

import {
  downloadClientDocument,
  DocumentServiceError,
  nodeStreamToWeb,
} from "@/lib/documents-service";

export const Route = createFileRoute("/api/clients/$id/documents/$docId/download")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string; docId: string } }) => {
        try {
          const { doc, stream } = await downloadClientDocument({
            clientId: params.id,
            docId: params.docId,
          });

          const safeName = encodeURIComponent(doc.name);
          return new Response(nodeStreamToWeb(stream), {
            headers: {
              "Content-Type": doc.mime_type || "application/octet-stream",
              "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
              ...(doc.size_bytes ? { "Content-Length": String(doc.size_bytes) } : {}),
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": "private, no-store",
            },
          });
        } catch (err) {
          if (err instanceof DocumentServiceError) {
            return new Response(err.message, { status: err.status });
          }
          console.error("api/.../download:", err);
          return new Response("Erro interno", { status: 500 });
        }
      },
    },
  },
});
