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
  augmentWithHonorarios,
  buildAutoFillValues,
  formatIntBR,
  formatMoneyBR,
  formatPercentBR,
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

// --- 5. DATA automática (owner 2026-07-21) ---------------------------------
{
  const data: AutoFillData = { clientName: "Fulano", city: "Salvador" };
  const dNum = resolveAutoValue(field("data - obrigatório"), data);
  assert(
    "data genérica → data de hoje (dd/mm/aaaa)",
    typeof dNum === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(dNum),
  );
  const dExt = resolveAutoValue(field("data_extenso"), data);
  assert(
    "data por extenso → contém mês por extenso",
    typeof dExt === "string" && / de [a-zç]+ de \d{4}$/.test(dExt),
  );
  const localData = resolveAutoValue(field("Local e data - obrigatório"), data);
  assert(
    "local e data → prefixa a cidade",
    typeof localData === "string" && localData.startsWith("Salvador, "),
  );
  // Datas ESPECÍFICAS do caso NÃO são tocadas (sem canonical → undefined).
  assert(
    "data da parcela NÃO vira hoje (fica manual)",
    resolveAutoValue(field("data da parcela - obrigatório"), data) === undefined,
  );
  assert(
    "data de retorno NÃO vira hoje (fica manual)",
    resolveAutoValue(field("data de retorno"), data) === undefined,
  );
  // Data canônica gravada no caso prevalece sobre "hoje".
  const comCanon: AutoFillData = { canonical: { Data: "01/01/2020" } };
  assert(
    "data canônica do caso prevalece sobre hoje",
    resolveAutoValue(field("data"), comCanon) === "01/01/2020",
  );
}

// --- 6. Aliases de honorários (owner 2026-07-21) ---------------------------
{
  let data: AutoFillData = { clientName: "Dra. Ana" };
  data = augmentWithHonorarios(data, {
    percentual_honorarios: 20,
    forma_pagamento: "PIX à vista",
    valor_parcela_centavos: null,
    desconto_avista_pct: null,
    honorarios_total_centavos: null,
  });
  assert(
    '"formas de pagamento" (plural) resolve',
    resolveAutoValue(field("formas de pagamento - obrigatório"), data) === "PIX à vista",
  );
  assert(
    '"porcentagem" resolve o % de honorários',
    resolveAutoValue(field("porcentagem - obrigatório"), data) === "20%",
  );
  assert(
    '"porcentagem do êxito" resolve o % de honorários',
    resolveAutoValue(field("porcentagem do êxito - obrigatório"), data) === "20%",
  );
}

// --- 7. AC4 (A7) — FORMATADORES determinísticos por TIPO -------------------
{
  // Percentual pt-BR: inteiro sem casas, fração com vírgula decimal.
  assert("formatPercentBR(15) → '15%'", formatPercentBR(15) === "15%");
  assert("formatPercentBR(12.5) → '12,5%'", formatPercentBR(12.5) === "12,5%");
  assert("formatPercentBR(15.0) → '15%' (sem zeros à direita)", formatPercentBR(15.0) === "15%");
  assert("formatPercentBR(20) → '20%'", formatPercentBR(20) === "20%");
  // Não formata duas vezes: string pt-BR já digitada volta idêntica.
  assert("formatPercentBR('12,5') → '12,5%'", formatPercentBR("12,5") === "12,5%");
  assert("formatPercentBR('15%') → '15%'", formatPercentBR("15%") === "15%");
  assert("formatPercentBR(null) → undefined", formatPercentBR(null) === undefined);
  assert("formatPercentBR('') → undefined", formatPercentBR("") === undefined);

  // Moeda a partir de CENTAVOS inteiros.
  assert("formatMoneyBR(50000) → 'R$ 500,00'", formatMoneyBR(50000) === "R$ 500,00");
  assert("formatMoneyBR(123456) → 'R$ 1.234,56'", formatMoneyBR(123456) === "R$ 1.234,56");
  assert("formatMoneyBR(0) → 'R$ 0,00'", formatMoneyBR(0) === "R$ 0,00");
  assert("formatMoneyBR(99) → 'R$ 0,99'", formatMoneyBR(99) === "R$ 0,99");
  assert("formatMoneyBR(null) → undefined", formatMoneyBR(null) === undefined);

  // Número inteiro (ex.: nº de parcelas).
  assert("formatIntBR(12) → '12'", formatIntBR(12) === "12");
  assert("formatIntBR('12') → '12'", formatIntBR("12") === "12");
  assert("formatIntBR(12.7) → '13' (arredonda)", formatIntBR(12.7) === "13");
  assert("formatIntBR(null) → undefined", formatIntBR(null) === undefined);
}

// --- 8. AC4 (A7) — determinismo: mesmo valor → mesma string ----------------
{
  // Dois casos com os MESMOS valores numéricos geram a MESMA string, seja o
  // percentual armazenado como number ou string pt-BR.
  let a: AutoFillData = { clientName: "Caso A" };
  a = augmentWithHonorarios(a, {
    percentual_honorarios: 15,
    valor_parcela_centavos: 50000,
    honorarios_total_centavos: 600000,
    desconto_avista_pct: null,
    forma_pagamento: null,
  });
  let b: AutoFillData = { clientName: "Caso B" };
  b = augmentWithHonorarios(b, {
    percentual_honorarios: 15,
    valor_parcela_centavos: 50000,
    honorarios_total_centavos: 600000,
    desconto_avista_pct: null,
    forma_pagamento: null,
  });
  const pctA = resolveAutoValue(field("percentual de honorários"), a);
  const pctB = resolveAutoValue(field("percentual de honorários"), b);
  assert("percentual determinístico → '15%'", pctA === "15%");
  assert("mesmo valor → mesma string (percentual)", pctA === pctB);

  const valA = resolveAutoValue(field("valor da parcela"), a);
  assert("valor da parcela → 'R$ 500,00'", valA === "R$ 500,00");
  const totA = resolveAutoValue(field("total de honorários"), a);
  assert("total de honorários → 'R$ 6.000,00'", totA === "R$ 6.000,00");

  // Novos aliases de % êxito (A7 AC4).
  assert(
    '"percentual do êxito" resolve o % de honorários',
    resolveAutoValue(field("percentual do êxito"), a) === "15%",
  );
  assert(
    '"% de êxito" resolve o % de honorários',
    resolveAutoValue(field("% de êxito"), a) === "15%",
  );
}

if (failed > 0) {
  console.error(`\n${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log("\nTodos os testes de document-autofill passaram.");
