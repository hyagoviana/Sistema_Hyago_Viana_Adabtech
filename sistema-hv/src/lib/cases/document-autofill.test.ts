// Testes leves rodando como script standalone (npx tsx). Sem runner, SEM banco.
// Falha = stderr + exit 1. Cobre R5-08 (D1-D4): autofill de documentos.
//
// Regras verificadas:
//  1. Placeholder SEM fonte de dado → undefined (NUNCA o token literal "<...>").
//     buildAutoFillValues descarta undefined, logo o token não vira "<x>".
//  2. Qualquer placeholder cujo rótulo case (normalizado) com uma chave de
//     canonical_fields é resolvido pelo valor do campo do caso.
//  3. Aliases de saúde (Unidade/Posto/UBS, CBO, CNES) resolvem mesmo quando a
//     redação do modelo difere do rótulo gravado no caso.

import {
  buildAutoFillValues,
  resolveAutoValue,
  type AutoFillData,
  type TemplateField,
} from "./document-autofill";

let failed = 0;

function assert(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function field(key: string, extra?: Partial<TemplateField>): TemplateField {
  return { key, label: key, source: "auto", ...extra };
}

console.log("document-autofill (R5-08):");

// --- 1. Placeholder sem fonte → undefined, nunca literal --------------------
{
  const data: AutoFillData = { clientName: "Fulano" };
  const v = resolveAutoValue(field("campo inexistente xyz"), data);
  assert("placeholder sem fonte → resolveAutoValue undefined", v === undefined);

  const out = buildAutoFillValues([field("campo inexistente xyz")], data);
  assert(
    "placeholder sem fonte → ausente do mapa (nunca token literal)",
    !("campo inexistente xyz" in out),
  );
  assert(
    "buildAutoFillValues nunca produz valor com '<' literal",
    Object.values(out).every((val) => !val.includes("<")),
  );
}

// --- 2. Canonical resolve por rótulo (nome normalizado) ---------------------
{
  const data: AutoFillData = {
    clientName: "Dra. Ana",
    canonical: { "Carga Horária": "40h semanais", "Período trabalhado": "2020-2024" },
  };
  assert(
    "canonical casa por rótulo (Carga Horária)",
    resolveAutoValue(field("Carga Horária"), data) === "40h semanais",
  );
  assert(
    "canonical casa ignorando acento/caixa (periodo trabalhado)",
    resolveAutoValue(field("periodo trabalhado"), data) === "2020-2024",
  );
  assert(
    "canonical casa ignorando sufixo obrigatório",
    resolveAutoValue(field("Carga Horária - obrigatório"), data) === "40h semanais",
  );
}

// --- 3. Aliases de saúde (Unidade/Posto/UBS, CBO, CNES) ---------------------
{
  const data: AutoFillData = {
    clientName: "Dr. Beto",
    canonical: {
      "Unidade de Saúde": "ESF Centro",
      CBO: "225142",
      CNES: "3481220",
    },
  };
  // placeholder com redação DIFERENTE do rótulo canônico
  assert(
    'alias "Posto de Saúde" → canonical "Unidade de Saúde"',
    resolveAutoValue(field("Posto de Saúde"), data) === "ESF Centro",
  );
  assert(
    'alias "UBS" → canonical "Unidade de Saúde"',
    resolveAutoValue(field("UBS"), data) === "ESF Centro",
  );
  assert("alias CBO resolve", resolveAutoValue(field("CBO"), data) === "225142");
  assert("alias CNES resolve", resolveAutoValue(field("CNES"), data) === "3481220");
}

// --- 4. Alias sem dado no caso → undefined (não vaza literal) ---------------
{
  const data: AutoFillData = { clientName: "Dr. Sem Vínculo", canonical: {} };
  assert(
    "alias sem dado no caso → undefined",
    resolveAutoValue(field("Posto de Saúde"), data) === undefined,
  );
}

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log("\nTodos os testes de document-autofill passaram.");
