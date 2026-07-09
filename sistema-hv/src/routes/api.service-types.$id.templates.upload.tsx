import { createFileRoute } from "@tanstack/react-router";

import { uploadFile } from "@/lib/google/drive";
import { listTypeFolders } from "@/lib/service-type-folders-service";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { syncTemplatesFromDrive } from "@/lib/template-sync-service";

// Upload de um MODELO Word (.docx/.doc) para a pasta de uma CATEGORIA no Drive.
// Passos: valida → sobe pra pasta escolhida → sincroniza a pasta (extrai as
// variáveis <...> e registra o modelo), marcando:
//   kind='procuracao' → case_type='PROCURACAO'
//   kind='caso'       → case_type = slug do tipo (o picker filtra por pasta)
// Campos (multipart): file, kind ('caso'|'procuracao'), folderId (id do Drive).
const WORD_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

function isWord(file: File): boolean {
  if (WORD_MIMES.has(file.type)) return true;
  return /\.(docx?|DOCX?)$/.test(file.name);
}

export const Route = createFileRoute("/api/service-types/$id/templates/upload")({
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
        const kind = String(form.get("kind") ?? "");
        const folderId = String(form.get("folderId") ?? "");

        if (!(file instanceof File)) {
          return Response.json({ error: "Campo 'file' ausente ou inválido" }, { status: 400 });
        }
        if (kind !== "caso" && kind !== "procuracao") {
          return Response.json({ error: "kind inválido (caso|procuracao)" }, { status: 400 });
        }
        if (!folderId) {
          return Response.json({ error: "folderId ausente" }, { status: 400 });
        }
        if (!isWord(file)) {
          return Response.json(
            { error: "Só documentos Word (.docx/.doc) são aceitos" },
            { status: 415 },
          );
        }

        try {
          // Segurança: a pasta destino precisa estar VINCULADA a esta categoria+kind.
          const folders = await listTypeFolders(params.id, kind);
          if (!folders.some((f) => f.drive_folder_id === folderId)) {
            return Response.json(
              { error: "A pasta destino não está vinculada a esta categoria" },
              { status: 422 },
            );
          }

          // Marcador do sync: procuração usa marcador fixo; caso usa o slug do tipo.
          const sb = getSupabaseAdmin();
          const { data: st } = await sb
            .from("system_service_types")
            .select("slug")
            .eq("id", params.id)
            .single();
          const marker = kind === "procuracao" ? "PROCURACAO" : (st?.slug ?? null);

          const buffer = Buffer.from(await file.arrayBuffer());
          await uploadFile({
            parentId: folderId,
            name: file.name,
            mimeType:
              file.type ||
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            body: buffer,
          });

          // Sincroniza SÓ a pasta destino: extrai as variáveis do novo .docx e
          // registra/atualiza o modelo com source_folder_id = folderId.
          const result = await syncTemplatesFromDrive(folderId, marker);
          return Response.json({ ok: true, result }, { status: 201 });
        } catch (err) {
          const status = (err as { status?: number })?.status;
          console.error("api/service-types/$id/templates/upload:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Erro interno" },
            { status: typeof status === "number" ? status : 500 },
          );
        }
      },
    },
  },
});
