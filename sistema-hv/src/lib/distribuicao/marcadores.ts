// M13 (2026-08-07) — deriva COMPLEXO/COLETIVO dos MARCADORES do processo (v1).
//
// Hoje COMPLEXO e COLETIVO são MARCADORES no ProJuris (não campo personalizado).
// O Dadá confirmou que migrar para campo personalizado depois "só muda onde o
// sistema busca" — por isso a FONTE é configurável (espelha TEMA_SOURCE_ORDER do
// normalizer): v1 lê de marcador; trocar p/ campo personalizado é só mudar a
// origem sem reescrever esta derivação.
//
// Casamento por NOME NORMALIZADO (acento/caixa/espaço) via normalizeTemaKey.
// Fallback determinístico: sem marcador conhecido ⇒ individual/não-complexo
// (collective=false, complexity_level=0). NUNCA "chuta" complexo por ausência.

import { normalizeTemaKey } from "@/lib/projuris/normalizer";

export type MarcadorSignal = { collective?: boolean; complexity_level?: 1 | 2 };

// Mapa de marcador NORMALIZADO → sinal. Lista inicial tolerante a grafia; os
// nomes EXATOS no ProJuris devem ser confirmados com o owner (o time "começa a
// preencher"). Estender aqui conforme os marcadores reais aparecem no diag.
export const MARCADOR_MAP: Record<string, MarcadorSignal> = {
  COLETIVO: { collective: true },
  "ACAO COLETIVA": { collective: true },
  "PROCESSO COLETIVO": { collective: true },
  COMPLEXO: { complexity_level: 1 },
  "CASO COMPLEXO": { complexity_level: 1 },
  "MUITO COMPLEXO": { complexity_level: 2 },
  "COMPLEXO 2": { complexity_level: 2 },
  "ALTA COMPLEXIDADE": { complexity_level: 2 },
};

export type MarcadorDerivation = {
  collective: boolean;
  complexity_level: 0 | 1 | 2;
  /** marcadores que casaram (para diagnóstico/auditoria). */
  matched: string[];
};

/**
 * Deriva collective/complexity_level a partir dos nomes de marcadores do
 * processo. Pega o MAIOR nível de complexidade entre os marcadores casados e
 * OU-lógico do coletivo. Fallback = { collective:false, complexity_level:0 }.
 */
export function deriveFromMarcadores(marcadores: string[]): MarcadorDerivation {
  let collective = false;
  let complexity: 0 | 1 | 2 = 0;
  const matched: string[] = [];
  for (const m of marcadores) {
    const sig = MARCADOR_MAP[normalizeTemaKey(m)];
    if (!sig) continue;
    matched.push(m);
    if (sig.collective) collective = true;
    if (sig.complexity_level && sig.complexity_level > complexity) {
      complexity = sig.complexity_level;
    }
  }
  return { collective, complexity_level: complexity, matched };
}
