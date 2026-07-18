// R1-04 — Adaptador de TEMA do caso (nível 1 da ficha da pessoa).
//
// A ficha da pessoa agrupa os casos por TEMA. O conceito de TEMA é entregue pelo
// épico R2 (system_cases.tema_id + system_temas.name). Este adaptador é o ÚNICO
// ponto que a UI consulta para obter a chave/rótulo do tema — trocar a
// implementação aqui NÃO exige mexer no componente de ficha (contrato estável).
//
// TROCA case_type→tema_id: JÁ FEITA. R2 está aplicado (system_cases.tema_id +
// system_temas), então já usamos o tema_id REAL quando presente. Casos legados
// (sem tema_id) continuam agrupando pelo case_type (o service_type, que vira
// tema — doc-mestre §4.2); casos sem nenhum dos dois caem em "Sem tema".
//
// Regra de ouro (R1-04): NÃO deletar case_type — ele é o agrupador dos casos
// legados (e permanece por dual-write). Sem migration; tudo client-side.

import { CASE_TYPE_LABELS, type CaseType } from "./constants";

// Forma mínima consumida do caso (subset de system_cases_active). Aceita
// campos opcionais/anuláveis para casar com a Row real e os legados.
export type CaseTemaInput = {
  tema_id?: string | null;
  case_type?: string | null;
};

// Chave estável usada para AGRUPAR os casos (nível 1). Namespaced por origem para
// nunca colidir um tema_id com um slug de case_type:
//   - `tema:{tema_id}`  quando o caso tem tema_id (temas de R2);
//   - `ct:{case_type}`  quando só há o case_type legado;
//   - `__none__`        quando não há nenhum dos dois (grupo "Sem tema").
export function getCaseTemaKey(caso: CaseTemaInput): string {
  if (caso.tema_id) return `tema:${caso.tema_id}`;
  if (caso.case_type) return `ct:${caso.case_type}`;
  return "__none__";
}

// Mapas de resolução de nome, carregados UMA vez na ficha (sem query por caso):
//   - temaNameById:          tema_id  → system_temas.name
//   - serviceTypeNameBySlug: case_type(slug) → system_service_types.name
export type CaseTemaLabelMaps = {
  temaNameById?: Record<string, string>;
  serviceTypeNameBySlug?: Record<string, string>;
};

// Rótulo amigável do grupo (nível 1):
//   - tema_id → nome do TEMA (system_temas.name); fallback ao próprio id;
//   - case_type → nome do service_type (system_service_types.name) OU
//     CASE_TYPE_LABELS; fallback ao slug;
//   - "__none__" → "Sem tema".
export function getCaseTemaLabel(caso: CaseTemaInput, maps: CaseTemaLabelMaps = {}): string {
  if (caso.tema_id) {
    return maps.temaNameById?.[caso.tema_id] ?? caso.tema_id;
  }
  if (caso.case_type) {
    return (
      maps.serviceTypeNameBySlug?.[caso.case_type] ??
      CASE_TYPE_LABELS[caso.case_type as CaseType] ??
      caso.case_type
    );
  }
  return "Sem tema";
}

export const SEM_TEMA_KEY = "__none__";
