import { Lock, LockOpen, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Eyebrow } from "@/components/hv/primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CanonicalMultiSelect } from "@/components/cases/CanonicalMultiSelect";
import { useUpdateCaseCanonicalFields } from "@/hooks/useCases";
import { useUpdateClientCustomFields } from "@/hooks/useClients";
import { useTemaFieldDefs, type TemaFieldDef } from "@/hooks/useTemaFieldDefs";
import { FIES_FIELD_KEYS } from "@/lib/cases/fies-fields";
import { VINCULO_FIELD_KEYS } from "@/lib/cases/vinculo-fields";
import {
  isMultiOccurrence,
  occurrencesToSlots,
  readFieldValue,
} from "@/lib/cases/tema-field-value";
import { centavosFromMask, centavosToMask, maskCentavos } from "@/lib/format";

// Bloco "Dados do serviço" — campos canônicos do CASO (ex.: nº FIES).
// Distinto dos custom fields de CLIENTE. O VALOR grava sempre em
// system_cases.canonical_fields (S2-07) via updateCaseCanonicalFields (INALTERADO).
//
// R2-07: quando o caso tem `temaId`, renderiza os campos DEFINIDOS para o
// tema+frente (label/type/ordem/required), MAIS as chaves livres remanescentes
// que não têm def (para não esconder/perder valores já gravados). Sem tema,
// comportamento legado: pares chave/valor livres.

function optionsToArray(options: unknown): string[] {
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
}

// A4 — "valor preenchido?" para decidir se o campo FILHO libera. Vazio = null,
// undefined, "" ou array sem itens não-vazios (multi-ocorrência/multiselect).
function isValueFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some((v) => v !== null && v !== undefined && v !== "");
  return true; // number/boolean já preenchidos (inclui false e 0)
}

/**
 * C1 (2026-08-26) — deixa cada PAR VINCULADO junto na tela.
 *
 * "na hora que eu marco que esse aqui é vinculado no outro, lá na situação eles
 * aparecem juntinhos" (Thiago, 26/08). O vínculo é simétrico no banco; aqui basta
 * puxar o par para logo depois do primeiro dos dois que aparecer na ordem normal.
 */
function ordenarComVinculados<T extends { id: string; linked_field_def_id?: string | null }>(
  lista: T[],
): T[] {
  const porId = new Map(lista.map((d) => [d.id, d]));
  const usados = new Set<string>();
  const saida: T[] = [];
  for (const d of lista) {
    if (usados.has(d.id)) continue;
    saida.push(d);
    usados.add(d.id);
    const par = d.linked_field_def_id ? porId.get(d.linked_field_def_id) : undefined;
    if (par && !usados.has(par.id)) {
      saida.push(par);
      usados.add(par.id);
    }
  }
  return saida;
}

export function CaseCanonicalFields({
  caseId,
  canonicalFields,
  canEdit: canManage,
  temaId,
  frenteSlug,
  clientId,
  clientCustomFields,
  locked = false,
  onToggleLock,
  togglingLock = false,
}: {
  caseId: string;
  canonicalFields: Record<string, unknown> | null | undefined;
  canEdit: boolean;
  temaId?: string | null;
  frenteSlug?: string | null;
  // 2026-07-29 #3 — cliente do caso + seus custom_fields, para campos scope='cliente'.
  clientId?: string | null;
  clientCustomFields?: Record<string, unknown> | null;
  // #10 (2026-08-17) — cadeado: quando `locked`, os campos ficam só-leitura mesmo
  // com permissão. O botão (só p/ quem gere o caso) alterna via onToggleLock.
  locked?: boolean;
  onToggleLock?: () => void;
  togglingLock?: boolean;
}) {
  // Edição efetiva = permissão E não bloqueado.
  const canEdit = canManage && !locked;
  const updateMut = useUpdateCaseCanonicalFields();
  const updateClientMut = useUpdateClientCustomFields();
  // R2-07 — defs do tema+frente (só quando o caso tem tema).
  const { data: defsData } = useTemaFieldDefs(temaId ?? null, frenteSlug ?? null);
  const defs = (defsData as TemaFieldDef[] | undefined) ?? [];

  // Campos FIES (R5-06) e de VÍNCULO (R1-05) têm UI estruturada própria
  // (FiesFields / VinculoFields) e gravam no mesmo canonical_fields; filtra-os
  // aqui para não duplicar a edição.
  const structuredKeys = new Set<string>([
    ...(FIES_FIELD_KEYS as readonly string[]),
    ...(VINCULO_FIELD_KEYS as readonly string[]),
  ]);
  const defKeys = new Set(defs.map((d) => d.key));

  const cf = canonicalFields ?? {};
  // Chaves LIVRES remanescentes = tudo que não é estruturado (FIES/vínculo) e não
  // tem def. Mantidas visíveis/editáveis no modo chave/valor para NUNCA perder
  // valores já gravados.
  const freeEntries = Object.entries(cf).filter(([k]) => !structuredKeys.has(k) && !defKeys.has(k));

  const clientCf = clientCustomFields ?? {};

  async function saveKey(key: string, value: string | number | boolean | string[] | null) {
    try {
      await updateMut.mutateAsync({ id: caseId, patch: { [key]: value } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  // 2026-07-29 #3 — grava na FONTE certa: campo do caso → canonical_fields;
  // campo do cliente → custom_fields do cliente (compartilhado entre os casos).
  async function saveDef(def: TemaFieldDef, value: string | number | boolean | string[] | null) {
    try {
      if (def.scope === "cliente") {
        if (!clientId) {
          toast.error("Caso sem cliente vinculado · não dá para salvar campo do cliente.");
          return;
        }
        await updateClientMut.mutateAsync({ id: clientId, patch: { [def.key]: value } });
      } else {
        await updateMut.mutateAsync({ id: caseId, patch: { [def.key]: value } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  }

  async function removeField(key: string) {
    if (!confirm(`Remover o campo "${key}" do serviço?`)) return;
    try {
      await updateMut.mutateAsync({ id: caseId, patch: { [key]: null } });
      toast.success("Campo removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  }

  return (
    <div className="card-hero p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Dados do caso</Eyebrow>
          <p className="text-[12px] text-muted-foreground mt-1">
            Campos do caso (ex.: nº do contrato). Distintos dos dados do cliente. Buscáveis.
          </p>
        </div>
        {/* #10 — cadeado: bloqueia os campos para só-leitura (evita preenchimento
            indevido). Só quem gere o caso pode alternar. */}
        {canManage && onToggleLock && (
          <button
            type="button"
            onClick={onToggleLock}
            disabled={togglingLock}
            title={locked ? "Desbloquear edição dos campos" : "Bloquear edição dos campos"}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
              locked
                ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold-700)]"
                : "border-[var(--border)] text-[var(--navy)] hover:border-[var(--navy)]/40"
            }`}
          >
            {locked ? <Lock size={14} /> : <LockOpen size={14} />}
            {locked ? "Bloqueado" : "Bloquear"}
          </button>
        )}
      </div>
      {locked && (
        <p className="mt-2 text-[11px] text-[var(--gold-700)]">
          Campos bloqueados para edição. Desbloqueie para alterar.
        </p>
      )}

      {/* R2-07 — campos DEFINIDOS para o tema+frente. #3: valor lido da fonte
          certa (caso × cliente). */}
      {defs.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {ordenarComVinculados(defs).map((def) => {
            // A4 — campo dependente: só edita quando o PAI está preenchido. Resolve
            // o pai na lista de defs; se o pai não existe mais (soft-delete/ausente),
            // trata como SEM dependência (filho livre). Lê o valor do pai da fonte
            // certa por scope do PAI (permite pai=cliente e filho=caso).
            const parent = def.parent_field_def_id
              ? defs.find((p) => p.id === def.parent_field_def_id)
              : undefined;
            const parentValue = parent
              ? readFieldValue(parent, {
                  canonical_fields: cf,
                  client_custom_fields: clientCf,
                })
              : undefined;
            const parentFilled = parent ? isValueFilled(parentValue) : true;
            const parentBlocked = !!parent && !parentFilled;
            return (
              <TemaFieldInput
                // key inclui o caso: os campos com estado local semeado no mount
                // (MultiOccurrenceField/MoneyField) re-montam ao trocar de caso na
                // mesma rota, evitando valor "preso" do caso anterior (QA BUG-1).
                key={`${caseId}-${def.id}`}
                def={def}
                value={(def.scope === "cliente" ? clientCf : cf)[def.key]}
                canEdit={canEdit && !parentBlocked}
                disabled={updateMut.isPending || updateClientMut.isPending}
                onSave={(v) => saveDef(def, v)}
                parentHint={parentBlocked ? (parent?.label ?? null) : null}
              />
            );
          })}
        </div>
      )}

      {/* Chaves LIVRES remanescentes (compat com valores já gravados). */}
      <div className="mt-4 space-y-2">
        {defs.length === 0 && freeEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum campo preenchido.</p>
        ) : freeEntries.length > 0 ? (
          <>
            {defs.length > 0 && (
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Outros campos
              </p>
            )}
            <ul className="space-y-1.5">
              {freeEntries.map(([key, value]) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 font-medium text-[var(--navy)]">{key}</span>
                  {canEdit ? (
                    <Input
                      defaultValue={String(value ?? "")}
                      onBlur={(e) => saveKey(key, e.target.value.trim() || null)}
                      className="flex-1"
                    />
                  ) : (
                    <span className="flex-1">{String(value ?? "·")}</span>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      title="Remover campo"
                      onClick={() => removeField(key)}
                      disabled={updateMut.isPending}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Renderiza um campo DEFINIDO conforme o tipo, gravando em canonical_fields.
// Exportado (R2-09) para reuso no pop-up de filtros pós-Word (CaseFilterFillDialog).
export function TemaFieldInput({
  def,
  value,
  canEdit,
  disabled,
  onSave,
  // A4 — quando setado, o campo PAI (com este rótulo) ainda está vazio: o filho
  // fica desabilitado (canEdit já vem false) e mostramos a dica p/ preencher o pai.
  parentHint,
}: {
  def: TemaFieldDef;
  value: unknown;
  canEdit: boolean;
  disabled: boolean;
  onSave: (value: string | number | boolean | string[] | null) => void;
  parentHint?: string | null;
}) {
  const strValue = value === null || value === undefined ? "" : String(value);

  const labelEl = (
    <Label className="flex items-center gap-1">
      {def.label}
      {def.required && <span className="text-destructive">*</span>}
      {parentHint && (
        <span className="ml-1 text-[10.5px] font-normal text-muted-foreground">
          · preencha <em>{parentHint}</em> primeiro
        </span>
      )}
    </Label>
  );

  // 2026-07-29 #6 — múltiplas ocorrências (texto/número/data): N caixinhas do
  // mesmo campo; grava um ARRAY (ex.: vários períodos de atuação).
  if (isMultiOccurrence(def)) {
    return (
      <MultiOccurrenceField
        def={def}
        value={value}
        labelEl={labelEl}
        canEdit={canEdit}
        disabled={disabled}
        onSave={onSave}
      />
    );
  }

  // R2-09 — múltipla escolha: usuário marca 1+ opções; grava array.
  if (def.type === "multiselect") {
    return (
      <div className="space-y-1">
        {labelEl}
        <CanonicalMultiSelect
          options={optionsToArray(def.options)}
          value={value}
          disabled={!canEdit || disabled}
          onChange={(arr) => onSave(arr)}
        />
      </div>
    );
  }

  // R2-09 — Sim/Não (tri-estado: Sim / Não / não definido). Grava boolean real
  // em canonical_fields (o RPC aceita string|number|boolean|null).
  if (def.type === "boolean") {
    const boolStr =
      value === true || value === "true"
        ? "true"
        : value === false || value === "false"
          ? "false"
          : "";
    return (
      <div className="space-y-1">
        {labelEl}
        <select
          value={boolStr}
          disabled={!canEdit || disabled}
          onChange={(e) => onSave(e.target.value === "" ? null : e.target.value === "true")}
          className="w-full py-2 px-3 bg-[var(--card)] border border-[var(--border)] rounded-md text-[13px] focus:border-[var(--gold)] outline-none disabled:opacity-60"
        >
          <option value="">não definido</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <div className="space-y-1">
        {labelEl}
        <Select
          value={strValue || undefined}
          disabled={!canEdit || disabled}
          onValueChange={(v) => onSave(v || null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione…" />
          </SelectTrigger>
          <SelectContent>
            {optionsToArray(def.options).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (def.type === "money") {
    return (
      <MoneyField
        strValue={strValue}
        labelEl={labelEl}
        canEdit={canEdit}
        disabled={disabled}
        onSave={onSave}
      />
    );
  }

  // #9 (2026-08-17) — tipo "link": input de URL + atalho clicável quando preenchido.
  if (def.type === "link") {
    const href = strValue
      ? /^https?:\/\//i.test(strValue)
        ? strValue
        : `https://${strValue}`
      : "";
    return (
      <div className="space-y-1">
        {labelEl}
        <Input
          type="url"
          defaultValue={strValue}
          disabled={!canEdit || disabled}
          placeholder="https://…"
          onBlur={(e) => onSave(e.target.value.trim() || null)}
        />
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[12px] text-[var(--gold-700)] underline break-all"
          >
            Abrir link ↗
          </a>
        )}
      </div>
    );
  }

  const inputType = def.type === "number" ? "number" : def.type === "date" ? "date" : "text";
  return (
    <div className="space-y-1">
      {labelEl}
      <Input
        type={inputType}
        defaultValue={strValue}
        disabled={!canEdit || disabled}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (def.type === "number") {
            onSave(raw === "" ? null : Number(raw));
          } else {
            onSave(raw || null);
          }
        }}
      />
    </div>
  );
}

// Campo monetário (R$) — guarda em CENTAVOS (inteiro), como o resto do financeiro.
function MoneyField({
  strValue,
  labelEl,
  canEdit,
  disabled,
  onSave,
}: {
  strValue: string;
  labelEl: React.ReactNode;
  canEdit: boolean;
  disabled: boolean;
  onSave: (value: string | number | null) => void;
}) {
  // Centavos-primeiro: digita só números → formata "34.445,00". Guarda centavos.
  const [mask, setMask] = useState(() => centavosToMask(strValue));
  return (
    <div className="space-y-1">
      {labelEl}
      <Input
        value={mask}
        disabled={!canEdit || disabled}
        inputMode="numeric"
        placeholder="0,00"
        onChange={(e) => setMask(maskCentavos(e.target.value))}
        onBlur={() => onSave(centavosFromMask(mask))}
      />
    </div>
  );
}

// #6 / A5 — campo multi-linha do mesmo tipo (texto/número/data). Começa com N
// linhas (initial_occurrences) — ou mais, se já houver valores gravados — e o
// usuário ADICIONA ocorrências com o botão "+" até o TETO (max_occurrences).
// Estado local dos slots; grava um ARRAY (descarta caixinhas vazias). Linha em
// branco é ignorada ao salvar. Se sobrar 1 valor só, grava como array de 1 — o
// formatador de exibição normaliza.
function MultiOccurrenceField({
  def,
  value,
  labelEl,
  canEdit,
  disabled,
  onSave,
}: {
  def: TemaFieldDef;
  value: unknown;
  labelEl: React.ReactNode;
  canEdit: boolean;
  disabled: boolean;
  onSave: (value: string[] | null) => void;
}) {
  // Teto (max_occurrences) e nº inicial de linhas (initial_occurrences), ambos
  // clampados 1..20 (limite dos CHECKs do banco). O initial nunca ultrapassa o teto.
  const max = Math.max(1, Math.min(def.max_occurrences ?? 1, 20));
  const initial = Math.max(1, Math.min(def.initial_occurrences ?? 1, max));
  // A5: semeia com o initial (não com o teto). occurrencesToSlots preenche as
  // linhas iniciais e, se houver MAIS valores gravados que o initial, expande até
  // caber todos (mas nunca acima do teto) — AC4 (valores existentes preservados).
  const existing = Array.isArray(value) ? value.filter((v) => v != null && v !== "").length : 0;
  const seed = Math.min(Math.max(initial, existing), max);
  const [slots, setSlots] = useState<string[]>(() => occurrencesToSlots(value, seed));
  const inputType = def.type === "number" ? "number" : def.type === "date" ? "date" : "text";

  function commit(next: string[]) {
    const clean = next.map((s) => s.trim()).filter(Boolean);
    onSave(clean.length ? clean : null);
  }

  // Adiciona uma linha vazia se ainda cabe (< teto). Não grava (linha vazia é
  // ignorada no commit); só amplia a UI para o usuário digitar mais uma ocorrência.
  function addRow() {
    setSlots((prev) => (prev.length >= max ? prev : [...prev, ""]));
  }

  // Remove a linha `i` e re-commita (some do array gravado).
  function removeRow(i: number) {
    setSlots((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      const safe = next.length ? next : [""];
      commit(safe);
      return safe;
    });
  }

  const canAdd = canEdit && !disabled && slots.length < max;

  return (
    <div className="space-y-1">
      {labelEl}
      <div className="space-y-1.5">
        {slots.map((slot, i) => {
          // #8 — subtítulo da linha: 'auto' = rótulo enumerado; 'custom' = texto
          // configurado; senão sem subtítulo.
          const sub =
            def.subtitle_mode === "auto"
              ? `${def.label} ${i + 1}`
              : def.subtitle_mode === "custom" && Array.isArray(def.subtitles)
                ? String(def.subtitles[i] ?? "")
                : "";
          return (
            <div key={i} className="space-y-0.5">
              {sub && <div className="text-[10.5px] text-muted-foreground">{sub}</div>}
              <div className="flex items-center gap-1.5">
                <Input
                  type={inputType}
                  value={slot}
                  disabled={!canEdit || disabled}
                  placeholder={sub || `${def.label} ${i + 1}`}
                  onChange={(e) =>
                    setSlots((prev) => prev.map((s, idx) => (idx === i ? e.target.value : s)))
                  }
                  onBlur={() => commit(slots)}
                  className="flex-1"
                />
                {/* Remover linha — só quando há mais de uma caixinha (mantém ao menos 1). */}
                {canEdit && slots.length > 1 && (
                  <button
                    type="button"
                    title="Remover linha"
                    onClick={() => removeRow(i)}
                    disabled={disabled}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-destructive disabled:opacity-40"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Botão "+" — adiciona uma ocorrência até o teto; desabilita no teto. */}
      {canEdit && (
        <button
          type="button"
          onClick={addRow}
          disabled={!canAdd}
          className="mt-1 inline-flex items-center gap-1 text-[12px] text-[var(--gold-700)] hover:underline disabled:opacity-40 disabled:no-underline"
          title={slots.length >= max ? `Máximo de ${max} linhas` : "Adicionar ocorrência"}
        >
          <Plus size={13} />
          Adicionar
        </button>
      )}
    </div>
  );
}
