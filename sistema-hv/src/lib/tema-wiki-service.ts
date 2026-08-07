// Server-only — C5 (Reunião 2026-08-05): "Links úteis" / wiki por TEMA.
// Um "bloco" = um quadro com TÍTULO editável + lista de ITENS (caixinhas) em
// JSONB. Vinculado ao TEMA (system_temas.id), NÃO ao kanban/board nem ao
// service_type. Todos leem; só admins escrevem (gate no RPC).
//
// MODELAGEM (Opção A da story, TRAVADA): 1 tabela system_tema_wiki_blocks com os
// itens em JSONB. Cada item: { id, tipo: 'texto'|'link', valor, rotulo? }. O `id`
// do item é gerado AQUI (server) — nunca confiar no cliente.
//
// "Salva no Drive" = o item pode ser uma URL (inclusive do Drive); o bloco/itens
// ficam no Supabase (metadado). Não cria arquivo no Drive por bloco.

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export class TemaWikiServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TemaWikiServiceError";
  }
}

// Item de um bloco. `valor` = o texto ou a URL; `rotulo` opcional (texto amigável
// exibido para um link). Validação: `tipo` enum, `valor` non-empty; para `link`,
// só http(s):// (rejeita javascript: e afins por segurança).
const httpUrl = z
  .string()
  .trim()
  .min(1)
  .refine((v) => /^https?:\/\//i.test(v), "O link deve começar com http:// ou https://");

const itemInputSchema = z
  .object({
    id: z.string().optional(),
    tipo: z.enum(["texto", "link"]),
    valor: z.string().trim().min(1, "O valor da caixinha não pode ser vazio"),
    rotulo: z.string().trim().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.tipo === "link") {
      const parsed = httpUrl.safeParse(item.valor);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: parsed.error.issues[0]?.message ?? "Link inválido",
          path: ["valor"],
        });
      }
    }
  });

export type WikiItem = {
  id: string;
  tipo: "texto" | "link";
  valor: string;
  rotulo?: string;
};

// Normaliza a lista de itens: valida cada um (Zod) e garante um `id` estável
// gerado no servidor (não confia no cliente). Lança 422 em item inválido.
function normalizeItems(itens: unknown): WikiItem[] {
  const arr = Array.isArray(itens) ? itens : [];
  const out: WikiItem[] = [];
  for (const raw of arr) {
    const parsed = itemInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new TemaWikiServiceError(parsed.error.issues[0]?.message ?? "Item inválido", 422);
    }
    const it = parsed.data;
    const item: WikiItem = {
      id: it.id && /^[0-9a-f-]{8,}$/i.test(it.id) ? it.id : randomUUID(),
      tipo: it.tipo,
      valor: it.valor,
    };
    if (it.rotulo) item.rotulo = it.rotulo;
    out.push(item);
  }
  return out;
}

// --------------------------------------------------------------------- Reads
export async function listTemaWikiBlocks(temaId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_tema_wiki_blocks_active")
    .select("*")
    .eq("tema_id", temaId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new TemaWikiServiceError(error.message, 500);
  return data ?? [];
}

// --------------------------------------------------------------------- Writes
export async function createTemaWikiBlock(input: {
  tema_id: string;
  titulo: string;
  itens?: unknown;
  ordem?: number;
  createdBy?: string;
}) {
  const sb = getSupabaseAdmin();
  const titulo = input.titulo.trim();
  if (!titulo) throw new TemaWikiServiceError("Título do bloco obrigatório", 422);

  // Valida que o tema existe (evita bloco órfão).
  const { data: tema } = await sb
    .from("system_temas")
    .select("id, organization_id")
    .eq("id", input.tema_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!tema) throw new TemaWikiServiceError("Tema não encontrado", 404);

  const itens = normalizeItems(input.itens ?? []);

  // ordem default = fim da lista.
  let ordem = input.ordem;
  if (ordem === undefined) {
    const { count } = await sb
      .from("system_tema_wiki_blocks_active")
      .select("id", { count: "exact", head: true })
      .eq("tema_id", input.tema_id);
    ordem = count ?? 0;
  }

  const { data, error } = await sb
    .from("system_tema_wiki_blocks")
    .insert({
      organization_id: tema.organization_id ?? DEFAULT_ORG,
      tema_id: input.tema_id,
      titulo,
      itens,
      ordem,
      created_by: input.createdBy ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new TemaWikiServiceError(error?.message ?? "Falha ao criar bloco", 500);
  return data;
}

// Atualiza título / itens / ordem de um bloco. Só campos informados.
export async function updateTemaWikiBlock(
  id: string,
  patch: Partial<{ titulo: string; itens: unknown; ordem: number }>,
) {
  const sb = getSupabaseAdmin();
  const clean: { titulo?: string; itens?: WikiItem[]; ordem?: number } = {};
  if (patch.titulo !== undefined) {
    const t = patch.titulo.trim();
    if (!t) throw new TemaWikiServiceError("Título do bloco obrigatório", 422);
    clean.titulo = t;
  }
  if (patch.itens !== undefined) clean.itens = normalizeItems(patch.itens);
  if (patch.ordem !== undefined) clean.ordem = patch.ordem;

  if (Object.keys(clean).length === 0) {
    throw new TemaWikiServiceError("Nada a atualizar", 422);
  }

  const { data, error } = await sb
    .from("system_tema_wiki_blocks")
    .update(clean)
    .eq("id", id)
    .is("deleted_at", null)
    .select()
    .single();
  if (error || !data)
    throw new TemaWikiServiceError(error?.message ?? "Falha ao atualizar bloco", 500);
  return data;
}

// Reordena os blocos de um tema (grava `ordem` = índice).
export async function reorderTemaWikiBlocks(ids: string[]) {
  const sb = getSupabaseAdmin();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await sb
      .from("system_tema_wiki_blocks")
      .update({ ordem: i })
      .eq("id", ids[i])
      .is("deleted_at", null);
    if (error) throw new TemaWikiServiceError(error.message, 500);
  }
  return { ok: true as const };
}

// Soft-delete de um bloco (some da view _active).
export async function softDeleteTemaWikiBlock(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_tema_wiki_blocks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new TemaWikiServiceError(error.message, 500);
  return { ok: true as const, id };
}
