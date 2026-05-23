import { createFileRoute } from "@tanstack/react-router";

import {
  DocumentServiceError,
  listClientDocuments,
  uploadClientDocument,
} from "@/lib/documents-service";

export const Route = createFileRoute("/api/clients/$id/documents/")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        try {
          const docs = await listClientDocuments(params.id);
          return Response.json(docs);
        } catch (err) {
          return errorResponse(err);
        }
      },

      POST: async ({ request, params }: { request: Request; params: { id: string } }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json(
            { error: "Body inválido: esperava multipart/form-data" },
            { status: 400 },
          );
        }

        const file = form.get("file");
        const description = form.get("description");

        if (!(file instanceof File)) {
          return Response.json({ error: "Campo 'file' ausente ou inválido" }, { status: 400 });
        }

        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const doc = await uploadClientDocument({
            clientId: params.id,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            description: typeof description === "string" ? description : null,
            buffer,
          });
          return Response.json(doc, { status: 201 });
        } catch (err) {
          return errorResponse(err);
        }
      },
    },
  },
});

function errorResponse(err: unknown): Response {
  if (err instanceof DocumentServiceError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error("api/clients/$id/documents:", err);
  return Response.json(
    { error: err instanceof Error ? err.message : "Erro interno" },
    { status: 500 },
  );
}
