import { createFileRoute } from "@tanstack/react-router";

import { CaseDocumentServiceError, uploadCaseDocument } from "@/lib/case-documents-service";

// Upload multipart de um documento (PDF/DOC/DOCX) direto na pasta do CASO no
// Drive, registrando em system_case_documents (source='UPLOAD'). Espelha o
// padrão de upload de documentos do CLIENTE (magic-bytes anti-spoofing).
export const Route = createFileRoute("/api/cases/$id/documents/upload")({
  server: {
    handlers: {
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
        if (!(file instanceof File)) {
          return Response.json({ error: "Campo 'file' ausente ou inválido" }, { status: 400 });
        }

        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const doc = await uploadCaseDocument({
            caseId: params.id,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            buffer,
          });
          return Response.json(doc, { status: 201 });
        } catch (err) {
          if (err instanceof CaseDocumentServiceError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          console.error("api/cases/$id/documents/upload:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Erro interno" },
            { status: 500 },
          );
        }
      },
    },
  },
});
