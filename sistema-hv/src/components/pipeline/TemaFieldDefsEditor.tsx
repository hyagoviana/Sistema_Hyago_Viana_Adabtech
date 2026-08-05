// R2-07 — Editor admin dos CAMPOS PERSONALIZADOS por TEMA/FRENTE. Subseção do
// editor de tema (TemasManagerDialog). Define QUAIS campos aparecem na ficha do
// caso (o "form builder"); o VALOR por caso é gravado em canonical_fields (S2-07)
// na ficha, não aqui. Gate: renderizado só quando can(role,"config.manage")
// (herda do TemasManagerDialog). Escrita já é ADMIN server-side (handleAdmin).
//
// `frenteSlug`:
//   • null  → campos do PAINEL PADRÃO do tema (valem para todas as frentes);
//   • string → campos CONDICIONAIS de uma frente específica.

import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { useStages } from "@/hooks/usePipeline";
import {
  useCreateTemaFieldDef,
  useDeleteTemaFieldDef,
  useTemaFieldDefsAdmin,
  useUpdateTemaFieldDef,
  type TemaFieldDef,
  type TemaFieldType,
} from "@/hooks/useTemaFieldDefs";
import { useTemaServiceType } from "@/hooks/useTemas";

const TYPE_OPTIONS: { value: TemaFieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "multiselect", label: "Múltipla escolha" },
  { value: "boolean", label: "Sim / Não" },
  { value: "money", label: "Valor (R$)" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
];

// Inclui 'select' (legado — não mais oferecido na criação) para rótulo correto.
function typeLabel(t: string): string {
  if (t === "select") return "Escolha única";
  return TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

// Tipos que usam lista de opções cadastradas.
function usaOpcoes(t: string): boolean {
  return t === "select" || t === "multiselect";
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

  // A5 5c — etapas OPERACIONAIS do tema (para o "mover para etapa" do checkbox).
  const { data: temaServiceType } = useTemaServiceType(temaId);
  const { data: opStages } = useStages(temaServiceType?.id ?? "", "op");

  const [label, setLabel] = useState("");
  const [type, setType] = useState<TemaFieldType>("text");
  // Lista de opções (uma por linha na UI) para select/multiselect.
  const [optionsList, setOptionsList] = useState<string[]>([]);
  const [required, setRequired] = useState(false);
  // Reunião 2026-07-29: origem do valor (#3), ocultar só na lista (#5), nº de
  // preenchimentos do mesmo campo (#6).
  const [scope, setScope] = useState<"caso" | "cliente">("caso");
  const [hiddenInList, setHiddenInList] = useState(false);
  // A2 (2026-08-03): ocultar do painel de filtros (lista + Kanban) — independente
  // de "ocultar na lista"; o campo segue na ficha do caso.
  const [hiddenInFilters, setHiddenInFilters] = useState(false);
  const [maxOccurrences, setMaxOccurrences] = useState(1);
  // A5 5c — etapa op destino ao marcar "Sim" (só p/ boolean). "" = não move.
  const [moveToStageSlug, setMoveToStageSlug] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Múltiplas ocorrências só para campos de valor livre (texto/número/data).
  const suportaOcorrencias = type === "text" || type === "number" || type === "date";

  function resetForm() {
    setLabel("");
    setType("text");
    setOptionsList([]);
    setRequired(false);
    setScope("caso");
    setHiddenInList(false);
    setHiddenInFilters(false);
    setMaxOccurrences(1);
    setMoveToStageSlug("");
    setEditingId(null);
  }

  // Ao escolher um tipo com opções, garante ao menos uma linha em branco pra
  // digitar; ao sair, limpa a lista.
  function changeType(v: TemaFieldType) {
    setType(v);
    if (usaOpcoes(v)) setOptionsList((prev) => (prev.length ? prev : [""]));
    else setOptionsList([]);
    // A5 5c — "mover para etapa" só faz sentido em boolean; limpa ao sair dele.
    if (v !== "boolean") setMoveToStageSlug("");
  }

  function setOptionAt(i: number, val: string) {
    setOptionsList((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  }
  function addOption() {
    setOptionsList((prev) => [...prev, ""]);
  }
  function removeOption(i: number) {
    setOptionsList((prev) => prev.filter((_, idx) => idx !== i));
  }

  function parseOptions(): string[] | null {
    if (!usaOpcoes(type)) return null;
    const arr = optionsList.map((s) => s.trim()).filter(Boolean);
    return arr.length > 0 ? arr : null;
  }

  async function salvar() {
    const lbl = label.trim();
    if (!lbl) {
      toast.error("Informe o rótulo do campo");
      return;
    }
    if (usaOpcoes(type) && !parseOptions()) {
      toast.error("Campo de múltipla escolha precisa de ao menos uma opção");
      return;
    }
    try {
      const occ = suportaOcorrencias ? Math.max(1, Math.min(maxOccurrences || 1, 20)) : 1;
      // A5 5c — só persiste destino em campos boolean; senão null (não move).
      const moveTo = type === "boolean" ? moveToStageSlug || null : null;
      if (editingId) {
        await updateDef.mutateAsync({
          id: editingId,
          patch: {
            label: lbl,
            type,
            options: parseOptions(),
            required,
            scope,
            hiddenInList,
            hiddenInFilters,
            maxOccurrences: occ,
            moveToStageSlug: moveTo,
          },
        });
        toast.success("Campo atualizado");
      } else {
        await createDef.mutateAsync({
          frenteSlug,
          label: lbl,
          type,
          options: parseOptions(),
          required,
          scope,
          hiddenInList,
          hiddenInFilters,
          maxOccurrences: occ,
          moveToStageSlug: moveTo,
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
    const opts = optionsToArray(d.options);
    setOptionsList(usaOpcoes(d.type) ? (opts.length ? opts : [""]) : []);
    setRequired(!!d.required);
    setScope(d.scope === "cliente" ? "cliente" : "caso");
    setHiddenInList(!!d.hidden_in_list);
    setHiddenInFilters(!!d.hidden_in_filters);
    setMaxOccurrences(d.max_occurrences && d.max_occurrences > 1 ? d.max_occurrences : 1);
    setMoveToStageSlug(d.move_to_stage_slug ?? "");
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

  // Ocultar/mostrar (active) — não apaga; só esconde da lista/Kanban/ficha
  // (listTemaFieldDefs filtra active=true). Reversível.
  async function toggleAtivo(d: TemaFieldDef) {
    try {
      await updateDef.mutateAsync({ id: d.id, patch: { active: !d.active } });
      toast.success(d.active ? "Campo ocultado" : "Campo reexibido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao alterar visibilidade");
    }
  }

  const saving = createDef.isPending || updateDef.isPending;

  // Form de criar/editar def. Renderizado em DOIS lugares mutuamente exclusivos:
  // (a) INLINE logo abaixo do campo em edição (editingId === d.id) e
  // (b) no FIM da lista quando editingId === null (modo "adicionar novo campo").
  const formNode = (
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
          <Select value={type} onValueChange={(v) => changeType(v as TemaFieldType)}>
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

      {usaOpcoes(type) && (
        <div className="space-y-1.5">
          <Label className="text-xs">Opções</Label>
          <div className="space-y-1.5">
            {(optionsList.length ? optionsList : [""]).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) => setOptionAt(i, e.target.value)}
                  placeholder={`Opção ${i + 1}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <button
                  type="button"
                  title="Remover opção"
                  onClick={() => removeOption(i)}
                  disabled={optionsList.length <= 1}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-destructive disabled:opacity-40"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={addOption} className="mt-1">
            <Plus size={13} />
            Adicionar opção
          </Button>
          <p className="text-[10.5px] text-muted-foreground">
            O usuário poderá marcar uma ou mais dessas opções.
          </p>
        </div>
      )}

      {/* #3 — origem do valor: do CASO (por caso) ou do CLIENTE (compartilhado). */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Onde fica o valor</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as "caso" | "cliente")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="caso">Do caso (um por caso)</SelectItem>
              <SelectItem value="cliente">Do cliente (compartilhado entre os casos)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10.5px] text-muted-foreground">
            {scope === "cliente"
              ? "Ex.: “é médico?”, nacionalidade — vale para todos os casos do cliente."
              : "Ex.: enquadramento, período — específico deste caso."}
          </p>
        </div>

        {/* #6 — nº de preenchimentos do MESMO campo (ex.: vários períodos). */}
        {suportaOcorrencias && (
          <div className="space-y-1">
            <Label className="text-xs">Nº de preenchimentos</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxOccurrences}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setMaxOccurrences(Number.isFinite(n) ? Math.max(1, Math.min(n, 20)) : 1);
              }}
            />
            <p className="text-[10.5px] text-muted-foreground">
              Mais de 1 abre várias caixinhas do mesmo campo (ex.: períodos).
            </p>
          </div>
        )}
      </div>

      {/* A5 5c — CHECKBOX de auto-avanço: só p/ boolean. Ao marcar "Sim" na ficha,
          o caso é movido para a etapa OP escolhida. Vazio = não move (padrão). */}
      {type === "boolean" && (
        <div className="space-y-1">
          <Label className="text-xs">Ao marcar “Sim”, mover o caso para a etapa</Label>
          <Select
            value={moveToStageSlug || "__none__"}
            onValueChange={(v) => setMoveToStageSlug(v === "__none__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Não mover (padrão)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Não mover (padrão)</SelectItem>
              {(opStages ?? [])
                .filter((s) => s.slug !== "NAO_APLICAVEL")
                .map((s) => (
                  <SelectItem key={s.id} value={s.slug}>
                    {s.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-[10.5px] text-muted-foreground">
            Opcional. Marcar “Sim” neste caso avança o card para a etapa escolhida (só na transição
            para “Sim”; “Não” não move).
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-[13px] text-[var(--navy)]">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Obrigatório
      </label>

      {/* #5 — ocultar só na COLUNA da lista (continua no painel de busca/ficha). */}
      <label className="flex items-center gap-2 text-[13px] text-[var(--navy)]">
        <input
          type="checkbox"
          checked={hiddenInList}
          onChange={(e) => setHiddenInList(e.target.checked)}
        />
        Ocultar na lista (some da coluna; continua no filtro e na ficha)
      </label>

      {/* A2 (2026-08-03) — ocultar do PAINEL DE FILTROS (lista + Kanban);
          continua na ficha e (se não ocultado na lista) na coluna. */}
      <label className="flex items-center gap-2 text-[13px] text-[var(--navy)]">
        <input
          type="checkbox"
          checked={hiddenInFilters}
          onChange={(e) => setHiddenInFilters(e.target.checked)}
        />
        Ocultar do filtro (some do painel de filtros; continua na ficha)
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
  );

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
            <div key={d.id}>
              <div
                className={`flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 ${
                  d.active ? "" : "opacity-55"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--navy)]">
                    <span className="truncate">{d.label}</span>
                    {d.required && (
                      <span className="text-[10px] text-destructive">obrigatório</span>
                    )}
                    {d.scope === "cliente" && (
                      <span className="text-[10px] text-[var(--gold-700)]">do cliente</span>
                    )}
                    {(d.max_occurrences ?? 1) > 1 && (
                      <span className="text-[10px] text-muted-foreground">
                        até {d.max_occurrences}×
                      </span>
                    )}
                    {d.hidden_in_list && (
                      <span className="text-[10px] text-muted-foreground">(fora da lista)</span>
                    )}
                    {d.hidden_in_filters && (
                      <span className="text-[10px] text-muted-foreground">(fora do filtro)</span>
                    )}
                    {d.type === "boolean" && d.move_to_stage_slug && (
                      <span className="text-[10px] text-[var(--gold-700)]">
                        → move p/ {d.move_to_stage_slug}
                      </span>
                    )}
                    {!d.active && (
                      <span className="text-[10px] text-muted-foreground">(oculto)</span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">
                    {d.key} · {typeLabel(d.type)}
                    {usaOpcoes(d.type) && optionsToArray(d.options).length > 0
                      ? ` (${optionsToArray(d.options).join(", ")})`
                      : ""}
                  </div>
                </div>
                <button
                  type="button"
                  title={d.active ? "Ocultar de tudo" : "Reexibir"}
                  onClick={() => toggleAtivo(d)}
                  disabled={updateDef.isPending}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-[var(--navy)]"
                >
                  {d.active ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
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
              {/* AJUSTE #1 — form de edição INLINE logo abaixo do campo clicado. */}
              {editingId === d.id && formNode}
            </div>
          ))
        )}
      </div>

      {/* AJUSTE #1 — form de ADICIONAR novo campo fica no FIM (só quando não há
          nenhum campo em edição; ao editar, o form aparece inline acima). */}
      {editingId === null && formNode}
    </div>
  );
}
