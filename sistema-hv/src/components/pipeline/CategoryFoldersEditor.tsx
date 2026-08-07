// Editor das PASTAS do Drive de uma categoria (tipo de serviço).
// Duas seções: Documentos de caso e Procurações. Em cada uma, o usuário vê as
// pastas já vinculadas e pode subir um modelo Word — escolhendo uma pasta
// existente OU criando uma pasta nova (caso → "07- Modelos"; procuração →
// "08- Contratos e procurações"). O upload extrai as variáveis automaticamente.

import { FolderPlus, Link2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type FolderKind,
  useCreateTypeFolder,
  useLinkTypeFolder,
  useRootModelFolders,
  useTypeFolders,
  useUnlinkTypeFolder,
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
  // undefined = ver TODAS as pastas do tipo. As pastas são sempre do tema todo.
  const { data: folders, isLoading } = useTypeFolders(serviceTypeId, kind, undefined);
  const createFolder = useCreateTypeFolder();
  const link = useLinkTypeFolder();
  const unlink = useUnlinkTypeFolder();
  const upload = useUploadTypeTemplate();
  // T3 — subpastas existentes no Drive (modelos/procuração) para vincular ao tema.
  const { data: driveFolders } = useRootModelFolders(kind);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dest, setDest] = useState<string>(NEW);
  const [newName, setNewName] = useState("");
  // T3 — pasta existente do Drive escolhida para vincular.
  const [linkPick, setLinkPick] = useState<string>("");

  const list = folders ?? [];
  const busy = createFolder.isPending || upload.isPending || link.isPending || unlink.isPending;
  // Pastas do Drive ainda NÃO vinculadas a este tema (evita duplicar vínculo).
  const linkedIds = new Set(list.map((f) => f.drive_folder_id));
  const available = (driveFolders ?? []).filter((d) => !linkedIds.has(d.id));

  async function handleLink() {
    const picked = (driveFolders ?? []).find((d) => d.id === linkPick);
    if (!picked) {
      toast.error("Escolha uma pasta do Drive para vincular");
      return;
    }
    try {
      await link.mutateAsync({
        serviceTypeId,
        kind,
        driveFolderId: picked.id,
        name: picked.name,
        frenteSlug: null,
      });
      toast.success(`Pasta "${picked.name}" vinculada ao tema`);
      setLinkPick("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao vincular pasta");
    }
  }

  async function handleUnlink(id: string, name: string) {
    if (
      !window.confirm(
        `Desvincular a pasta "${name}" deste tema?\n\n(A pasta NÃO é apagada no Drive.)`,
      )
    )
      return;
    try {
      await unlink.mutateAsync(id);
      toast.success("Pasta desvinculada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao desvincular");
    }
  }
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
        const created = await createFolder.mutateAsync({
          serviceTypeId,
          kind,
          name: nome,
          frenteSlug: null,
        });
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
              <button
                type="button"
                onClick={() => handleUnlink(f.id, f.name)}
                disabled={busy}
                title="Desvincular do tema (não apaga no Drive)"
                className="ml-0.5 text-muted-foreground hover:text-destructive disabled:opacity-40"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* T3 — vincular uma pasta EXISTENTE do Drive (N:N: a mesma pasta pode ir
          para vários temas). */}
      {available.length > 0 && (
        <div className="flex items-center gap-1.5">
          <select
            value={linkPick}
            onChange={(e) => setLinkPick(e.target.value)}
            disabled={busy}
            className="flex-1 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="">Vincular pasta existente do Drive…</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" disabled={busy || !linkPick} onClick={handleLink}>
            <Link2 size={13} className="mr-1" />
            Vincular
          </Button>
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
        title="Casos"
        description="Modelos de documento usados nos casos deste tema (pasta Casos)."
      />
      <FolderKindSection
        serviceTypeId={serviceTypeId}
        kind="procuracao"
        title="Procurações"
        description="Documentos de assinatura (procuração/contrato → ZapSign) · pasta Procurações."
      />
    </div>
  );
}
