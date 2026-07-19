// Admin-only — gestão de TEMAS e FRENTES (R2-06). Um TEMA agrupa FRENTES; cada
// frente vai (em R2-04/R2-03) ganhar pasta/modelos/campos e pipeline por tema.
// Gate: renderizado só quando `can(role,"config.manage")` (ver pipeline.tsx).
// Construção MANUAL (MVP): CRUD de tema + CRUD de frente do tema selecionado.

import { useEffect, useState } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryFoldersEditor } from "@/components/pipeline/CategoryFoldersEditor";
import {
  useCreateFrente,
  useCreateTema,
  useDeleteFrente,
  useDeleteTema,
  useFrentes,
  useTemas,
  useTemaServiceType,
  useUpdateFrente,
  useUpdateTema,
} from "@/hooks/useTemas";

type Tema = { id: string; name: string; slug: string; ordem: number; active: boolean };
type Frente = { id: string; label: string; slug: string; ordem: number; active: boolean };

export function TemasManagerDialog({
  open,
  onOpenChange,
  openTemaId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  // Quando setado ao abrir, abre DIRETO no editor deste tema (lápis no card).
  openTemaId?: string | null;
}) {
  const { data: temas, isLoading } = useTemas();
  const createTema = useCreateTema();
  const updateTema = useUpdateTema();
  const deleteTema = useDeleteTema();

  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<Tema | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Abre direto no editor do tema indicado (lápis no card do Pipeline).
  useEffect(() => {
    if (open && openTemaId && temas) {
      const t = (temas as Tema[]).find((x) => x.id === openTemaId);
      if (t) {
        setSelected(t);
        setRenameValue(t.name);
      }
    }
  }, [open, openTemaId, temas]);

  async function criarTema() {
    const name = newName.trim();
    if (!name) return;
    try {
      const created = (await createTema.mutateAsync({ name })) as Tema;
      toast.success("Tema criado — agora crie as frentes dele");
      setNewName("");
      if (created?.id) {
        setSelected(created);
        setRenameValue(created.name);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar tema");
    }
  }

  async function salvarNome() {
    if (!selected) return;
    const name = renameValue.trim();
    if (!name || name === selected.name) return;
    try {
      await updateTema.mutateAsync({ id: selected.id, patch: { name } });
      toast.success("Nome do tema atualizado");
      setSelected({ ...selected, name });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao renomear");
    }
  }

  // Fecha o editor. Se o editor foi aberto DIRETO pelo lápis do card (openTemaId),
  // fechar o editor fecha o gerenciador inteiro (não volta para a lista de temas).
  function closeEditor() {
    setSelected(null);
    if (openTemaId) onOpenChange(false);
  }

  async function excluirTema() {
    if (!selected) return;
    if (
      !window.confirm(
        `Excluir o tema "${selected.name}"?\n\nIsto remove as frentes dele e envia a PASTA do tema no Drive para a lixeira (com as subpastas Casos/Procurações). Só é possível se não houver casos vinculados a este tema. Esta ação não pode ser desfeita.`,
      )
    )
      return;
    try {
      await deleteTema.mutateAsync(selected.id);
      toast.success("Tema excluído");
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir tema");
    }
  }

  return (
    <>
      {/* Lista de temas + criar tema. NÃO abre quando veio do lápis (openTemaId):
          nesse caso só o editor deve aparecer. */}
      <Dialog open={open && !openTemaId} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Temas</DialogTitle>
            <DialogDescription>
              Ao criar um tema, o sistema já cria a pasta dele no Drive (com as subpastas Casos e
              Procurações). Depois, no editor, vincule os casos e procurações.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Novo tema</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: Servidor Público"
                onKeyDown={(e) => e.key === "Enter" && criarTema()}
              />
            </div>
            <Button onClick={criarTema} disabled={createTema.isPending || !newName.trim()}>
              <Plus size={14} />
              {createTema.isPending ? "Criando…" : "Criar"}
            </Button>
          </div>

          <div className="mt-2 space-y-2">
            {isLoading ? (
              <div className="text-muted-foreground text-sm">Carregando temas…</div>
            ) : (temas ?? []).length === 0 ? (
              <div className="text-muted-foreground text-sm">Nenhum tema cadastrado ainda.</div>
            ) : (
              (temas as Tema[]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelected(t);
                    setRenameValue(t.name);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] p-3 text-left hover:border-[var(--gold)] transition-colors"
                >
                  <Layers size={16} className="text-[var(--gold-700)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-[var(--navy)] truncate">
                      {t.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{t.slug}</div>
                  </div>
                  <Pencil size={14} className="text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor do tema selecionado (nome + frentes) */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && closeEditor()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar tema</DialogTitle>
            <DialogDescription>
              Renomeie o tema e vincule os casos e procurações (das pastas "modelos" e "procuração")
              — ou crie novos e anexe o documento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome do tema</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && salvarNome()}
                />
                <Button
                  variant="outline"
                  onClick={salvarNome}
                  disabled={
                    updateTema.isPending ||
                    !renameValue.trim() ||
                    renameValue.trim() === selected?.name
                  }
                >
                  {updateTema.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </div>

            {selected && <FrentesEditor temaId={selected.id} />}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={excluirTema}
              disabled={deleteTema.isPending}
            >
              {deleteTema.isPending ? "Excluindo…" : "Excluir tema"}
            </Button>
            <Button variant="outline" onClick={closeEditor}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Subseção: CRUD das frentes de UM tema.
function FrentesEditor({ temaId }: { temaId: string }) {
  const { data: frentes, isLoading } = useFrentes(temaId);
  const createFrente = useCreateFrente(temaId);
  const updateFrente = useUpdateFrente(temaId);
  const deleteFrente = useDeleteFrente(temaId);
  // R2-04 — service_type interno do tema (onde as pastas por frente são vinculadas).
  const { data: temaServiceType } = useTemaServiceType(temaId);

  const [newLabel, setNewLabel] = useState("");
  const [editing, setEditing] = useState<Frente | null>(null);
  const [editValue, setEditValue] = useState("");

  async function criarFrente() {
    const label = newLabel.trim();
    if (!label) return;
    try {
      await createFrente.mutateAsync({ label });
      toast.success("Frente criada");
      setNewLabel("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar frente");
    }
  }

  async function salvarFrente() {
    if (!editing) return;
    const label = editValue.trim();
    if (!label || label === editing.label) {
      setEditing(null);
      return;
    }
    try {
      await updateFrente.mutateAsync({ id: editing.id, patch: { label } });
      toast.success("Frente atualizada");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar frente");
    }
  }

  async function excluirFrente(f: Frente) {
    if (!window.confirm(`Excluir a frente "${f.label}"? Só é possível se não houver casos nela.`))
      return;
    try {
      await deleteFrente.mutateAsync(f.id);
      toast.success("Frente excluída");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir frente");
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="mb-2 text-[13px] font-semibold text-[var(--navy)]">Frentes</div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nova frente (ex.: Aposentadoria)"
            onKeyDown={(e) => e.key === "Enter" && criarFrente()}
          />
        </div>
        <Button
          variant="outline"
          onClick={criarFrente}
          disabled={createFrente.isPending || !newLabel.trim()}
        >
          <Plus size={14} />
          {createFrente.isPending ? "Criando…" : "Adicionar"}
        </Button>
      </div>

      <div className="mt-3 space-y-1.5">
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Carregando frentes…</div>
        ) : (frentes ?? []).length === 0 ? (
          <div className="text-muted-foreground text-[13px]">Nenhuma frente ainda.</div>
        ) : (
          (frentes as Frente[]).map((f) =>
            editing?.id === f.id ? (
              <div key={f.id} className="flex items-center gap-2">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && salvarFrente()}
                  autoFocus
                />
                <Button variant="outline" size="sm" onClick={salvarFrente}>
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-[var(--navy)] truncate">{f.label}</div>
                  <div className="text-[10.5px] text-muted-foreground">{f.slug}</div>
                </div>
                <button
                  type="button"
                  title="Renomear frente"
                  onClick={() => {
                    setEditing(f);
                    setEditValue(f.label);
                  }}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-[var(--navy)]"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  title="Excluir frente"
                  onClick={() => excluirFrente(f)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ),
          )
        )}
      </div>

      {/* Casos e Procurações do tema — SEMPRE visível (não depende de ter frentes).
          Vincular pastas existentes de "modelos"/"procuração" OU criar novas +
          anexar o Word (ZapSign). Se houver frentes, dá pra direcionar a pasta a uma
          frente; sem frentes, vale para o tema todo. */}
      {temaServiceType?.id && (
        <div className="mt-3">
          <div className="mb-2 text-[13px] font-semibold text-[var(--navy)]">
            Casos e Procurações do tema
          </div>
          <CategoryFoldersEditor
            serviceTypeId={temaServiceType.id}
            frentes={(frentes as Frente[] | undefined)?.map((f) => ({
              slug: f.slug,
              label: f.label,
            }))}
          />
        </div>
      )}
    </div>
  );
}
