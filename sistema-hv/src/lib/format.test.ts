// Testes leves rodando como script standalone (npx tsx). Sem runner, SEM banco.
// Falha = stderr + exit 1. Cobre R5-02 (bug B2: RG perdia o último dígito).

import { formatRg } from "./format";

let failed = 0;

function assert(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function eq(label: string, got: string, want: string) {
  assert(`${label} → "${got}" (esperado "${want}")`, got === want);
}

console.log("formatRg — R5-02 (não truncar RG por variação de estado)");

// AC 1 — RG com mais de 9 caracteres úteis preserva TODOS os dígitos.
{
  const out = formatRg("123456789012");
  const digits = out.replace(/\D/g, "");
  assert(`12 dígitos preservados (nenhum truncado) — "${out}"`, digits.length === 12);
  eq("12 dígitos mascara os 9 primeiros + concatena excedente", out, "12.345.678-9012");
}

// AC 1 — 10 dígitos: não perde o 10º.
eq("10 dígitos preserva o último", formatRg("1234567890"), "12.345.678-90");

// AC 2 — padrão comum continua mascarado.
eq("padrão 9 dígitos", formatRg("123456789"), "12.345.678-9");

// máscara progressiva parcial (usuário digitando).
eq("parcial 5 dígitos", formatRg("12345"), "12.345");

// AC 3 — aceita dígito verificador X (normaliza minúsculo p/ maiúsculo).
eq("aceita X como 9º caractere", formatRg("12345678X"), "12.345.678-X");
{
  const out = formatRg("1234567x");
  assert(`"1234567x" mantém o X — "${out}"`, out.includes("X") && !out.includes("x"));
}

// vazio / null-safe.
eq("vazio", formatRg(""), "");

console.log();
if (failed > 0) {
  console.error(`❌ ${failed} teste(s) falhou(aram).`);
  process.exit(1);
}
console.log("🎉 Todos os testes passaram.");
