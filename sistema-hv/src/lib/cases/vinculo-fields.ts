// Story R1-05 (N2 / B1) — DEFS do VÍNCULO da pessoa NAQUELE caso.
//
// O vínculo é do CASO, nunca da pessoa: a mesma pessoa pode ter município/
// vínculo/papel DIFERENTES em cada caso. Por isso NÃO gravamos em
// `system_clients` (custom_fields / professional_data), e sim no próprio caso.
//
// Armazenamento (decisão travada da story):
//   - `municipio` → COLUNA dedicada `system_cases.municipio` (já existe; via
//     updateCase). NÃO vai para canonical_fields.
//   - `vinculo_empregaticio` / `vinculo_papel` → `system_cases.canonical_fields`
//     (JSONB de S2-07, via updateCaseCanonicalFields). Merge por caso, sem
//     migration nova.
//
// ⚠️ NAMESPACE ESTÁVEL `vinculo_*`:
// As chaves canônicas abaixo são NAMESPACED com o prefixo `vinculo_` para não
// colidir com:
//   - os campos FIES de R5-06 (`fies_*`, ver src/lib/cases/fies-fields.ts);
//   - os campos personalizados por tema/frente de R2-07 (defs dinâmicas).
// Manter esse prefixo estável é obrigatório (o CaseCanonicalFields filtra estas
// chaves para dar-lhes UI própria, como já faz com FIES_FIELD_KEYS). Não
// renomear as chaves depois de gravadas em produção.

export type VinculoFieldType = "text";

export type VinculoFieldDef = {
  /** Chave canônica (chave no JSONB canonical_fields). Namespaced `vinculo_*`. */
  key: string;
  /** Rótulo exibido na UI e usado como placeholder amigável no autofill. */
  label: string;
  type: VinculoFieldType;
};

/**
 * Chaves canônicas de vínculo — usadas como chave em `canonical_fields`.
 * `municipio` NÃO está aqui de propósito: fica na COLUNA dedicada do caso.
 */
export const VINCULO_KEY_EMPREGATICIO = "vinculo_empregaticio";
export const VINCULO_KEY_PAPEL = "vinculo_papel";

/** Conjunto FIXO de campos de vínculo canônicos (ordem = ordem de exibição). */
export const VINCULO_FIELD_DEFS: VinculoFieldDef[] = [
  {
    key: VINCULO_KEY_EMPREGATICIO,
    label: "Vínculo empregatício/institucional",
    type: "text",
  },
  {
    key: VINCULO_KEY_PAPEL,
    label: "Papel da pessoa no caso",
    type: "text",
  },
];

/**
 * Conjunto de chaves de vínculo (para filtrar/segregar do bloco de campos
 * livres em CaseCanonicalFields, exatamente como se filtra FIES_FIELD_KEYS).
 * NÃO inclui `municipio` (coluna dedicada, fora do canonical_fields).
 */
export const VINCULO_FIELD_KEYS: readonly string[] = VINCULO_FIELD_DEFS.map((d) => d.key);
