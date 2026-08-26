// Rótulo humano de uma ETAPA a partir do slug guardado no evento.
//
// L1 (reunião 2026-08-26). Thiago, lendo a linha do tempo de um caso: "ele ainda
// tá aparecendo uma informação robotizada enorme… tivesse como isso ser um
// pouquinho mais humanizado: mudou, então a etapa era tal, entrar em contato, e
// para dado judicial."
//
// O evento guarda SLUG, não rótulo (`entrar_contato`). A tradução é na leitura —
// então renomear uma etapa passa a valer também para o histórico, que é o
// comportamento desejado e o mais barato.
//
// Módulo PURO: sem imports, sem efeitos. Pode ser usado dos dois lados.

/** Última linha de defesa: `entrar_contato` → "Entrar contato". Nunca devolve vazio. */
export function formatStageSlug(slug: string | null | undefined): string {
  const s = (slug ?? "").trim();
  if (!s) return "·";
  const limpo = s.replace(/[_-]+/g, " ").trim();
  if (!limpo) return "·";
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

export interface StageLike {
  slug: string;
  label: string | null;
}

/** Traduz slug → rótulo. Slug desconhecido cai no `formatStageSlug`. */
export type StageLabelResolver = (slug: string | null | undefined) => string;

/**
 * Monta o resolvedor a partir das etapas conhecidas do caso.
 *
 * `fontes` aceita várias listas (etapas do pipeline op, do financeiro, dos boards
 * custom) porque um mesmo caso pode ter eventos de kanbans diferentes. A PRIMEIRA
 * ocorrência de cada slug vence — passe as listas na ordem de prioridade.
 *
 * `macroLabels` cobre os macrostatus legados (MACRO_OP_LABELS / MACRO_FIN_LABELS),
 * que não vivem em `system_pipeline_stages`.
 */
export function makeStageLabelResolver(
  fontes: Array<ReadonlyArray<StageLike> | undefined | null>,
  ...macroLabels: Array<Record<string, string> | undefined>
): StageLabelResolver {
  const mapa = new Map<string, string>();

  for (const lista of fontes) {
    for (const st of lista ?? []) {
      const label = (st.label ?? "").trim();
      if (st.slug && label && !mapa.has(st.slug)) mapa.set(st.slug, label);
    }
  }
  for (const dic of macroLabels) {
    for (const [slug, label] of Object.entries(dic ?? {})) {
      if (label && !mapa.has(slug)) mapa.set(slug, label);
    }
  }

  return (slug) => {
    const s = (slug ?? "").trim();
    if (!s) return "·";
    return mapa.get(s) ?? formatStageSlug(s);
  };
}
