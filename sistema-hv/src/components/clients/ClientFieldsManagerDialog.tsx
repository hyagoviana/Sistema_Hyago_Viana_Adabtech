import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/hv/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  useClientFieldDefs,
  useClientFieldTemaLinks,
  useCreateClientFieldDef,
  useDeleteClientFieldDef,
  useReorderClientFieldDefs,
  useSetClientFieldActive,
  useSetClientFieldTemaLinks,
  useUpdateClientFieldDef,
} from "@/hooks/useClientFields";
import { useTemas } from "@/hooks/useTemas";
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
  // B1 — o campo aparece nos casos (espelhado nos temas vinculados)?
  appears_in_cases: boolean;
  help_text: string;
  options: string[];
};

const EMPTY_DRAFT: Draft = {
  label: "",
  field_type: "text",
  required: false,
  appears_in_cases: false,
  help_text: "",
  options: [],
};

// Espelho dos campos FIXOS do cadastro (não editáveis aqui) — só para o usuário
// ver "como está o formulário" antes de acrescentar informações.
const FIXED_FIELDS: { label: string; hint: string }[] = [
  { label: "Nome completo", hint: "Obrigatório · imutável" },
  { label: "CPF / CNPJ", hint: "Obrigatório · imutável" },
  { label: "RG", hint: "Obrigatório p/ pessoa física · imutável" },
  { label: "E-mail", hint: "Obrigatório" },
  { label: "Telefone", hint: "Obrigatório" },
  { label: "CEP", hint: "Obrigatório · busca o endereço" },
  { label: "Rua / Número / Complemento", hint: "Rua e número obrigatórios" },
  { label: "UF", hint: "Obrigatório · seleção" },
  { label: "Município", hint: "Obrigatório · seleção (depende da UF)" },
  { label: "Tipo", hint: "Opcional" },
  { label: "Dados profissionais (CRM, OAB, vínculo, especialidade)", hint: "Opcionais" },
];

export function ClientFieldsManagerDialog({ open, onOpenChange }: Props) {
  const { data: defs, isLoading } = useClientFieldDefs();
  const createMut = useCreateClientFieldDef();
  const updateMut = useUpdateClientFieldDef();
  const deleteMut = useDeleteClientFieldDef();
  const reorderMut = useReorderClientFieldDefs();
  const activeMut = useSetClientFieldActive();
  const setLinksMut = useSetClientFieldTemaLinks();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [optionInput, setOptionInput] = useState("");

  // B1 — temas onde o campo (em edição) aparece. Multisseleção; persiste ao clicar.
  const { data: temas } = useTemas();
  const { data: linkedTemaIds } = useClientFieldTemaLinks(editingId);
  const [selectedTemaIds, setSelectedTemaIds] = useState<string[]>([]);

  useEffect(() => {
    // Sincroniza o estado local com os vínculos carregados do campo em edição.
    setSelectedTemaIds(linkedTemaIds ?? []);
  }, [linkedTemaIds]);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
      setOptionInput("");
      setSelectedTemaIds([]);
    }
  }, [open]);

  const busy =
    createMut.isPending ||
    updateMut.isPending ||
    deleteMut.isPending ||
    reorderMut.isPending ||
    activeMut.isPending ||
    setLinksMut.isPending;
  const needsOptions = FIELD_TYPES_WITH_OPTIONS.includes(draft.field_type);

  const startEdit = (id: string) => {
    const d = (defs ?? []).find((x) => x.id === id);
    if (!d) return;
    setEditingId(id);
    setDraft({
      label: d.label,
      field_type: d.field_type as FieldType,
      required: d.required,
      appears_in_cases: d.appears_in_cases ?? false,
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
        appears_in_cases: draft.appears_in_cases,
        help_text: draft.help_text.trim() || null,
        options: needsOptions ? draft.options : null,
      };
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, input: payload });
        // B1 — se o campo NÃO aparece nos casos, garante zero vínculos.
        if (!draft.appears_in_cases && (linkedTemaIds ?? []).length > 0) {
          await setLinksMut.mutateAsync({ clientFieldDefId: editingId, temaIds: [] });
        }
        toast.success("Campo atualizado");
        resetDraft();
      } else {
        const created = await createMut.mutateAsync(payload);
        toast.success("Campo criado");
        // B1 — se marcou "aparece nos casos", entra em edição para escolher os temas.
        if (draft.appears_in_cases && created?.id) {
          startEdit(created.id);
        } else {
          resetDraft();
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar campo");
    }
  };

  // B1 — persiste a multisseleção de temas (reconcilia defs-espelho no backend).
  const toggleTema = async (temaId: string) => {
    if (!editingId) return;
    const next = selectedTemaIds.includes(temaId)
      ? selectedTemaIds.filter((t) => t !== temaId)
      : [...selectedTemaIds, temaId];
    setSelectedTemaIds(next);
    try {
      await setLinksMut.mutateAsync({ clientFieldDefId: editingId, temaIds: next });
    } catch (err) {
      // Reverte o estado local se o backend recusar (ex.: colisão de chave).
      setSelectedTemaIds(selectedTemaIds);
      toast.error(err instanceof Error ? err.message : "Erro ao vincular tema");
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await activeMut.mutateAsync({ id, active: !current });
      toast.success(current ? "Campo ocultado do cadastro" : "Campo reexibido no cadastro");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar visibilidade");
    }
  };

  const remove = async (id: string, label: string) => {
    if (
      !confirm(
        `EXCLUIR o campo "${label}"?\n\nIsto apaga as informações desse campo de TODOS os clientes · não tem como desfazer.\n\nSe a intenção é só tirar do formulário sem perder dados, use "Ocultar".`,
      )
    ) {
      return;
    }
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Campo e seus dados foram excluídos");
      if (editingId === id) resetDraft();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[680px] overflow-y-auto flex flex-col gap-4"
      >
        <SheetHeader>
          <SheetTitle>Informações de cadastro de clientes</SheetTitle>
          <SheetDescription>
            Veja como está o formulário de cadastro e acrescente campos próprios. Os campos fixos
            não podem ser alterados; os que você cria podem ser editados, ocultados ou excluídos.
          </SheetDescription>
        </SheetHeader>

        {/* Campos fixos do formulário (referência, somente leitura) */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Formulário atual (campos fixos)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {FIXED_FIELDS.map((f) => (
              <div
                key={f.label}
                className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <Lock size={12} className="mt-1 shrink-0 text-muted-foreground" />
                <div>
                  <span className="font-medium">{f.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{f.hint}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campos adicionais criados no sistema */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Campos adicionais (criados aqui)
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
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    d.active ? "" : "opacity-60"
                  }`}
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
                  {!d.active && <Badge tone="neutral">Oculto</Badge>}
                  <button
                    type="button"
                    title={d.active ? "Ocultar do cadastro" : "Reexibir no cadastro"}
                    onClick={() => toggleActive(d.id, d.active)}
                    disabled={busy}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {d.active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    type="button"
                    title="Editar"
                    onClick={() => startEdit(d.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    title="Excluir (apaga dados de todos os clientes)"
                    onClick={() => remove(d.id, d.label)}
                    disabled={busy}
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

          {/* B1 — aparece nos casos + seletor de temas */}
          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Aparece nos casos</span>
                <span className="block text-[11px] text-muted-foreground">
                  Além do cadastro do cliente, mostra este campo (mesmo valor da pessoa) nas
                  pipelines dos temas escolhidos · e reflete em todos eles.
                </span>
              </div>
              <Switch
                checked={draft.appears_in_cases}
                onCheckedChange={(c) => setDraft((d) => ({ ...d, appears_in_cases: c }))}
              />
            </div>

            {draft.appears_in_cases &&
              (editingId ? (
                <div className="space-y-1.5 border-t pt-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Temas onde aparece
                  </label>
                  {(temas ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum tema cadastrado.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(temas ?? []).map((t) => {
                        const on = selectedTemaIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            disabled={busy}
                            onClick={() => toggleTema(t.id)}
                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                              on
                                ? "border-transparent bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/70"
                            }`}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground border-t pt-3">
                  Salve o campo para escolher em quais temas ele aparece.
                </p>
              ))}
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

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
