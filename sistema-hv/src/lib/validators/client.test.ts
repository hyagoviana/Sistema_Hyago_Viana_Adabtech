// Testes leves rodando como script standalone (npx tsx).
// Não dependem de runner — falha = stderr + exit 1.

import { clientCreateSchema, isValidCnpj, isValidCpf, sanitizeCpfCnpj } from "./client";

let failed = 0;

function assert(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

console.log("CPF — válidos");
assert("390.533.447-05 (formatado)", isValidCpf("390.533.447-05"));
assert("39053344705 (só dígitos)", isValidCpf("39053344705"));
assert("11144477735 (clássico)", isValidCpf("11144477735"));

console.log("\nCPF — inválidos");
assert("vazio", !isValidCpf(""));
assert("123.456.789-00 dígito errado", !isValidCpf("123.456.789-00"));
assert("111.111.111-11 sequência igual", !isValidCpf("111.111.111-11"));
assert("000.000.000-00 sequência zero", !isValidCpf("000.000.000-00"));
assert("muito curto", !isValidCpf("123"));

console.log("\nCNPJ — válidos");
assert("11.222.333/0001-81 (formatado)", isValidCnpj("11.222.333/0001-81"));
assert("11222333000181 (só dígitos)", isValidCnpj("11222333000181"));

console.log("\nCNPJ — inválidos");
assert("11.222.333/0001-00 dígito errado", !isValidCnpj("11.222.333/0001-00"));
assert("11.111.111/1111-11 sequência igual", !isValidCnpj("11.111.111/1111-11"));
assert("muito curto", !isValidCnpj("12345"));

console.log("\nsanitizeCpfCnpj");
assert("remove pontos/traços", sanitizeCpfCnpj("390.533.447-05") === "39053344705");
assert("remove barra CNPJ", sanitizeCpfCnpj("11.222.333/0001-81") === "11222333000181");

console.log("\nclientCreateSchema");
const validInput = clientCreateSchema.safeParse({
  full_name: "Maria Silva",
  cpf_cnpj: "390.533.447-05",
  tipo: "Médico",
  email: "maria@example.com",
  phone: "(82) 99999-9999",
});
assert("input válido aceito", validInput.success);
assert(
  "cpf_cnpj transformado pra canônico",
  validInput.success && validInput.data.cpf_cnpj === "39053344705",
);
assert(
  "phone transformado pra canônico",
  validInput.success && validInput.data.phone === "82999999999",
);

const noName = clientCreateSchema.safeParse({ full_name: "Jo", cpf_cnpj: "39053344705" });
assert("nome muito curto rejeitado", !noName.success);

const badCpf = clientCreateSchema.safeParse({
  full_name: "João Souza",
  cpf_cnpj: "111.111.111-11",
});
assert("CPF sequência igual rejeitado", !badCpf.success);

const emptyEmail = clientCreateSchema.safeParse({
  full_name: "Ana Lima",
  cpf_cnpj: "39053344705",
  email: "",
});
assert("e-mail vazio vira null", emptyEmail.success && emptyEmail.data.email === null);

console.log();
if (failed > 0) {
  console.error(`❌ ${failed} teste(s) falhou(aram).`);
  process.exit(1);
}
console.log("🎉 Todos os testes passaram.");
