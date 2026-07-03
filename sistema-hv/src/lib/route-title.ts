// S4-06 (fix breadcrumb Topbar, 2026-07-03) — Store leve de "rótulo da rota atual".
//
// Problema: o Topbar monta o breadcrumb a partir dos segmentos da URL. Em rotas
// com param dinâmico (`/casos/$id`, `/clientes/$id`, …) o último segmento é um
// UUID e era impresso cru → "Painel / Casos / 6c90f48c-…".
//
// Solução (2 camadas): a PÁGINA de detalhe publica aqui o nome já resolvido (o
// MESMO valor que passa p/ useDocumentTitle/resolveEntityLabel) associado ao seu
// pathname, e o Topbar CONSOME para trocar o rótulo do segmento dinâmico. A
// segunda camada (safety net no Topbar) garante que, mesmo sem publicação,
// nenhum UUID/id numérico escape (vira "Detalhe").
//
// Implementação: store externo minúsculo + useSyncExternalStore para o Topbar
// re-renderizar quando o rótulo muda. Chaveado por pathname para não vazar
// rótulo de uma rota para outra.

import { useEffect, useSyncExternalStore } from "react";
import { useRouterState } from "@tanstack/react-router";

type Listener = () => void;

const labels = new Map<string, string>();
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Publica (ou remove, com `null`) o rótulo associado a um pathname. */
export function setRouteTitle(pathname: string, label: string | null): void {
  const current = labels.get(pathname);
  if (label == null || label === "") {
    if (current === undefined) return;
    labels.delete(pathname);
    emit();
    return;
  }
  if (current === label) return;
  labels.set(pathname, label);
  emit();
}

/** Lê o rótulo publicado para um pathname (ou `undefined`). */
export function getRouteTitle(pathname: string): string | undefined {
  return labels.get(pathname);
}

/**
 * Hook para o Topbar: retorna o rótulo publicado para o pathname informado,
 * re-renderizando quando ele muda.
 */
export function useRouteTitle(pathname: string): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => labels.get(pathname),
    () => labels.get(pathname),
  );
}

/**
 * Hook para as PÁGINAS de detalhe: publica `label` para o pathname atual e
 * limpa ao desmontar / ao mudar de rota. Passe o MESMO valor já resolvido por
 * resolveEntityLabel (nunca o UUID).
 */
export function usePublishRouteTitle(label: string | null | undefined): void {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setRouteTitle(pathname, label ?? null);
    return () => {
      setRouteTitle(pathname, null);
    };
  }, [pathname, label]);
}
