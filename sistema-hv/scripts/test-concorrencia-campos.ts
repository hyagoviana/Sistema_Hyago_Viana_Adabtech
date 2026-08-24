// PROVA da correção do "dado que não salvou" (relato da reunião de 19/08).
//
// Simula duas pessoas preenchendo campos DIFERENTES do mesmo caso ao mesmo tempo
// — que é o cenário descrito pelo Thiago (ele e o Pablo mexendo juntos).
//
// Com o código antigo (SELECT → merge em memória → UPDATE do objeto inteiro), o
// segundo a salvar apagava o campo do primeiro. Com o merge atômico no banco, os
// dois sobrevivem.
//
// Roda em um caso REAL, mas usa chaves de teste com prefixo `__teste_concorrencia`
// e as remove no final.
//
// Uso: npx tsx scripts/test-concorrencia-campos.ts

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { updateCaseCanonicalFields } from "@/lib/cases-service";

const K1 = "__teste_concorrencia_a";
const K2 = "__teste_concorrencia_b";

async function main() {
  const sb = getSupabaseAdmin();

  const { data: caso } = await sb
    .from("system_cases")
    .select("id, case_code, canonical_fields")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!caso) throw new Error("nenhum caso para testar");
  console.log(`caso de teste: ${caso.case_code}`);
  const antes = { ...((caso.canonical_fields as Record<string, unknown> | null) ?? {}) };
  console.log(`campos antes: ${Object.keys(antes).length}`);

  // As duas gravações partem JUNTAS — é isso que criava a corrida.
  console.log(`\ndisparando duas gravações simultâneas (campos diferentes)…`);
  await Promise.all([
    updateCaseCanonicalFields(caso.id, { [K1]: "pessoa A" }),
    updateCaseCanonicalFields(caso.id, { [K2]: "pessoa B" }),
  ]);

  const { data: depois } = await sb
    .from("system_cases")
    .select("canonical_fields")
    .eq("id", caso.id)
    .maybeSingle();
  const campos = (depois?.canonical_fields as Record<string, unknown> | null) ?? {};

  const temA = campos[K1] === "pessoa A";
  const temB = campos[K2] === "pessoa B";
  console.log(`  campo da pessoa A sobreviveu: ${temA ? "SIM" : "NÃO"}`);
  console.log(`  campo da pessoa B sobreviveu: ${temB ? "SIM" : "NÃO"}`);

  // Nada do que já existia pode ter sumido.
  const perdidos = Object.keys(antes).filter((k) => !(k in campos));
  console.log(
    `  campos preexistentes perdidos: ${perdidos.length ? perdidos.join(", ") : "nenhum"}`,
  );

  // Limpeza: string vazia remove a chave (regra do merge).
  await updateCaseCanonicalFields(caso.id, { [K1]: "", [K2]: "" });
  const { data: limpo } = await sb
    .from("system_cases")
    .select("canonical_fields")
    .eq("id", caso.id)
    .maybeSingle();
  const final = (limpo?.canonical_fields as Record<string, unknown> | null) ?? {};
  const sobrou = [K1, K2].filter((k) => k in final);
  console.log(
    `\nlimpeza: ${sobrou.length === 0 ? "chaves de teste removidas" : `SOBROU ${sobrou}`}`,
  );
  console.log(
    `campos ao final: ${Object.keys(final).length} (antes eram ${Object.keys(antes).length})`,
  );

  const ok = temA && temB && perdidos.length === 0 && sobrou.length === 0;
  console.log(
    ok
      ? "\n✅ as duas gravações simultâneas sobreviveram — bug corrigido"
      : "\n❌ ainda há perda de dados",
  );
  if (!ok) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
