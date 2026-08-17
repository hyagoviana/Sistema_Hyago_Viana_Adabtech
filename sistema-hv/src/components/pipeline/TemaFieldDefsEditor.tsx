// R2-07 — Editor admin dos CAMPOS PERSONALIZADOS por TEMA/FRENTE. Subseção do
// editor de tema (TemasManagerDialog). Define QUAIS campos aparecem na ficha do
// caso (o "form builder"); o VALOR por caso é gravado em canonical_fields (S2-07)
// na ficha, não aqui. Gate: renderizado só quando can(role,"config.manage")
// (herda do TemasManagerDialog). Escrita já é ADMIN server-side (handleAdmin).
//
// `frenteSlug`:
//   • null  → campos do PAINEL PADRÃO do tema (valem para todas as frentes);
//   • string → campos CONDICIONAIS de uma frente específica.

import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
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
  // A7 (2026-08-05) — só para scope='cliente': libera reusar a mesma chave do
  // balde COMPARTILHADO do cliente mesmo com rótulo diferente (mesmo dado da pessoa).
  const [allowSharedClientKey, setAllowSharedClientKey] = useState(false);
  const [hiddenInList, setHiddenInList] = useState(false);
  // A2 (2026-08-03): ocultar do painel de filtros (lista + Kanban) — independente
  // de "ocultar na lista"; o campo segue na ficha do caso.
  const [hiddenInFilters, setHiddenInFilters] = useState(false);
  const [maxOccurrences, setMaxOccurrences] = useState(1);
  // A5 (2026-08-05) — nº de LINHAS que aparecem de largada (o usuário adiciona
  // mais com "+" até maxOccurrences). Sempre <= maxOccurrences.
  const [initialOccurrences, setInitialOccurrences] = useState(1);
  // A5 5c — etapa op destino ao marcar "Sim" (só p/ boolean). "" = não move.
  const [moveToStageSlug, setMoveToStageSlug] = useState("");
  // A4 (2026-08-05) — campo dependente: checkbox + campo pai escolhido. "" = sem pai.
  const [isDependent, setIsDependent] = useState(false);
  const [parentId, setParentId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Múltiplas ocorrências só para campos de valor livre (texto/número/data).
  const suportaOcorrencias = type === "text" || type === "number" || type === "date";

  // A4 — todas as defs do tema/frente (o editor já é instanciado por frente, então
  // `defs` compartilha (tema, frente)). Base p/ a lista de PAIS elegíveis e o badge.
  const allDefs = (defs as TemaFieldDef[] | undefined) ?? [];
  const MAX_DEPTH = 3;
  const MAX_CHILDREN = 3;

  // Profundidade (nível) de um campo: raiz=1, filho=2, neto=3. Guarda contra ciclo.
  function depthOf(id: string): number {
    let depth = 1;
    const seen = new Set<string>();
    let cursor: string | null | undefined = allDefs.find((x) => x.id === id)?.parent_field_def_id;
    while (cursor) {
      if (seen.has(cursor)) break;
      seen.add(cursor);
      depth += 1;
      cursor = allDefs.find((x) => x.id === cursor)?.parent_field_def_id ?? null;
    }
    return depth;
  }

  // Conjunto de descendentes de `id` (para não deixar um campo depender do próprio filho).
  function descendantsOf(id: string): Set<string> {
    const out = new Set<string>();
    const stack = allDefs.filter((x) => x.parent_field_def_id === id).map((x) => x.id);
    while (stack.length) {
      const cur = stack.pop() as string;
      if (out.has(cur)) continue;
      out.add(cur);
      for (const c of allDefs.filter((x) => x.parent_field_def_id === cur)) stack.push(c.id);
    }
    return out;
  }

  // Pais ELEGÍVEIS para o campo em edição (ou novo): exclui a si mesmo, seus
  // descendentes, campos no 3º nível (viraria 4º) e campos que já têm 3 filhos.
  // Espelha `validateParent` no cliente (defesa em profundidade).
  const selfDescendants = editingId ? descendantsOf(editingId) : new Set<string>();
  const eligibleParents = allDefs.filter((d) => {
    if (!d.active) return false;
    if (editingId && d.id === editingId) return false;
    if (selfDescendants.has(d.id)) return false;
    if (depthOf(d.id) >= MAX_DEPTH) return false; // já no nível máx → filho estouraria
    const childCount = allDefs.filter(
      (x) => x.parent_field_def_id === d.id && x.id !== editingId,
    ).length;
    if (childCount >= MAX_CHILDREN) return false;
    return true;
  });

  // Mapa id→label p/ o badge "(depende de X)" na lista.
  const labelById = new Map(allDefs.map((d) => [d.id, d.label]));

  function resetForm() {
    setLabel("");
    setType("text");
    setOptionsList([]);
    setRequired(false);
    setScope("caso");
    setAllowSharedClientKey(false);
    setHiddenInList(false);
    setHiddenInFilters(false);
    setMaxOccurrences(1);
    setInitialOccurrences(1);
    setMoveToStageSlug("");
    setIsDependent(false);
    setParentId("");
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
  // A6 (2026-08-05) — reordena a opção uma posição p/ cima/baixo (swap no array).
  // A ordem do array `options` (JSONB) É a ordem exibida; espelha o padrão de
  // reordenação por setas de StageChecklistEditor.move. Persistência via
  // parseOptions() no salvar — sem migration/RPC extra.
  function moveOption(i: number, dir: -1 | 1) {
    setOptionsList((prev) => {
      const target = i + dir;
      if (target < 0 || target >= prev.length) return prev;
      const arr = [...prev];
      [arr[i], arr[target]] = [arr[target], arr[i]];
      return arr;
    });
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
      // A5 — linhas iniciais nunca acima do teto (CHECK do banco: initial <= max).
      const initialOcc = suportaOcorrencias
        ? Math.max(1, Math.min(initialOccurrences || 1, occ))
        : 1;
      // A5 5c — só persiste destino em campos boolean; senão null (não move).
      const moveTo = type === "boolean" ? moveToStageSlug || null : null;
      // A7 — o override só vale para scope='cliente' (balde compartilhado).
      const shareOverride = scope === "cliente" ? allowSharedClientKey : false;
      // A4 — dependência: só envia pai quando o checkbox está marcado E há pai
      // escolhido; senão null (remove/sem dependência).
      const parentDefId = isDependent ? parentId || null : null;
      if (isDependent && !parentId) {
        toast.error("Escolha o campo pai da dependência ou desmarque “Campo dependente”.");
        return;
      }
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
            initialOccurrences: initialOcc,
            moveToStageSlug: moveTo,
            parentFieldDefId: parentDefId,
            allowSharedClientKey: shareOverride,
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
          initialOccurrences: initialOcc,
          moveToStageSlug: moveTo,
          parentFieldDefId: parentDefId,
          allowSharedClientKey: shareOverride,
          ordem: (defs ?? []).length,
        });
        toast.success("Campo criado");
      }
      resetForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao salvar campo";
      // A7 — colisão no balde compartilhado do cliente: orienta o override.
      const isSharedClientConflict =
        scope === "cliente" &&
        !allowSharedClientKey &&
        /dados COMPARTILHADOS do cliente/i.test(msg);
      if (isSharedClientConflict) {
        toast.error(msg, {
          description:
            'Se for o mesmo dado da pessoa, marque "Usar o mesmo campo do cliente (liberar chave compartilhada)" e salve de novo.',
        });
      } else {
        toast.error(msg);
      }
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
    // A7 — override não é persistido; ao editar, começa desmarcado (só marcar se
    // reaparecer o conflito ao salvar).
    setAllowSharedClientKey(false);
    setHiddenInList(!!d.hidden_in_list);
    setHiddenInFilters(!!d.hidden_in_filters);
    setMaxOccurrences(d.max_occurrences && d.max_occurrences > 1 ? d.max_occurrences : 1);
    setInitialOccurrences(
      d.initial_occurrences && d.initial_occurrences >= 1 ? d.initial_occurrences : 1,
    );
    setMoveToStageSlug(d.move_to_stage_slug ?? "");
    // A4 — recarrega a dependência do campo em edição.
    setIsDependent(!!d.parent_field_def_id);
    setParentId(d.parent_field_def_id ?? "");
  }

  async function excluir(d: TemaFieldDef) {
    if (
      !window.confirm(
        `Excluir o campo "${d.label}"?\n\nOs valores já preenchidos nos casos NÃO são apagados · continuam visíveis na ficha como campo livre.`,
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
            {(() => {
              const shown = optionsList.length ? optionsList : [""];
              return shown.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  {/* A6 — setas ↑↓ para reordenar (ordem do array = ordem exibida). */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      title="Mover para cima"
                      onClick={() => moveOption(i, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground hover:text-[var(--navy)] disabled:opacity-30"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      title="Mover para baixo"
                      onClick={() => moveOption(i, 1)}
                      disabled={i === shown.length - 1}
                      className="text-muted-foreground hover:text-[var(--navy)] disabled:opacity-30"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
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
              ));
            })()}
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
              ? "Ex.: “é médico?”, nacionalidade · vale para todos os casos do cliente."
              : "Ex.: enquadramento, período · específico deste caso."}
          </p>
        </div>

        {/* #6 / A5 — máximo de linhas (teto) do MESMO campo (ex.: vários períodos). */}
        {suportaOcorrencias && (
          <div className="space-y-1">
            <Label className="text-xs">Máximo de linhas</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxOccurrences}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                const max = Number.isFinite(n) ? Math.max(1, Math.min(n, 20)) : 1;
                setMaxOccurrences(max);
                // Linhas iniciais nunca acima do teto.
                setInitialOccurrences((prev) => Math.min(prev, max));
              }}
            />
            <p className="text-[10.5px] text-muted-foreground">
              Teto de ocorrências do mesmo campo (ex.: vários períodos). O usuário adiciona linhas
              com “+” até esse limite.
            </p>
          </div>
        )}
      </div>

      {/* A5 (2026-08-05) — linhas iniciais: quantas caixinhas aparecem de largada.
          O usuário adiciona mais com o botão "+" até o "Máximo de linhas". */}
      {suportaOcorrencias && (
        <div className="space-y-1 sm:max-w-[50%]">
          <Label className="text-xs">Linhas iniciais</Label>
          <Input
            type="number"
            min={1}
            max={maxOccurrences}
            value={initialOccurrences}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setInitialOccurrences(
                Number.isFinite(n) ? Math.max(1, Math.min(n, maxOccurrences)) : 1,
              );
            }}
          />
          <p className="text-[10.5px] text-muted-foreground">
            Começa com {initialOccurrences} {initialOccurrences === 1 ? "linha" : "linhas"}; o
            usuário adiciona com “+”, até {maxOccurrences}.
          </p>
        </div>
      )}

      {/* A7 (2026-08-05) — override do balde COMPARTILHADO do cliente. Só aparece
          para scope='cliente'. O valor do cliente é compartilhado entre todos os
          casos/temas; marcar isto assume que é o MESMO dado da pessoa e libera
          reusar a mesma chave mesmo com rótulo diferente de outro tema. */}
      {scope === "cliente" && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/40 p-2">
          <label className="flex items-start gap-2 text-[13px] text-[var(--navy)]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={allowSharedClientKey}
              onChange={(e) => setAllowSharedClientKey(e.target.checked)}
            />
            <span>
              Usar o mesmo campo do cliente (liberar chave compartilhada)
              <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
                Marque só se for o MESMO dado da pessoa que já existe em outro tema. Libera reusar a
                chave no balde compartilhado do cliente mesmo com rótulo diferente.
              </span>
            </span>
          </label>
        </div>
      )}

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

      {/* A4 (2026-08-05) — CAMPO DEPENDENTE: só é editável na ficha quando o campo
          PAI estiver preenchido (ex.: Município → Período). Máx. 3 níveis e 3
          filhos por pai — a lista de pais elegíveis já respeita esses limites. */}
      <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/40 p-2 space-y-2">
        <label className="flex items-start gap-2 text-[13px] text-[var(--navy)]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={isDependent}
            onChange={(e) => {
              setIsDependent(e.target.checked);
              if (!e.target.checked) setParentId("");
            }}
          />
          <span>
            Campo dependente
            <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
              Só pode ser preenchido depois que o campo pai estiver preenchido (ex.: Município →
              Período). Máximo de 3 níveis e 3 dependentes por campo.
            </span>
          </span>
        </label>
        {isDependent && (
          <div className="space-y-1">
            <Label className="text-xs">Depende do campo</Label>
            <Select
              value={parentId || "__none__"}
              onValueChange={(v) => setParentId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha o campo pai" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Escolha o campo pai</SelectItem>
                {eligibleParents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eligibleParents.length === 0 && (
              <p className="text-[10.5px] text-muted-foreground">
                Nenhum campo elegível como pai (crie outro campo antes, ou os candidatos já estão no
                limite de níveis/dependentes).
              </p>
            )}
          </div>
        )}
      </div>

      {/* #11 (2026-08-17) — Obrigatório / Ocultar na lista / Ocultar do filtro
          viraram BOTÕES toggle (antes eram checkboxes), no mesmo padrão visual do
          bloco "Campo dependente" acima. */}
      <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/40 p-2 space-y-2">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { on: required, set: setRequired, label: "Obrigatório" },
              { on: hiddenInList, set: setHiddenInList, label: "Ocultar na lista" },
              { on: hiddenInFilters, set: setHiddenInFilters, label: "Ocultar do filtro" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={opt.on}
              onClick={() => opt.set(!opt.on)}
              className={`px-3 py-1.5 rounded-md border text-[12px] font-medium transition-colors ${
                opt.on
                  ? "bg-[var(--navy)] text-white border-[var(--navy)]"
                  : "bg-white text-[var(--navy)] border-[var(--border)] hover:border-[var(--navy)]/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10.5px] text-muted-foreground leading-snug">
          <strong>Obrigatório</strong>: precisa ser preenchido. · <strong>Ocultar na lista</strong>:
          some da coluna (continua no filtro e na ficha). · <strong>Ocultar do filtro</strong>: some
          do painel de filtros (continua na ficha).
        </p>
      </div>

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
                    {/* A4 — dependência: mostra o pai (se ainda existe/ativo). */}
                    {d.parent_field_def_id && labelById.has(d.parent_field_def_id) && (
                      <span className="text-[10px] text-[var(--gold-700)]">
                        depende de {labelById.get(d.parent_field_def_id)}
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
