// Testes leves standalone (npx tsx). Sem runner, SEM banco. Falha = stderr + exit 1.
// Cobre R1-04: adaptador de TEMA da ficha da pessoa (contrato estável).
//
// Contrato verificado (AC:3,4): a UI consome SÓ getCaseTemaKey/getCaseTemaLabel.
// Trocar a implementação (case_type → tema_id) NÃO muda a superfície consumida:
// key namespaced + label amigável + fallback "Sem tema".

import {
  getCaseTemaKey,
  getCaseTemaLabel,
  SEM_TEMA_KEY,
  type CaseTemaLabelMaps,
} from "./case-tema";

let failed = 0;

function assert(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

console.log("case-tema (R1-04):");

const maps: CaseTemaLabelMaps = {
  temaNameById: { "tema-uuid-1": "Aposentadoria Especial" },
  serviceTypeNameBySlug: { COVID: "COVID (renomeado)" },
};

// --- getCaseTemaKey: namespaced por origem ---------------------------------
{
  assert(
    "tema_id → chave 'tema:{id}' (R2 real, prioridade sobre case_type)",
    getCaseTemaKey({ tema_id: "tema-uuid-1", case_type: "COVID" }) === "tema:tema-uuid-1",
  );
  assert(
    "só case_type → chave 'ct:{slug}' (legado)",
    getCaseTemaKey({ case_type: "FIES_ESF" }) === "ct:FIES_ESF",
  );
  assert(
    "sem tema_id nem case_type → SEM_TEMA_KEY",
    getCaseTemaKey({ tema_id: null, case_type: null }) === SEM_TEMA_KEY,
  );
  assert("objeto vazio → SEM_TEMA_KEY", getCaseTemaKey({}) === SEM_TEMA_KEY);
}

// --- getCaseTemaLabel: nome amigável + fallbacks ---------------------------
{
  assert(
    "tema_id → nome do TEMA (system_temas.name)",
    getCaseTemaLabel({ tema_id: "tema-uuid-1" }, maps) === "Aposentadoria Especial",
  );
  assert(
    "tema_id sem entrada no mapa → fallback ao id",
    getCaseTemaLabel({ tema_id: "tema-desconhecido" }, maps) === "tema-desconhecido",
  );
  assert(
    "case_type → nome do service_type (mapa) tem prioridade",
    getCaseTemaLabel({ case_type: "COVID" }, maps) === "COVID (renomeado)",
  );
  assert(
    "case_type fora do mapa → CASE_TYPE_LABELS (FIES_DGM = Abatimento Militar)",
    getCaseTemaLabel({ case_type: "FIES_DGM" }, maps) === "Abatimento Militar",
  );
  assert(
    "case_type desconhecido → fallback ao slug",
    getCaseTemaLabel({ case_type: "SLUG_INVENTADO" }, maps) === "SLUG_INVENTADO",
  );
  assert("sem tema/case_type → 'Sem tema'", getCaseTemaLabel({}, maps) === "Sem tema");
  assert(
    "label funciona sem mapas (fallback puro)",
    getCaseTemaLabel({ case_type: "RESIDENCIA" }) === "Residência",
  );
}

// --- Contrato: trocar a impl (mock tema_id) NÃO muda a superfície -----------
{
  // Simula o "amanhã": caso que só tem tema_id. A UI chama exatamente os mesmos
  // 2 pontos e recebe key namespaced + label — sem alterar JSX.
  const casoR2 = { tema_id: "tema-uuid-1" };
  assert(
    "contrato: key e label resolvem só com tema_id (sem case_type)",
    getCaseTemaKey(casoR2) === "tema:tema-uuid-1" &&
      getCaseTemaLabel(casoR2, maps) === "Aposentadoria Especial",
  );
}

if (failed > 0) {
  console.error(`\ncase-tema: ${failed} asserção(ões) falharam.`);
  process.exit(1);
}
console.log("case-tema: OK");
