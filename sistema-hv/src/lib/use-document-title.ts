// S4-06 — Título da aba (document.title) por NOME, nunca por UUID.
//
// As rotas de detalhe deste app resolvem o registro via useQuery no componente
// (não há loader com `head` dinâmico), então o caminho mais robusto e à prova de
// regressão é um efeito client-side que carimba `document.title` a partir do dado
// JÁ CARREGADO na página.
//
// Regras (S4-06):
//   - Enquanto carrega  → título genérico de "carregando" (NUNCA o UUID).
//   - Em erro/404       → rótulo genérico por entidade (NUNCA o UUID).
//   - Carregado         → "{Nome} — Hyago Viana Advocacia".
//
// O `head` estático de __root.tsx serve o título inicial no SSR; este hook
// sobrescreve no cliente assim que o nome do registro está disponível.

import { useEffect } from "react";

export const APP_TITLE_SUFFIX = "Hyago Viana Advocacia";

/**
 * Resolve o label legível de uma entidade a partir do estado de carregamento,
 * garantindo que o UUID NUNCA seja exibido.
 *
 * @param name       nome/código já carregado (ex.: case_code, full_name). `null`/`undefined` enquanto não resolvido.
 * @param opts.loading   true enquanto a query está carregando.
 * @param opts.notFound  true em 404/erro de "não encontrado".
 * @param opts.loadingLabel   rótulo durante o carregamento (default "Carregando…").
 * @param opts.notFoundLabel  rótulo genérico em 404/erro (ex.: "Caso não encontrado").
 */
export function resolveEntityLabel(
  name: string | null | undefined,
  opts: {
    loading?: boolean;
    notFound?: boolean;
    loadingLabel?: string;
    notFoundLabel: string;
  },
): string {
  if (opts.notFound) return opts.notFoundLabel;
  if (opts.loading) return opts.loadingLabel ?? "Carregando…";
  const trimmed = (name ?? "").trim();
  return trimmed || opts.notFoundLabel;
}

/**
 * Carimba `document.title` com o título passado (já resolvido por NOME).
 * Não faz nada no servidor. Restaura o título global ao desmontar.
 *
 * Passe apenas o "miolo" — o sufixo " — Hyago Viana Advocacia" é anexado aqui,
 * a menos que `title` já seja genérico do app (ver overloads via `withSuffix`).
 */
export function useDocumentTitle(title: string, withSuffix = true) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.title;
    const next = withSuffix && title ? `${title} — ${APP_TITLE_SUFFIX}` : title || APP_TITLE_SUFFIX;
    document.title = next;
    return () => {
      document.title = previous;
    };
  }, [title, withSuffix]);
}
