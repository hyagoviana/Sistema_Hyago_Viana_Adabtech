// Server-only — CRUD das DEFINIÇÕES de campo personalizado por TEMA/FRENTE
// (R2-07, camada B2 do épico R2). Estrutura GENÉRICA: define QUAIS campos
// aparecem na ficha do caso por tema (frente NULL = painel padrão) e por frente
// (frente_slug setado = condicional). O VALOR por caso continua em
// system_cases.canonical_fields (S2-07) — este serviço NÃO grava valor, só defs.
// Escreve em system_tema_field_defs (criada em R2-07, migration 20260719000006).
// NUNCA importe este arquivo em código que roda no browser (usa service_role).
//
// Molde: tema-service.ts (CRUD + slug), client-field-defs (defs + key/label/type).
// NÃO migra os campos FIES (R5-06 / fies-fields.ts) para cá — só a estrutura
// genérica. FiesFields continua funcionando por conta própria.

import slugify from "slugify";

import { getSupabaseAdmin } from "./supabase/server";
import type { Database } from "./supabase/types";

type FieldDefRow = Database["public"]["Tables"]["system_tema_field_defs"]["Row"];
type FieldDefUpdate = Database["public"]["Tables"]["system_tema_field_defs"]["Update"];

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export const TEMA_FIELD_TYPES = [
  "text",
  "select",
  "multiselect",
  "money",
  "number",
  "date",
  "boolean",
] as const;
export type TemaFieldType = (typeof TEMA_FIELD_TYPES)[number];

export class TemaFieldDefServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TemaFieldDefServiceError";
  }
}

// Slug canônico da chave (minúsculo, a-z0-9_) — chave estável no JSONB
// canonical_fields. Derivado do label quando não informado. Evita colisão com o
// domínio fechado FIES (fies_*) prefixando com "campo_" se necessário não é
// preciso — a UNIQUE é por tema/frente; o operador escolhe a chave.
function toKey(s: string): string {
  return (
    slugify(s, { strict: true, locale: "pt" })
      .toLowerCase()
      .replace(/-/g, "_")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "campo"
  );
}

// Normaliza `options` (para type='select'/'multiselect'): aceita array de
// strings; descarta vazios; retorna null se não usar opções ou lista vazia.
function normalizeOptions(type: string, options: unknown): string[] | null {
  if (type !== "select" && type !== "multiselect") return null;
  if (!Array.isArray(options)) return null;
  const clean = options
    .map((o) => (typeof o === "string" ? o.trim() : ""))
    .filter((o) => o.length > 0);
  return clean.length > 0 ? clean : null;
}

// Lê as defs aplicáveis a um caso: as do TEMA (frente NULL, painel padrão) MAIS
// as da FRENTE do caso (quando houver frenteSlug). Ordena por (frente NULL antes)
// e `ordem`. Retorna [] se o tema não tem defs. NÃO usa RLS (service_role); o
// gate de leitura é apenas requireAuth (defs não são sensíveis).
export async function listTemaFieldDefs(
  temaId: string,
  frenteSlug?: string | null,
): Promise<FieldDefRow[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("system_tema_field_defs_active")
    .select("*")
    .eq("tema_id", temaId)
    .eq("active", true);
  // Def padrão do tema (frente NULL) sempre; def da frente do caso quando houver.
  q = frenteSlug
    ? q.or(`frente_slug.is.null,frente_slug.eq.${frenteSlug}`)
    : q.is("frente_slug", null);
  const { data, error } = await q.order("ordem", { ascending: true });
  if (error) throw new TemaFieldDefServiceError(error.message, 500);
  // Ordena padrão-do-tema (NULL) antes das condicionais da frente, depois por ordem.
  return (data ?? []).slice().sort((a, b) => {
    const af = a.frente_slug ? 1 : 0;
    const bf = b.frente_slug ? 1 : 0;
    if (af !== bf) return af - bf;
    return (a.ordem ?? 0) - (b.ordem ?? 0);
  });
}

// Lista TODAS as defs de um tema para a UI admin (padrão do tema + de cada
// frente). `frenteSlug === undefined` = todas; `null` = só padrão do tema;
// string = só daquela frente.
export async function listTemaFieldDefsAdmin(
  temaId: string,
  frenteSlug?: string | null,
): Promise<FieldDefRow[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("system_tema_field_defs_active").select("*").eq("tema_id", temaId);
  if (frenteSlug === null) q = q.is("frente_slug", null);
  else if (typeof frenteSlug === "string") q = q.eq("frente_slug", frenteSlug);
  const { data, error } = await q.order("ordem", { ascending: true });
  if (error) throw new TemaFieldDefServiceError(error.message, 500);
  return data ?? [];
}

// A5 5c — auto-avanço: só campos `boolean` podem ter destino de etapa. Para os
// demais tipos a coluna fica NULL. String vazia/whitespace → NULL (não move).
function normalizeMoveToStage(type: string, v: unknown): string | null {
  if (type !== "boolean") return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

// Nº de ocorrências (#6) — normaliza para inteiro em [1, 20] (limite do CHECK).
function normalizeMaxOccurrences(v: unknown): number {
  const n = typeof v === "number" ? Math.floor(v) : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 20);
}

// A5 (2026-08-05) — nº de LINHAS INICIAIS mostradas de largada. Normaliza para
// inteiro em [1, 20] e clampa em <= teto (max_occurrences) — o CHECK do banco
// (initial_occurrences <= max_occurrences) rejeitaria um initial acima do teto.
function normalizeInitialOccurrences(v: unknown, max: number): number {
  const n = typeof v === "number" ? Math.floor(v) : 1;
  const base = !Number.isFinite(n) || n < 1 ? 1 : Math.min(n, 20);
  return Math.min(base, max);
}

// Colisão de chave no BALDE do cliente (system_clients.custom_fields), para
// campos scope='cliente'. Esse balde é COMPARTILHADO com os campos de cliente
// (system_client_field_defs) e com scope='cliente' de OUTROS temas. Compartilhar
// é INTENCIONAL quando é o mesmo dado da pessoa (ex.: "Nacionalidade" em dois
// temas → mesmo valor) — por isso só é conflito quando a MESMA key pertence a um
// campo de SIGNIFICADO diferente (rótulo normalizado distinto). Retorna o rótulo
// conflitante ou null (sem conflito / reuso legítimo do mesmo conceito).
async function findClientBucketKeyConflict(
  sb: ReturnType<typeof getSupabaseAdmin>,
  key: string,
  label: string,
  excludeTemaFieldId: string | null,
): Promise<string | null> {
  const norm = (s: string) => s.trim().toLowerCase();
  const target = norm(label);

  // (a) Campo de CLIENTE (system_client_field_defs) com a mesma key.
  const { data: cli } = await sb
    .from("system_client_field_defs_active")
    .select("label")
    .eq("organization_id", DEFAULT_ORG)
    .eq("key", key)
    .maybeSingle();
  if (cli && norm(cli.label as string) !== target) return cli.label as string;

  // (b) scope='cliente' de outro campo de tema com a mesma key.
  const { data: temas } = await sb
    .from("system_tema_field_defs_active")
    .select("id, label")
    .eq("scope", "cliente")
    .eq("key", key);
  for (const t of temas ?? []) {
    if (excludeTemaFieldId && t.id === excludeTemaFieldId) continue;
    if (norm(t.label as string) !== target) return t.label as string;
  }
  return null;
}

// A4 (2026-08-05) — máximos da hierarquia de campos dependentes (pai→filho).
const MAX_DEPTH = 3; // raiz(1) → filho(2) → neto(3). 4º nível recusado.
const MAX_CHILDREN = 3; // até 3 filhos por pai; o 4º é recusado.

// Só o que a validação de hierarquia precisa de cada def (defs ativas do
// tema/frente). Espelha as colunas relevantes da view _active.
type ParentGraphRow = {
  id: string;
  frente_slug: string | null;
  parent_field_def_id: string | null;
};

// A4 — valida a ligação pai→filho ANTES de gravar. Regras (todas 422):
//  (a) o pai existe, está ativo e pertence ao MESMO tema E mesma frente/painel;
//  (b) não é auto-referência (pai = o próprio campo);
//  (c) não cria CICLO (o pai não pode ser descendente do próprio campo);
//  (d) profundidade final ≤ MAX_DEPTH (contando os descendentes do filho);
//  (e) o pai não pode já ter MAX_CHILDREN filhos ativos.
// `selfId` é null no create (campo ainda não existe). Carrega as defs ativas do
// tema (todas as frentes) e filtra pela cadeia — barato (poucas defs por tema).
async function validateParent(
  sb: ReturnType<typeof getSupabaseAdmin>,
  args: { temaId: string; frenteSlug: string | null; selfId: string | null; parentId: string },
): Promise<void> {
  const { temaId, frenteSlug, selfId, parentId } = args;

  if (selfId && parentId === selfId) {
    throw new TemaFieldDefServiceError("Um campo não pode depender de si mesmo.", 422);
  }

  const { data, error } = await sb
    .from("system_tema_field_defs_active")
    .select("id, frente_slug, parent_field_def_id")
    .eq("tema_id", temaId);
  if (error) throw new TemaFieldDefServiceError(error.message, 500);
  const rows = (data ?? []) as ParentGraphRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const parent = byId.get(parentId);
  if (!parent) {
    throw new TemaFieldDefServiceError(
      "Campo pai não encontrado neste tema (ou foi excluído).",
      422,
    );
  }
  // (a) mesma frente/painel — normaliza NULL/"" para comparar painel padrão × frente.
  const norm = (s: string | null) => s ?? "";
  if (norm(parent.frente_slug) !== norm(frenteSlug)) {
    throw new TemaFieldDefServiceError(
      "O campo pai precisa estar no mesmo painel/frente que o campo dependente.",
      422,
    );
  }

  // (c) sem ciclo: subindo a cadeia de pais a partir do pai escolhido, não posso
  // reencontrar o próprio campo. Também detecta ciclos pré-existentes (guarda).
  const ancestors: string[] = [];
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (selfId && cursor === selfId) {
      throw new TemaFieldDefServiceError(
        "Dependência inválida: criaria um ciclo (o pai já depende deste campo).",
        422,
      );
    }
    if (seen.has(cursor)) break; // ciclo pré-existente — para de subir.
    seen.add(cursor);
    ancestors.push(cursor);
    const node: ParentGraphRow | undefined = byId.get(cursor);
    cursor = node?.parent_field_def_id ?? null;
  }

  // (d) profundidade. Nível do pai = nº de ancestrais dele + 1 (ele próprio).
  // O filho fica um nível abaixo. Somado à sub-árvore que já pende do filho
  // (quando editando um campo que já tem netos), não pode passar de MAX_DEPTH.
  const parentDepth = ancestors.length; // inclui o próprio pai
  const childDepth = parentDepth + 1;
  if (childDepth > MAX_DEPTH) {
    throw new TemaFieldDefServiceError(
      `Limite de ${MAX_DEPTH} níveis de dependência. Este campo pai já está no nível máximo.`,
      422,
    );
  }
  // Altura da sub-árvore pendurada no próprio campo (só no update): se o campo já
  // tem filhos/netos, mover ele para baixo de `parent` empurraria os descendentes.
  if (selfId) {
    const childrenOf = new Map<string, string[]>();
    for (const r of rows) {
      if (r.parent_field_def_id) {
        const arr = childrenOf.get(r.parent_field_def_id) ?? [];
        arr.push(r.id);
        childrenOf.set(r.parent_field_def_id, arr);
      }
    }
    const heightBelow = (id: string, guard: Set<string>): number => {
      if (guard.has(id)) return 0;
      guard.add(id);
      const kids = childrenOf.get(id) ?? [];
      let h = 0;
      for (const k of kids) h = Math.max(h, 1 + heightBelow(k, guard));
      return h;
    };
    const subtreeHeight = heightBelow(selfId, new Set<string>());
    if (childDepth + subtreeHeight > MAX_DEPTH) {
      throw new TemaFieldDefServiceError(
        `Limite de ${MAX_DEPTH} níveis de dependência: este campo já tem descendentes que ultrapassariam o limite sob esse pai.`,
        422,
      );
    }
  }

  // (e) até MAX_CHILDREN filhos ativos por pai (não conta o próprio campo, que
  // pode já ser filho desse pai num update — reatribuir não incrementa).
  const currentChildren = rows.filter(
    (r) => r.parent_field_def_id === parentId && r.id !== selfId,
  ).length;
  if (currentChildren >= MAX_CHILDREN) {
    throw new TemaFieldDefServiceError(
      `O campo pai já tem ${MAX_CHILDREN} campos dependentes (máximo).`,
      422,
    );
  }
}

export async function createTemaFieldDef(input: {
  temaId: string;
  frenteSlug?: string | null;
  key?: string;
  label: string;
  type: string;
  options?: unknown;
  ordem?: number;
  required?: boolean;
  scope?: string;
  hiddenInList?: boolean;
  hiddenInFilters?: boolean;
  maxOccurrences?: number;
  // A5 (2026-08-05) — nº de linhas mostradas de largada (<= teto). Só p/ text/number/date.
  initialOccurrences?: number;
  moveToStageSlug?: string | null;
  // A4 (2026-08-05) — campo PAI de quem este depende (mesmo tema/frente). null =
  // sem dependência. Validado (existência/mesma frente/ciclo/profundidade/filhos).
  parentFieldDefId?: string | null;
  // A7 (2026-08-05) — override do bloqueio do balde COMPARTILHADO do cliente.
  // Só afeta scope='cliente': quando true, o admin assume conscientemente que é o
  // MESMO dado da pessoa e libera reusar a mesma key mesmo com rótulo diferente.
  // Não afeta a unicidade POR TEMA (índice/pré-check) nem scope='caso'.
  allowSharedClientKey?: boolean;
  // B1 (2026-08-05) — usa a `key` fornecida VERBATIM (sem re-slugar via toKey).
  // Necessário para a def-ESPELHO de campo do cliente: ela precisa casar EXATAMENTE
  // a key do system_client_field_defs (que preserva underscores) — do contrário o
  // balde compartilhado do cliente não é o mesmo e o dado não reflete.
  rawKey?: boolean;
}): Promise<FieldDefRow> {
  const label = input.label.trim();
  if (!label) throw new TemaFieldDefServiceError("Rótulo do campo é obrigatório", 422);
  if (!TEMA_FIELD_TYPES.includes(input.type as TemaFieldType)) {
    throw new TemaFieldDefServiceError("Tipo de campo inválido", 422);
  }
  const scope = input.scope === "cliente" ? "cliente" : "caso";
  // Múltiplas ocorrências só faz sentido em campos de valor livre (texto/nº/data);
  // select/multiselect/boolean/money são 1 (o multiselect já é lista por natureza).
  const supportsMulti = input.type === "text" || input.type === "number" || input.type === "date";
  const maxOccurrences = supportsMulti ? normalizeMaxOccurrences(input.maxOccurrences) : 1;
  // A5 — linhas iniciais só p/ campos de valor livre; sempre <= teto.
  const initialOccurrences = supportsMulti
    ? normalizeInitialOccurrences(input.initialOccurrences, maxOccurrences)
    : 1;
  // B1 — `rawKey` usa a key fornecida sem re-slugar (casamento exato com o campo
  // do cliente). Caso contrário, deriva a key via toKey (comportamento padrão).
  const key =
    (input.rawKey && input.key?.trim()
      ? input.key.trim()
      : input.key?.trim()
        ? toKey(input.key)
        : toKey(label)) || "campo";
  const frenteSlug = input.frenteSlug?.trim() ? input.frenteSlug.trim() : null;

  const sb = getSupabaseAdmin();

  // O tema precisa existir (e estar ativo).
  const { data: tema } = await sb
    .from("system_temas_active")
    .select("id")
    .eq("id", input.temaId)
    .maybeSingle();
  if (!tema) throw new TemaFieldDefServiceError("Tema não encontrado", 404);

  // Idempotência de key: UNIQUE(tema_id, COALESCE(frente_slug,''), key) entre
  // ativos — recusa duplicado com 409 legível em vez de estourar 500 do banco.
  const dup = sb
    .from("system_tema_field_defs_active")
    .select("id")
    .eq("tema_id", input.temaId)
    .eq("key", key);
  const { data: existing } = await (
    frenteSlug ? dup.eq("frente_slug", frenteSlug) : dup.is("frente_slug", null)
  ).maybeSingle();
  if (existing) {
    throw new TemaFieldDefServiceError(
      "Já existe um campo com essa chave neste tema/frente. " +
        "A unicidade é por tema/frente — a mesma chave pode ser usada em outros temas.",
      409,
    );
  }

  // scope='cliente': recusa colisão com campo de SIGNIFICADO diferente no balde
  // COMPARTILHADO do cliente (evita sobrescrever silenciosamente valores de outro
  // campo). NÃO roda para scope='caso' (esse é único só por tema/frente) e é
  // ignorado quando o admin marca o override `allowSharedClientKey`.
  if (scope === "cliente" && !input.allowSharedClientKey) {
    const conflict = await findClientBucketKeyConflict(sb, key, label, null);
    if (conflict) {
      throw new TemaFieldDefServiceError(
        `A chave "${key}" já é usada pelo campo "${conflict}" nos dados COMPARTILHADOS do cliente ` +
          `(vale para todos os casos/temas do cliente). Renomeie este campo, use exatamente o mesmo ` +
          `rótulo se for o mesmo dado da pessoa, ou marque "liberar chave compartilhada" para usar mesmo assim.`,
        409,
      );
    }
  }

  // A4 — dependência pai→filho (opcional). Valida hierarquia (422) antes de gravar.
  const parentFieldDefId = input.parentFieldDefId ?? null;
  if (parentFieldDefId) {
    await validateParent(sb, {
      temaId: input.temaId,
      frenteSlug,
      selfId: null,
      parentId: parentFieldDefId,
    });
  }

  const { data, error } = await sb
    .from("system_tema_field_defs")
    .insert({
      organization_id: DEFAULT_ORG,
      tema_id: input.temaId,
      frente_slug: frenteSlug,
      key,
      label,
      type: input.type,
      options: normalizeOptions(input.type, input.options),
      ordem: input.ordem ?? 0,
      required: input.required ?? false,
      scope,
      hidden_in_list: input.hiddenInList ?? false,
      hidden_in_filters: input.hiddenInFilters ?? false,
      max_occurrences: maxOccurrences,
      // A5 — nº de linhas mostradas de largada (<= teto).
      initial_occurrences: initialOccurrences,
      // A5 5c — auto-avanço: só campos boolean; demais tipos ficam NULL.
      move_to_stage_slug: normalizeMoveToStage(input.type, input.moveToStageSlug),
      // A4 — campo pai (dependência); null = sem dependência.
      parent_field_def_id: parentFieldDefId,
    })
    .select()
    .single();
  if (error || !data)
    throw new TemaFieldDefServiceError(error?.message ?? "Falha ao criar campo", 500);
  return data;
}

export async function updateTemaFieldDef(
  id: string,
  patch: Partial<{
    label: string;
    type: string;
    options: unknown;
    ordem: number;
    required: boolean;
    active: boolean;
    scope: string;
    hiddenInList: boolean;
    hiddenInFilters: boolean;
    maxOccurrences: number;
    // A5 (2026-08-05) — nº de linhas mostradas de largada (<= teto).
    initialOccurrences: number;
    moveToStageSlug: string | null;
    // A4 (2026-08-05) — reatribui/remove a dependência pai. null = remove.
    parentFieldDefId: string | null;
    // A7 (2026-08-05) — mesmo override do create: libera a checagem do balde
    // COMPARTILHADO do cliente. Não persiste no banco; só controla a validação.
    allowSharedClientKey: boolean;
  }>,
): Promise<FieldDefRow> {
  const sb = getSupabaseAdmin();
  const clean: FieldDefUpdate = {};
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label) throw new TemaFieldDefServiceError("Rótulo do campo é obrigatório", 422);
    clean.label = label;
  }
  if (patch.type !== undefined) {
    if (!TEMA_FIELD_TYPES.includes(patch.type as TemaFieldType)) {
      throw new TemaFieldDefServiceError("Tipo de campo inválido", 422);
    }
    clean.type = patch.type;
  }
  if (patch.options !== undefined || patch.type !== undefined) {
    // Reavalia options quando type ou options mudam.
    const effectiveType = (patch.type ?? clean.type) as string | undefined;
    if (effectiveType !== undefined) {
      clean.options = normalizeOptions(effectiveType, patch.options);
    } else if (patch.options !== undefined) {
      clean.options = normalizeOptions("select", patch.options);
    }
  }
  if (patch.ordem !== undefined) clean.ordem = patch.ordem;
  if (patch.required !== undefined) clean.required = patch.required;
  if (patch.active !== undefined) clean.active = patch.active;
  if (patch.scope !== undefined) clean.scope = patch.scope === "cliente" ? "cliente" : "caso";
  if (patch.hiddenInList !== undefined) clean.hidden_in_list = patch.hiddenInList;
  if (patch.hiddenInFilters !== undefined) clean.hidden_in_filters = patch.hiddenInFilters;
  if (patch.maxOccurrences !== undefined) {
    // Só campos de valor livre (texto/nº/data) podem ter >1; senão trava em 1.
    const effectiveType = (patch.type ?? clean.type) as string | undefined;
    const allowsMulti =
      effectiveType === undefined
        ? true
        : effectiveType === "text" || effectiveType === "number" || effectiveType === "date";
    clean.max_occurrences = allowsMulti ? normalizeMaxOccurrences(patch.maxOccurrences) : 1;
  } else if (
    patch.type !== undefined &&
    patch.type !== "text" &&
    patch.type !== "number" &&
    patch.type !== "date"
  ) {
    // Trocou para um tipo que não suporta múltiplas ocorrências → normaliza p/ 1.
    clean.max_occurrences = 1;
  }

  // A5 (2026-08-05) — linhas iniciais. Precisa respeitar o CHECK do banco
  // (initial_occurrences <= max_occurrences). Se `initialOccurrences` foi passado
  // OU se o teto foi rebaixado (novo max menor que o initial já gravado), reclampa.
  const needsInitialResolve =
    patch.initialOccurrences !== undefined || clean.max_occurrences !== undefined;
  if (needsInitialResolve) {
    // Teto efetivo: o novo max (se mudou) ou o atual no banco.
    let effMax = clean.max_occurrences;
    let curInitial: number | undefined;
    if (effMax === undefined || patch.initialOccurrences === undefined) {
      const { data: cur } = await sb
        .from("system_tema_field_defs_active")
        .select("max_occurrences, initial_occurrences")
        .eq("id", id)
        .maybeSingle();
      if (effMax === undefined) effMax = (cur?.max_occurrences as number | undefined) ?? 1;
      curInitial = (cur?.initial_occurrences as number | undefined) ?? 1;
    }
    const max = effMax ?? 1;
    if (patch.initialOccurrences !== undefined) {
      clean.initial_occurrences = normalizeInitialOccurrences(patch.initialOccurrences, max);
    } else if (curInitial !== undefined && curInitial > max) {
      // Teto rebaixado abaixo do initial atual → clampa p/ não violar o CHECK.
      clean.initial_occurrences = max;
    }
  }

  // A5 5c — auto-avanço: só campos `boolean` têm destino de etapa.
  // Regras: se moveToStageSlug foi passado, valida contra o tipo efetivo (só
  // boolean persiste; senão NULL). Se o TIPO mudou p/ algo != boolean sem
  // moveToStageSlug no patch, zera o destino (não faz sentido em não-boolean).
  const effectiveTypeForMove = (patch.type ?? clean.type) as string | undefined;
  if (patch.moveToStageSlug !== undefined) {
    clean.move_to_stage_slug = normalizeMoveToStage(
      effectiveTypeForMove ?? "boolean",
      patch.moveToStageSlug,
    );
  } else if (patch.type !== undefined && patch.type !== "boolean") {
    clean.move_to_stage_slug = null;
  }

  // scope='cliente': revalida colisão de chave no balde COMPARTILHADO do cliente
  // quando o campo VIRA cliente (flip) ou tem o rótulo alterado (a key não muda no
  // update). Ignorado quando o admin marca o override `allowSharedClientKey`.
  if ((clean.scope === "cliente" || patch.label !== undefined) && !patch.allowSharedClientKey) {
    const { data: cur } = await sb
      .from("system_tema_field_defs_active")
      .select("key, label, scope")
      .eq("id", id)
      .maybeSingle();
    if (cur) {
      const effScope = (clean.scope ?? (cur.scope as string)) === "cliente";
      if (effScope) {
        const effLabel = (clean.label ?? (cur.label as string)) as string;
        const conflict = await findClientBucketKeyConflict(sb, cur.key as string, effLabel, id);
        if (conflict) {
          throw new TemaFieldDefServiceError(
            `A chave "${cur.key}" já é usada pelo campo "${conflict}" nos dados COMPARTILHADOS do cliente ` +
              `(vale para todos os casos/temas do cliente). Renomeie este campo, use exatamente o mesmo ` +
              `rótulo se for o mesmo dado da pessoa, ou marque "liberar chave compartilhada" para usar mesmo assim.`,
            409,
          );
        }
      }
    }
  }

  // A4 — dependência pai→filho. Só toca a coluna quando `parentFieldDefId` vem no
  // patch. null = remove a dependência (sem validar); id = valida hierarquia (422)
  // no MESMO tema/frente do campo em edição, contando a sub-árvore dele.
  if (patch.parentFieldDefId !== undefined) {
    if (patch.parentFieldDefId === null) {
      clean.parent_field_def_id = null;
    } else {
      const { data: cur } = await sb
        .from("system_tema_field_defs_active")
        .select("tema_id, frente_slug")
        .eq("id", id)
        .maybeSingle();
      if (!cur) throw new TemaFieldDefServiceError("Campo não encontrado.", 404);
      await validateParent(sb, {
        temaId: cur.tema_id as string,
        frenteSlug: (cur.frente_slug as string | null) ?? null,
        selfId: id,
        parentId: patch.parentFieldDefId,
      });
      clean.parent_field_def_id = patch.parentFieldDefId;
    }
  }

  const { data, error } = await sb
    .from("system_tema_field_defs")
    .update(clean)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data)
    throw new TemaFieldDefServiceError(error?.message ?? "Falha ao atualizar campo", 500);
  return data;
}

// EXCLUI (soft-delete) uma def. Os valores já gravados em canonical_fields NÃO
// são apagados — a UI da ficha continua exibindo a chave livre remanescente.
export async function deleteTemaFieldDef(id: string): Promise<{ ok: true; id: string }> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_tema_field_defs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new TemaFieldDefServiceError(error.message, 500);
  return { ok: true as const, id };
}
