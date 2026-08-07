// Rotulo humano da REGRA APLICADA por tarefa (Story H2 / cobre H10).
//
// A regra JA foi decidida pelo motor v1.0. Aqui NAO recomputamos nada: derivamos
// um texto legivel a partir do que o resultado imutavel ja gravou —
// `flow` (ABSOLUTE/COMPLEX/GENERAL) + `preference_applied` + `alerts[]`.
//
// Mapa de precedencia do engine (flow-selector.ts -> detectAbsoluteResponsible):
//   ABSOLUTE  -> executor dirigido do processo / tema exclusivo / tipo exclusivo
//                (nao da p/ distinguir o SUB-nivel so pelo result; o alerta
//                 ALT-RESP-* refina quando presente).
//   COMPLEX   -> rodizio entre elegiveis (nivel de complexidade 1|2).
//   GENERAL   -> balanceamento por carga (complexidade 0).
// `preference_applied=true` marca que a data preferencial/excecao foi honrada.

export type RuleLabel = {
  /** Texto curto para a coluna/badge. */
  short: string;
  /** Explicacao completa (tooltip). */
  detail: string;
};

/** Alertas que ajudam a refinar o sub-nivel do fluxo ABSOLUTE, se presentes. */
function absoluteSublevel(alerts: string[]): string | null {
  // ALT-RESP-* sao os alertas do executor absoluto (elegibilidade/override).
  // Nao ha um codigo dedicado por sub-nivel hoje; mantemos o rotulo generico
  // e exibimos os alertas crus como escape (R3 da story).
  if (alerts.some((a) => a.startsWith("ALT-RESP"))) {
    return "responsavel absoluto (verificar alerta de elegibilidade)";
  }
  return null;
}

export function deriveRuleLabel(input: {
  flow: string;
  preference_applied?: boolean | null;
  alerts?: string[] | null;
  blocked?: boolean | null;
}): RuleLabel {
  const alerts = input.alerts ?? [];
  const pref = input.preference_applied === true;

  if (input.blocked) {
    return {
      short: "Bloqueada",
      detail: "Tarefa bloqueada pelo motor — nao entra na distribuicao (ver alertas).",
    };
  }

  switch (input.flow) {
    case "ABSOLUTE": {
      const sub = absoluteSublevel(alerts);
      return {
        short: "Exceção (executor exclusivo)",
        detail:
          "Fluxo ABSOLUTE: executor dirigido do processo, tema exclusivo ou tipo-tarefa exclusivo — vai direto ao responsavel, ignorando fila/carga." +
          (sub ? ` (${sub})` : ""),
      };
    }
    case "COMPLEX":
      return {
        short: pref ? "Complexo — rodízio (preferência)" : "Complexo — rodízio",
        detail:
          "Fluxo COMPLEX: rodizio entre executores elegiveis a complexidade." +
          (pref ? " Data preferencial/excecao honrada." : ""),
      };
    case "GENERAL":
      return {
        short: pref ? "Balanceamento por carga (preferência)" : "Balanceamento por carga",
        detail:
          "Fluxo GENERAL: balanceamento por carga entre executores." +
          (pref ? " Data preferencial/excecao honrada." : ""),
      };
    default:
      return {
        short: input.flow || "—",
        detail: "Regra nao reconhecida — consulte os alertas crus.",
      };
  }
}
