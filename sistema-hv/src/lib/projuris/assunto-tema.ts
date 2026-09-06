// Server-only — S2-02 / S2-03: qual ASSUNTO do ProJuris pertence a cada tema.
//
// O que isto conserta (Thiago, desenho 5): `criar-processo` mandava
// `assunto: caso_pasta_nome || case_code`, então todo processo criado pelo SHV
// nascia com um assunto NOVO no ProJuris — o print dele mostra
// "INADIMPLENCIAHV-2026-0422" no campo ASSUNTO (TEMA). O ProJuris acumulava um
// assunto por caso e os relatórios de lá paravam de agrupar por tema.
//
// A cadeia de resolução, na ordem (Thiago, resposta B1):
//   1. assunto do TEMA do caso;
//   2. assunto GERAL ("CÍVEIS" — "o fallback geral, encaixamos aqui tudo que não
//      encaixe em outro");
//   3. nada. Aqui é BLOQUEIO, não invenção: cair no código do caso é justamente
//      o defeito que estamos removendo.

import { getSupabaseAdmin } from "../supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export type AssuntoResolvido = {
  /** Nome do assunto. É o que vai no payload do ProJuris. */
  nome: string;
  /** Identificador, quando o tema tem um. O Thiago não achou id para "CÍVEIS". */
  id: string | null;
  /** De onde veio — a UI mostra isso para quem cria o processo. */
  origem: "tema" | "geral";
  /** Nome do tema, quando a origem é o tema. */
  temaNome?: string;
};

/** O assunto guarda-chuva, configurado uma vez para toda a organização. */
export async function getAssuntoGeral(): Promise<{ id: string | null; nome: string | null }> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_distribution_config")
    .select("projuris_assunto_geral_id, projuris_assunto_geral_nome")
    .eq("organization_id", DEFAULT_ORG)
    .maybeSingle();
  const c = data as {
    projuris_assunto_geral_id?: string | null;
    projuris_assunto_geral_nome?: string | null;
  } | null;
  return {
    id: c?.projuris_assunto_geral_id ?? null,
    nome: c?.projuris_assunto_geral_nome?.trim() || null,
  };
}

export async function setAssuntoGeral(patch: {
  id?: string | null;
  nome?: string | null;
}): Promise<{ ok: true }> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_distribution_config")
    .update({
      projuris_assunto_geral_id: patch.id?.trim() || null,
      projuris_assunto_geral_nome: patch.nome?.trim() || null,
    } as never)
    .eq("organization_id", DEFAULT_ORG);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setTemaAssunto(
  temaId: string,
  patch: { id?: string | null; nome?: string | null },
): Promise<{ ok: true }> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_temas")
    .update({
      projuris_assunto_id: patch.id?.trim() || null,
      projuris_assunto_nome: patch.nome?.trim() || null,
    } as never)
    .eq("id", temaId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * Resolve o assunto de um CASO percorrendo a cadeia tema → geral.
 *
 * Devolve `null` quando nenhum dos dois está configurado — e aí quem chama
 * BLOQUEIA. Voltar a usar o `case_code` como assunto é exatamente o defeito que
 * esta função existe para eliminar.
 */
export async function resolverAssuntoDoCaso(caseId: string): Promise<AssuntoResolvido | null> {
  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select("tema_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();
  const temaId = (caso as { tema_id?: string | null } | null)?.tema_id ?? null;

  if (temaId) {
    const { data: tema } = await sb
      .from("system_temas")
      .select("name, projuris_assunto_id, projuris_assunto_nome")
      .eq("id", temaId)
      .maybeSingle();
    const t = tema as {
      name?: string;
      projuris_assunto_id?: string | null;
      projuris_assunto_nome?: string | null;
    } | null;
    const nome = t?.projuris_assunto_nome?.trim();
    if (nome) {
      return {
        nome,
        id: t?.projuris_assunto_id ?? null,
        origem: "tema",
        temaNome: t?.name,
      };
    }
  }

  const geral = await getAssuntoGeral();
  if (geral.nome) return { nome: geral.nome, id: geral.id, origem: "geral" };

  return null;
}
