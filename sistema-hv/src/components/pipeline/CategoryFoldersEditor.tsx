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
// Valor sentinela do dropdown de frente = "Todo o tema" (grava frente_slug NULL).
const ALL_FRENTES = "__all__";

export type FrenteOption = { slug: string; label: string };

function FolderKindSection({
  serviceTypeId,
  kind,
  title,
  description,
  frentes,
}: {
  serviceTypeId: string;
  kind: FolderKind;
  title: string;
  description: string;
  // R2-04 — quando informado, habilita vincular a pasta a uma frente específica
  // (ou "Todo o tema" = NULL). Vazio/omisso = comportamento legado (sem frente).
  frentes?: FrenteOption[];
}) {
  // undefined = ver TODAS as pastas (comuns + de todas as frentes) na gestão.
  const { data: folders, isLoading } = useTypeFolders(serviceTypeId, kind, undefined);
  const createFolder = useCreateTypeFolder();
  const upload = useUploadTypeTemplate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dest, setDest] = useState<string>(NEW);
  const [newName, setNewName] = useState("");
  // R2-04 — frente escolhida para a NOVA pasta (ALL_FRENTES = NULL/tema todo).
  const [frenteSel, setFrenteSel] = useState<string>(ALL_FRENTES);
  const hasFrentes = (frentes ?? []).length > 0;
  const frenteSlug = frenteSel === ALL_FRENTES ? null : frenteSel;

  const list = folders ?? [];
  const busy = createFolder.isPending || upload.isPending;
  // Se o destino escolhido não existe mais (ou é a 1ª carga), cai no 1º da lista.
  const effectiveDest = dest === NEW || list.some((f) => f.drive_folder_id === dest) ? dest : NEW;

  const frenteLabel = (slug: string | null) =>
    slug === null ? "Todo o tema" : ((frentes ?? []).find((f) => f.slug === slug)?.label ?? slug);

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
          frenteSlug,
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

      {/* Pastas já vinculadas — mostra a frente (ou "Todo o tema") quando aplicável */}
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
              {hasFrentes && (
                <span className="text-[10.5px] text-muted-foreground">
                  · {frenteLabel(f.frente_slug)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* R2-04 — seletor de frente da NOVA pasta (só quando o tema tem frentes) */}
      {hasFrentes && effectiveDest === NEW && (
        <div className="space-y-2">
          <Label className="text-[12px]">Vincular a</Label>
          <select
            value={frenteSel}
            onChange={(e) => setFrenteSel(e.target.value)}
            disabled={busy}
            className="w-full rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm"
          >
            <option value={ALL_FRENTES}>Todo o tema (todas as frentes)</option>
            {(frentes ?? []).map((fr) => (
              <option key={fr.slug} value={fr.slug}>
                {fr.label}
              </option>
            ))}
          </select>
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

// R2-04 — `frentes` (opcional): quando o service_type/tema tem frentes, cada
// seção permite vincular a nova pasta a uma frente específica (ou "Todo o tema").
export function CategoryFoldersEditor({
  serviceTypeId,
  frentes,
}: {
  serviceTypeId: string;
  frentes?: FrenteOption[];
}) {
  return (
    <div className="space-y-3">
      <FolderKindSection
        serviceTypeId={serviceTypeId}
        kind="caso"
        title="Documentos de caso"
        description="Modelos de documento usados nos casos desta categoria."
        frentes={frentes}
      />
      <FolderKindSection
        serviceTypeId={serviceTypeId}
        kind="procuracao"
        title="Procurações"
        description="Modelos de procuração desta categoria."
        frentes={frentes}
      />
    </div>
  );
}
