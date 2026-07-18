// Story R5-06 (A2) — DEFS dos campos estruturados do contrato FIES.
//
// Domínio FECHADO (selects + valor monetário). Armazenados nos MESMOS
// `system_cases.canonical_fields` (JSONB) de S2-07 — NÃO em custom_fields do
// cliente, NÃO em mecanismo novo. Aqui só ficam as DEFINIÇÕES (chaves, rótulos,
// tipos, opções); a persistência é `updateCaseCanonicalFields`.
//
// ⚠️ CRUZAMENTO COM R2 (obrigatório documentar):
// Estes campos FIES são um CASO CONCRETO dos "campos personalizados por
// tema/frente" do épico R2 (doc-mestre §4.1/§5.1). Enquanto R2 não entrega a
// estrutura genérica de defs por tema, mantemos este conjunto FIXO aqui. Quando
// R2 existir, MIGRAR estas defs para lá (origem das defs muda; o armazenamento
// em `canonical_fields` PERMANECE). NÃO criar um segundo mecanismo paralelo.
//
// `isCasoFies` está isolado de propósito: quando R2 trocar "tipo" por "tema",
// basta reimplementar este helper (ou passar a resolver as defs por tema).

import type { CaseType } from "@/lib/cases/constants";

/** Chaves canônicas FIES — usadas como chave em `canonical_fields`. */
export const FIES_KEY_INSTITUICAO = "fies_instituicao";
export const FIES_KEY_VALOR_CENTAVOS = "fies_valor_centavos";
export const FIES_KEY_SITUACAO = "fies_situacao";
export const FIES_KEY_ANO = "fies_ano";

export type FiesFieldType = "select" | "money";

export type FiesFieldDef = {
  /** Chave canônica (chave no JSONB canonical_fields). */
  key: string;
  /** Rótulo exibido na UI e usado como placeholder amigável no autofill. */
  label: string;
  type: FiesFieldType;
  /** Opções (domínio fechado) para type === "select". */
  options?: { value: string; label: string }[];
};

// Domínio fechado dos selects. O `value` gravado é o próprio rótulo legível —
// assim a busca por texto de S2-07 (que faz includes no JSON stringificado) e o
// autofill entregam algo humano sem mapa extra.
export const FIES_INSTITUICAO_OPTIONS = [
  { value: "Caixa Econômica Federal", label: "Caixa Econômica Federal" },
  { value: "Banco do Brasil", label: "Banco do Brasil" },
] as const;

export const FIES_SITUACAO_OPTIONS = [
  { value: "Ativo", label: "Ativo" },
  { value: "Inativo", label: "Inativo" },
  { value: "FIES liquidado", label: "FIES liquidado" },
] as const;

export const FIES_ANO_OPTIONS = [
  { value: "Até 2017", label: "Até 2017" },
  { value: "2018 e seguintes", label: "2018 e seguintes" },
] as const;

/** Conjunto FIXO de campos FIES (ordem = ordem de exibição). */
export const FIES_FIELD_DEFS: FiesFieldDef[] = [
  {
    key: FIES_KEY_INSTITUICAO,
    label: "Instituição Financeira",
    type: "select",
    options: [...FIES_INSTITUICAO_OPTIONS],
  },
  {
    key: FIES_KEY_VALOR_CENTAVOS,
    label: "Valor (saldo devedor)",
    type: "money",
  },
  {
    key: FIES_KEY_SITUACAO,
    label: "Situação",
    type: "select",
    options: [...FIES_SITUACAO_OPTIONS],
  },
  {
    key: FIES_KEY_ANO,
    label: "Ano do contrato",
    type: "select",
    options: [...FIES_ANO_OPTIONS],
  },
];

/** Conjunto de chaves FIES (para filtrar/segregar do bloco de campos livres). */
export const FIES_FIELD_KEYS: readonly string[] = FIES_FIELD_DEFS.map((d) => d.key);

/**
 * Detecta se um caso é FIES pelo `case_type` (slugs `FIES_*`).
 *
 * ⚠️ R2: quando os campos migrarem para "campos por tema/frente", este helper
 * deve passar a resolver por TEMA (não por slug de tipo). Mantido isolado de
 * propósito para essa troca ser cirúrgica.
 */
export function isCasoFies(caseType: string | CaseType | null | undefined): boolean {
  return typeof caseType === "string" && caseType.toUpperCase().startsWith("FIES_");
}
