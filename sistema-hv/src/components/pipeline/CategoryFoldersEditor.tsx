// Editor das PASTAS do Drive de uma categoria (tipo de serviço).
// Duas seções: Documentos de caso e Procurações. Em cada uma, o usuário vê as
// pastas já vinculadas e pode subir um modelo Word — escolhendo uma pasta
// existente OU criando uma pasta nova (caso → "07- Modelos"; procuração →
// "08- Contratos e procurações"). O upload extrai as variáveis automaticamente.

import { FolderPlus, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type FolderKind,
  useCreateTypeFolder,
  useTypeFolders,
  useUploadTypeTemplate,
} from "@/hooks/useServiceTypeFolders";

const NEW = "__new__";

function FolderKindSection({
  serviceTypeId,
  kind,
  title,
  description,
}: {
  serviceTypeId: string;
  kind: FolderKind;
  title: string;
  description: string;
}) {
  const { data: folders, isLoading } = useTypeFolders(serviceTypeId, kind);
  const createFolder = useCreateTypeFolder();
  const upload = useUploadTypeTemplate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dest, setDest] = useState<string>(NEW);
  const [newName, setNewName] = useState("");

  const list = folders ?? [];
  const busy = createFolder.isPending || upload.isPending;
  // Se o destino escolhido não existe mais (ou é a 1ª carga), cai no 1º da lista.
  const effectiveDest = dest === NEW || list.some((f) => f.drive_folder_id === dest) ? dest : NEW;

  const handleFile = async (file: File) => {
    try {
      let folderId: string;
      if (effectiveDest === NEW) {
        const nome = newName.trim();
        if (!nome) {
          toast.error("Dê um nome para a nova pasta");
          return;
        }
        const created = await createFolder.mutateAsync({ serviceTypeId, kind, name: nome });
        folderId = created.drive_folder_id;
      } else {
        folderId = effectiveDest;
      }
      await upload.mutateAsync({ serviceTypeId, kind, folderId, file });
      toast.success("Documento enviado e variáveis lidas");
      setNewName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar documento");
    }
  };

  return (
    <div className="rounded-md border border-[var(--border)] p-4 space-y-3">
      <div>
        <div className="font-medium text-[var(--navy)]">{title}</div>
        <div className="text-[12px] text-muted-foreground">{description}</div>
      </div>

      {/* Pastas já vinculadas */}
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Carregando pastas…</div>
      ) : list.length === 0 ? (
        <div className="text-xs text-muted-foreground">Nenhuma pasta vinculada ainda.</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {list.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-[12px] text-[var(--navy)]"
            >
              {f.name}
            </span>
          ))}
        </div>
      )}

      {/* Destino do upload */}
      <div className="space-y-2">
        <Label className="text-[12px]">Enviar documento para</Label>
        <select
          value={effectiveDest}
          onChange={(e) => setDest(e.target.value)}
          disabled={busy}
          className="w-full rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm"
        >
          {list.map((f) => (
            <option key={f.id} value={f.drive_folder_id}>
              {f.name}
            </option>
          ))}
          <option value={NEW}>+ Criar nova pasta…</option>
        </select>

        {effectiveDest === NEW && (
          <div className="flex items-center gap-1.5">
            <FolderPlus size={15} className="text-[var(--gold-700)] shrink-0" />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da nova pasta"
              disabled={busy}
            />
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".doc,.docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleFile(file);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || (effectiveDest === NEW && !newName.trim())}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={13} className="mr-1" />
          {busy ? "Enviando…" : "Anexar documento Word"}
        </Button>
      </div>
    </div>
  );
}

export function CategoryFoldersEditor({ serviceTypeId }: { serviceTypeId: string }) {
  return (
    <div className="space-y-3">
      <FolderKindSection
        serviceTypeId={serviceTypeId}
        kind="caso"
        title="Documentos de caso"
        description="Modelos de documento usados nos casos desta categoria."
      />
      <FolderKindSection
        serviceTypeId={serviceTypeId}
        kind="procuracao"
        title="Procurações"
        description="Modelos de procuração desta categoria."
      />
    </div>
  );
}
