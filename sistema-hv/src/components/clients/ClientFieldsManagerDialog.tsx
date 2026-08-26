import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
  // C1 (2026-08-26) — paridade com os campos do CASO. Mesmos nomes de lá.
  max_occurrences: number;
  initial_occurrences: number;
  subtitle_mode: "" | "auto" | "custom";
  subtitles: string[];
  parent_field_def_id: string;
  linked_field_def_id: string;
  hidden_in_list: boolean;
  hidden_in_filters: boolean;
};

const EMPTY_DRAFT: Draft = {
  label: "",
  field_type: "text",
  required: false,
  appears_in_cases: false,
  help_text: "",
  options: [],
  max_occurrences: 1,
  initial_occurrences: 1,
  subtitle_mode: "",
  subtitles: [],
  parent_field_def_id: "",
  linked_field_def_id: "",
  hidden_in_list: false,
  hidden_in_filters: false,
};

const SEM = "__sem__";

// C1 — tipos que aceitam múltiplas linhas. Escolha/Sim-Não não fazem sentido
// repetidos (é a mesma regra dos campos do caso).
const TIPOS_MULTI: FieldType[] = ["text", "number", "date", "link", "money"];

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

// Painel REUTILIZÁVEL (sem Sheet) — usado inline na tela de Campos personalizados
// e dentro do Sheet (ClientFieldsManagerDialog) pela lista de clientes. Como o
// Sheet desmonta o conteúdo ao fechar, o estado reinicia naturalmente a cada
// abertura (não precisa mais do efeito de reset por `open`).
export function ClientFieldsManagerPanel() {
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
      max_occurrences: (d as { max_occurrences?: number }).max_occurrences ?? 1,
      initial_occurrences: (d as { initial_occurrences?: number }).initial_occurrences ?? 1,
      subtitle_mode: ((d as { subtitle_mode?: string | null }).subtitle_mode ?? "") as
        | ""
        | "auto"
        | "custom",
      subtitles: Array.isArray((d as { subtitles?: unknown }).subtitles)
        ? ((d as { subtitles: unknown[] }).subtitles.filter(
            (x) => typeof x === "string",
          ) as string[])
        : [],
      parent_field_def_id: (d as { parent_field_def_id?: string | null }).parent_field_def_id ?? "",
      linked_field_def_id: (d as { linked_field_def_id?: string | null }).linked_field_def_id ?? "",
      hidden_in_list: (d as { hidden_in_list?: boolean }).hidden_in_list ?? false,
      hidden_in_filters: (d as { hidden_in_filters?: boolean }).hidden_in_filters ?? false,
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
      // C1 — só manda multi-ocorrência para tipo que a suporta; o resto é 1.
      const aceitaMulti = TIPOS_MULTI.includes(draft.field_type);
      const maxOcc = aceitaMulti ? Math.max(1, draft.max_occurrences) : 1;
      const payload = {
        label: draft.label.trim(),
        field_type: draft.field_type,
        required: draft.required,
        appears_in_cases: draft.appears_in_cases,
        help_text: draft.help_text.trim() || null,
        options: needsOptions ? draft.options : null,
        max_occurrences: maxOcc,
        initial_occurrences: Math.min(Math.max(1, draft.initial_occurrences), maxOcc),
        subtitle_mode: maxOcc > 1 && draft.subtitle_mode ? draft.subtitle_mode : null,
        subtitles: maxOcc > 1 && draft.subtitle_mode === "custom" ? draft.subtitles : [],
        parent_field_def_id: draft.parent_field_def_id || null,
        linked_field_def_id: draft.linked_field_def_id || null,
        hidden_in_list: draft.hidden_in_list,
        hidden_in_filters: draft.hidden_in_filters,
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

  // C1 (2026-08-26) — ARRASTAR para reordenar. Thiago: "se a gente pode alterar a
  // ordem de visualização dos campos… arrastar um quadradinho em cima do outro".
  // As setas continuam (teclado/acessibilidade e clique preciso).
  const [arrastando, setArrastando] = useState<string | null>(null);

  const soltarSobre = async (destinoId: string) => {
    const origemId = arrastando;
    setArrastando(null);
    if (!origemId || origemId === destinoId) return;
    const list = [...(defs ?? [])];
    const de = list.findIndex((d) => d.id === origemId);
    const para = list.findIndex((d) => d.id === destinoId);
    if (de < 0 || para < 0) return;
    const [movido] = list.splice(de, 1);
    list.splice(para, 0, movido);
    try {
      await reorderMut.mutateAsync(list.map((d) => d.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reordenar");
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
    <div className="flex flex-col gap-4">
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
                draggable={!busy}
                onDragStart={() => setArrastando(d.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => soltarSobre(d.id)}
                onDragEnd={() => setArrastando(null)}
                title="Arraste para reordenar"
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-grab active:cursor-grabbing ${
                  d.active ? "" : "opacity-60"
                } ${arrastando === d.id ? "opacity-40 border-[var(--gold)]" : ""}`}
              >
                <GripVertical size={13} className="text-muted-foreground shrink-0" />
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

        {/* ------------------------------------------------------------------
            C1 (2026-08-26) — as mesmas opções que os campos do CASO já tinham.
            Thiago: "só ajustar para ficar tão bom quanto a gente já melhorou
            aqui". Cada controle abaixo espelha um de TemaFieldDefsEditor.
        ------------------------------------------------------------------- */}
        <div className="rounded-md border border-[var(--border)] p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Comportamento do campo
          </p>

          {/* Múltiplas linhas — só para os tipos que fazem sentido repetidos. */}
          {TIPOS_MULTI.includes(draft.field_type) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Máximo de linhas</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={draft.max_occurrences}
                  onChange={(e) =>
                    setDraft((d) => {
                      const max = Math.min(Math.max(1, Number(e.target.value) || 1), 20);
                      return {
                        ...d,
                        max_occurrences: max,
                        // Começar acima do teto não existe.
                        initial_occurrences: Math.min(d.initial_occurrences, max),
                      };
                    })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  1 = campo simples. Acima disso, o usuário adiciona linhas com “+”.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Linhas de largada</label>
                <Input
                  type="number"
                  min={1}
                  max={draft.max_occurrences}
                  value={draft.initial_occurrences}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      initial_occurrences: Math.min(
                        Math.max(1, Number(e.target.value) || 1),
                        d.max_occurrences,
                      ),
                    }))
                  }
                />
              </div>
            </div>
          )}

          {/* Subtítulo por linha (só faz sentido com múltiplas linhas). */}
          {draft.max_occurrences > 1 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rótulo de cada linha</label>
              <Select
                value={draft.subtitle_mode || SEM}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    subtitle_mode: v === SEM ? "" : (v as "auto" | "custom"),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM}>Sem rótulo</SelectItem>
                  <SelectItem value="auto">Numerado (Rótulo 1, 2, 3…)</SelectItem>
                  <SelectItem value="custom">Texto próprio por linha</SelectItem>
                </SelectContent>
              </Select>
              {draft.subtitle_mode === "custom" && (
                <div className="space-y-1.5 pt-1">
                  {Array.from({ length: draft.max_occurrences }).map((_, i) => (
                    <Input
                      key={i}
                      placeholder={`Rótulo da linha ${i + 1}`}
                      value={draft.subtitles[i] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => {
                          const subs = [...d.subtitles];
                          subs[i] = e.target.value;
                          return { ...d, subtitles: subs };
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* DEPENDENTE — condiciona a edição (já existia nos campos do caso). */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Depende de</label>
              <Select
                value={draft.parent_field_def_id || SEM}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, parent_field_def_id: v === SEM ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM}>Nada (campo independente)</SelectItem>
                  {(defs ?? [])
                    .filter((d) => d.id !== editingId)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Só fica editável depois que o campo escolhido estiver preenchido.
              </p>
            </div>

            {/* VINCULADO — apenas aparece junto. É o pedido novo de 26/08. */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Vinculado a</label>
              <Select
                value={draft.linked_field_def_id || SEM}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, linked_field_def_id: v === SEM ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM}>Nada</SelectItem>
                  {(defs ?? [])
                    .filter((d) => d.id !== editingId)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Os dois aparecem sempre juntos. Não condiciona nada — é só apresentação (ex.: dois
                links lado a lado).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={draft.hidden_in_list ? "default" : "outline"}
              onClick={() => setDraft((d) => ({ ...d, hidden_in_list: !d.hidden_in_list }))}
            >
              {draft.hidden_in_list ? "Escondido na lista" : "Aparece na lista"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={draft.hidden_in_filters ? "default" : "outline"}
              onClick={() => setDraft((d) => ({ ...d, hidden_in_filters: !d.hidden_in_filters }))}
            >
              {draft.hidden_in_filters ? "Escondido nos filtros" : "Aparece nos filtros"}
            </Button>
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
                Além do cadastro do cliente, mostra este campo (mesmo valor da pessoa) nas pipelines
                dos temas escolhidos · e reflete em todos eles.
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
    </div>
  );
}

// Wrapper em Sheet (drawer) — usado pela lista de clientes (ClientRoster). Reusa
// o mesmo painel. O Sheet desmonta o conteúdo ao fechar → estado reinicia sozinho.
export function ClientFieldsManagerDialog({ open, onOpenChange }: Props) {
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
        <ClientFieldsManagerPanel />
        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
