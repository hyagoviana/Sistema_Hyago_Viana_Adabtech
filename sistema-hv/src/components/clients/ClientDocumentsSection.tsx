import { Download, File as FileIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDocumentDownloadUrl,
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
} from "@/hooks/useDocuments";
import { ALLOWED_MIMES, MAX_UPLOAD_BYTES } from "@/lib/validators/file";
import type { Database } from "@/lib/supabase/types";

type Doc = Database["public"]["Tables"]["system_client_documents"]["Row"];

type Props = {
  clientId: string;
  clientHasDriveFolder: boolean;
};

const ACCEPT = Array.from(ALLOWED_MIMES).join(",");
const MAX_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

function formatBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ClientDocumentsSection({ clientId, clientHasDriveFolder }: Props) {
  const { data: docs, isLoading, isError, error } = useDocuments(clientId);
  const upload = useUploadDocument(clientId);
  const remove = useDeleteDocument(clientId);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Doc | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!clientHasDriveFolder) {
      toast.error("Cliente sem pasta no Drive — sincronize a pasta antes de subir documentos.");
      return;
    }
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync({ file });
        toast.success(`${file.name} enviado`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Falha ao enviar ${file.name}`);
      }
    }
  }

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (clientHasDriveFolder) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`card-editorial !p-6 transition-colors ${
          dragging ? "ring-2 ring-[var(--gold)] bg-[var(--gold)]/5" : ""
        } ${!clientHasDriveFolder ? "opacity-60" : ""}`}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-[var(--gold)]" />
            <div>
              <p className="text-[15px] font-semibold text-[var(--navy)]">
                Arraste arquivos aqui ou clique pra selecionar
              </p>
              <p className="text-[11.5px] text-muted-foreground">
                Até {MAX_MB}MB · PDF, DOCX, XLSX, JPG, PNG, ODT, DOC, TXT
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!clientHasDriveFolder || upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <Upload size={14} className="mr-1.5" /> Selecionar
              </>
            )}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {!clientHasDriveFolder && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>
              Esse cliente ainda não tem pasta no Drive — use o botão "Tentar de novo" acima pra
              criar antes de subir arquivos.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Lista */}
      <div className="mt-5">
        {isError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              Erro ao listar documentos: {error instanceof Error ? error.message : "desconhecido"}
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : (docs ?? []).length === 0 ? (
          <div className="text-center text-muted-foreground italic py-8 text-sm">
            Nenhum documento anexado ainda.
          </div>
        ) : (
          <ul className="space-y-2">
            {docs!.map((doc) => (
              <li key={doc.id} className="card-editorial !p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-[var(--gold)]/10 flex items-center justify-center shrink-0">
                  <FileIcon size={16} className="text-[var(--gold)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-[var(--navy)] truncate">
                    {doc.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatBytes(doc.size_bytes)} · {formatDate(doc.created_at)}
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm" title="Baixar">
                  <a href={getDocumentDownloadUrl(clientId, doc.id)} download>
                    <Download size={14} />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  title="Excluir"
                  onClick={() => setDocToDelete(doc)}
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={!!docToDelete} onOpenChange={(o) => !o && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {docToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento some da lista e o arquivo vai pra lixeira do Drive (limpa em 30 dias).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!docToDelete) return;
                try {
                  await remove.mutateAsync(docToDelete.id);
                  toast.success("Documento excluído");
                  setDocToDelete(null);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Falhou");
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
