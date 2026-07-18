// R2-07 — Editor admin dos CAMPOS PERSONALIZADOS por TEMA/FRENTE. Subseção do
// editor de tema (TemasManagerDialog). Define QUAIS campos aparecem na ficha do
// caso (o "form builder"); o VALOR por caso é gravado em canonical_fields (S2-07)
// na ficha, não aqui. Gate: renderizado só quando can(role,"config.manage")
// (herda do TemasManagerDialog). Escrita já é ADMIN server-side (handleAdmin).
//
// `frenteSlug`:
//   • null  → campos do PAINEL PADRÃO do tema (valem para todas as frentes);
//   • string → campos CONDICIONAIS de uma frente específica.

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateTemaFieldDef,
  useDeleteTemaFieldDef,
  useTemaFieldDefsAdmin,
  useUpdateTemaFieldDef,
  type TemaFieldDef,
  type TemaFieldType,
} from "@/hooks/useTemaFieldDefs";

const TYPE_OPTIONS: { value: TemaFieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "select", label: "Escolha única" },
  { value: "money", label: "Valor (R$)" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
];

function typeLabel(t: string): string {
  return TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

function optionsToArray(options: unknown): string[] {
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
}

export function TemaFieldDefsEditor({
  temaId,
  frenteSlug,
  title,
}: {
  temaId: string;
  frenteSlug: string | null;
  title: string;
}) {
  const { data: defs, isLoading } = useTemaFieldDefsAdmin(temaId, frenteSlug);
  const createDef = useCreateTemaFieldDef(temaId);
  const updateDef = useUpdateTemaFieldDef(temaId);
  const deleteDef = useDeleteTemaFieldDef(temaId);

  const [label, setLabel] = useState("");
  const [type, setType] = useState<TemaFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [required, setRequired] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function resetForm() {
    setLabel("");
    setType("text");
    setOptionsText("");
    setRequired(false);
    setEditingId(null);
  }

  function parseOptions(): string[] | null {
    if (type !== "select") return null;
    const arr = optionsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length > 0 ? arr : null;
  }

  async function salvar() {
    const lbl = label.trim();
    if (!lbl) {
      toast.error("Informe o rótulo do campo");
      return;
    }
    if (type === "select" && !parseOptions()) {
      toast.error("Campo de escolha única precisa de ao menos uma opção");
      return;
    }
    try {
      if (editingId) {
        await updateDef.mutateAsync({
          id: editingId,
          patch: { label: lbl, type, options: parseOptions(), required },
        });
        toast.success("Campo atualizado");
      } else {
        await createDef.mutateAsync({
          frenteSlug,
          label: lbl,
          type,
          options: parseOptions(),
          required,
          ordem: (defs ?? []).length,
        });
        toast.success("Campo criado");
      }
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar campo");
    }
  }

  function startEdit(d: TemaFieldDef) {
    setEditingId(d.id);
    setLabel(d.label);
    setType(d.type as TemaFieldType);
    setOptionsText(optionsToArray(d.options).join(", "));
    setRequired(!!d.required);
  }

  async function excluir(d: TemaFieldDef) {
    if (
      !window.confirm(
        `Excluir o campo "${d.label}"?\n\nOs valores já preenchidos nos casos NÃO são apagados — continuam visíveis na ficha como campo livre.`,
      )
    )
      return;
    try {
      await deleteDef.mutateAsync(d.id);
      toast.success("Campo excluído");
      if (editingId === d.id) resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir campo");
    }
  }

  const saving = createDef.isPending || updateDef.isPending;

  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="mb-2 text-[13px] font-semibold text-[var(--navy)]">{title}</div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Carregando campos…</div>
        ) : (defs ?? []).length === 0 ? (
          <div className="text-muted-foreground text-[13px]">Nenhum campo definido ainda.</div>
        ) : (
          (defs as TemaFieldDef[]).map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13px] text-[var(--navy)]">
                  <span className="truncate">{d.label}</span>
                  {d.required && <span className="text-[10px] text-destructive">obrigatório</span>}
                </div>
                <div className="text-[10.5px] text-muted-foreground">
                  {d.key} · {typeLabel(d.type)}
                  {d.type === "select" && optionsToArray(d.options).length > 0
                    ? ` (${optionsToArray(d.options).join(", ")})`
                    : ""}
                </div>
              </div>
              <button
                type="button"
                title="Editar campo"
                onClick={() => startEdit(d)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-[var(--navy)]"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                title="Excluir campo"
                onClick={() => excluir(d)}
                disabled={deleteDef.isPending}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-destructive"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Form criar/editar def */}
      <div className="mt-3 space-y-2 border-t pt-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Rótulo do campo</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Nº do processo"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as TemaFieldType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {type === "select" && (
          <div className="space-y-1">
            <Label className="text-xs">Opções (separe por vírgula ou linha)</Label>
            <Input
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Ex.: Ativo, Inativo, Suspenso"
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-[13px] text-[var(--navy)]">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          Obrigatório
        </label>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={salvar} disabled={saving || !label.trim()}>
            <Plus size={14} />
            {editingId
              ? saving
                ? "Salvando…"
                : "Salvar campo"
              : saving
                ? "Criando…"
                : "Adicionar campo"}
          </Button>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
