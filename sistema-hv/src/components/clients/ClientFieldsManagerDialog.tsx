import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/hv/primitives";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useClientFieldDefs,
  useCreateClientFieldDef,
  useDeleteClientFieldDef,
  useReorderClientFieldDefs,
  useUpdateClientFieldDef,
} from "@/hooks/useClientFields";
import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  FIELD_TYPES_WITH_OPTIONS,
  type FieldType,
} from "@/lib/validators/clientFields";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Draft = {
  label: string;
  field_type: FieldType;
  required: boolean;
  help_text: string;
  options: string[];
};

const EMPTY_DRAFT: Draft = {
  label: "",
  field_type: "text",
  required: false,
  help_text: "",
  options: [],
};

export function ClientFieldsManagerDialog({ open, onOpenChange }: Props) {
  const { data: defs, isLoading } = useClientFieldDefs();
  const createMut = useCreateClientFieldDef();
  const updateMut = useUpdateClientFieldDef();
  const deleteMut = useDeleteClientFieldDef();
  const reorderMut = useReorderClientFieldDefs();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [optionInput, setOptionInput] = useState("");

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
      setOptionInput("");
    }
  }, [open]);

  const busy =
    createMut.isPending || updateMut.isPending || deleteMut.isPending || reorderMut.isPending;
  const needsOptions = FIELD_TYPES_WITH_OPTIONS.includes(draft.field_type);

  const startEdit = (id: string) => {
    const d = (defs ?? []).find((x) => x.id === id);
    if (!d) return;
    setEditingId(id);
    setDraft({
      label: d.label,
      field_type: d.field_type as FieldType,
      required: d.required,
      help_text: d.help_text ?? "",
      options: Array.isArray(d.options)
        ? (d.options.filter((o) => typeof o === "string") as string[])
        : [],
    });
    setOptionInput("");
  };

  const resetDraft = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setOptionInput("");
  };

  const addOption = () => {
    const v = optionInput.trim();
    if (!v) return;
    if (draft.options.includes(v)) {
      toast.error("Opção já adicionada");
      return;
    }
    setDraft((d) => ({ ...d, options: [...d.options, v] }));
    setOptionInput("");
  };

  const removeOption = (opt: string) =>
    setDraft((d) => ({ ...d, options: d.options.filter((o) => o !== opt) }));

  const save = async () => {
    if (!draft.label.trim()) {
      toast.error("Informe o nome do campo");
      return;
    }
    if (needsOptions && draft.options.length < 1) {
      toast.error("Adicione ao menos uma opção");
      return;
    }
    try {
      const payload = {
        label: draft.label.trim(),
        field_type: draft.field_type,
        required: draft.required,
        help_text: draft.help_text.trim() || null,
        options: needsOptions ? draft.options : null,
      };
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, input: payload });
        toast.success("Campo atualizado");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Campo criado");
      }
      resetDraft();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar campo");
    }
  };

  const remove = async (id: string, label: string) => {
    if (
      !confirm(
        `Remover o campo "${label}"? Os valores já cadastrados nos clientes são mantidos, mas o campo deixa de aparecer.`,
      )
    ) {
      return;
    }
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Campo removido");
      if (editingId === id) resetDraft();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const list = [...(defs ?? [])];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    try {
      await reorderMut.mutateAsync(list.map((d) => d.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reordenar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informações de cadastro de clientes</DialogTitle>
          <DialogDescription>
            Crie campos adicionais para o cadastro do cliente. Eles servem para enriquecer o
            cadastro e pesquisar. Os campos fixos do formulário não são afetados.
          </DialogDescription>
        </DialogHeader>

        {/* Lista de campos existentes */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Campos atuais
          </p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (defs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum campo adicional ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {(defs ?? []).map((d, i) => (
                <li
                  key={d.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || busy}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === (defs ?? []).length - 1 || busy}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{d.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {FIELD_TYPE_LABELS[d.field_type as FieldType] ?? d.field_type}
                    </span>
                  </div>
                  {d.required && <Badge tone="navy">Obrigatório</Badge>}
                  <button
                    type="button"
                    onClick={() => startEdit(d.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(d.id, d.label)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor de campo (novo / edição) */}
        <div className="border-t pt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {editingId ? "Editar campo" : "Novo campo"}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome do campo *</label>
              <Input
                placeholder="Ex.: Profissão, Indicado por…"
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo</label>
              <Select
                value={draft.field_type}
                onValueChange={(v) => setDraft((d) => ({ ...d, field_type: v as FieldType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {FIELD_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {needsOptions && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Opções *</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite uma opção e clique em adicionar"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addOption}>
                  <Plus size={14} />
                </Button>
              </div>
              {draft.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {draft.options.map((opt) => (
                    <span
                      key={opt}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                    >
                      {opt}
                      <button type="button" onClick={() => removeOption(opt)}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Texto de ajuda (opcional)</label>
            <Input
              placeholder="Dica exibida abaixo do campo"
              value={draft.help_text}
              onChange={(e) => setDraft((d) => ({ ...d, help_text: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm font-medium">Campo obrigatório</span>
            <Switch
              checked={draft.required}
              onCheckedChange={(c) => setDraft((d) => ({ ...d, required: c }))}
            />
          </div>

          <div className="flex gap-2">
            {editingId && (
              <Button type="button" variant="ghost" onClick={resetDraft} disabled={busy}>
                Cancelar edição
              </Button>
            )}
            <Button type="button" onClick={save} disabled={busy} className="ml-auto">
              {editingId ? "Salvar alterações" : "Adicionar campo"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
