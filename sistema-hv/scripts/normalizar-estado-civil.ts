// S3-02 AC2 — normaliza o estado civil que foi digitado como texto livre.
//
// O campo era `<Input>`, então a mesma coisa foi gravada de formas diferentes —
// no banco hoje: "CASADO", "Solteiro", "solteiro". Isso ia direto para a variável
// do documento, e saía no Word do jeito que estava. O Thiago (desenho 29) pediu
// para virar múltipla escolha; este script arruma o que já existe.
//
// REGRA: só converte o que casa com certeza (comparação sem acento e sem
// maiúscula, aceitando as formas masculina, feminina e com "(a)"). O que não
// casar fica EXATAMENTE como está e sai no relatório — ninguém perde informação
// por causa de uma normalização esperta demais.
//
// Dry-run por padrão:
//   npx tsx scripts/normalizar-estado-civil.ts
//   npx tsx scripts/normalizar-estado-civil.ts --commit
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";

const COMMIT = process.argv.includes("--commit");

/** Sem acento, sem maiúscula, sem espaço sobrando. */
function norm(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

// Cada opção da lista e as grafias que sabemos apontar para ela.
const MAPA: Array<{ destino: string; formas: string[] }> = [
  { destino: "Solteiro(a)", formas: ["solteiro", "solteira", "solteiro(a)", "solteira(o)"] },
  { destino: "Casado(a)", formas: ["casado", "casada", "casado(a)", "casada(o)"] },
  {
    destino: "Divorciado(a)",
    formas: ["divorciado", "divorciada", "divorciado(a)", "divorciada(o)"],
  },
  { destino: "Viúvo(a)", formas: ["viuvo", "viuva", "viuvo(a)", "viuva(o)"] },
  {
    destino: "União estável",
    formas: ["uniao estavel", "uniao-estavel", "uniaoestavel", "convivente"],
  },
  { destino: "Separado(a)", formas: ["separado", "separada", "separado(a)", "separada(o)"] },
];

const POR_FORMA = new Map<string, string>();
for (const m of MAPA) {
  for (const f of m.formas) POR_FORMA.set(norm(f), m.destino);
  // O próprio destino também casa consigo mesmo — assim rodar duas vezes não faz nada.
  POR_FORMA.set(norm(m.destino), m.destino);
}

async function main() {
  console.log(COMMIT ? "\nMODO COMMIT.\n" : "\nDRY-RUN.\n");
  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from("system_clients")
    .select("id, full_name, professional_data")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const clientes = (data ?? []) as Array<{
    id: string;
    full_name: string;
    professional_data: Record<string, unknown> | null;
  }>;

  const converter: Array<{ id: string; nome: string; de: string; para: string }> = [];
  const naoReconhecidos: Array<{ nome: string; valor: string }> = [];
  let jaCertos = 0;

  for (const c of clientes) {
    const pd = c.professional_data;
    if (!pd || typeof pd !== "object") continue;
    const atual = typeof pd.estado_civil === "string" ? pd.estado_civil.trim() : "";
    if (!atual) continue;

    const destino = POR_FORMA.get(norm(atual));
    if (!destino) {
      naoReconhecidos.push({ nome: c.full_name, valor: atual });
      continue;
    }
    if (destino === atual) {
      jaCertos++;
      continue;
    }
    converter.push({ id: c.id, nome: c.full_name, de: atual, para: destino });
  }

  console.log(`${clientes.length} cliente(s) · ${jaCertos} já no formato novo\n`);

  if (converter.length) {
    console.log(`${converter.length} a converter:`);
    for (const c of converter) console.log(`   "${c.de}" → "${c.para}"   (${c.nome})`);
  } else {
    console.log("Nada a converter.");
  }

  if (naoReconhecidos.length) {
    console.log(`\n⚠ ${naoReconhecidos.length} valor(es) que NÃO reconheci — ficam como estão:`);
    for (const n of naoReconhecidos) console.log(`   "${n.valor}"   (${n.nome})`);
    console.log("   Ajuste na mão pela ficha do cliente, ou some a grafia ao MAPA deste script.");
  }

  if (!COMMIT) {
    if (converter.length) console.log("\nRode com --commit para aplicar.");
    return;
  }

  let ok = 0;
  for (const c of converter) {
    // Merge no JSONB pelo lado do banco seria melhor, mas aqui é um campo só e
    // um punhado de linhas; o read-modify-write é feito com o objeto que
    // acabamos de ler, e nada mais escreve em professional_data neste intervalo.
    const alvo = clientes.find((x) => x.id === c.id)!;
    const { error: errUp } = await sb
      .from("system_clients")
      .update({
        professional_data: { ...(alvo.professional_data ?? {}), estado_civil: c.para },
      } as never)
      .eq("id", c.id);
    if (errUp) {
      console.error(`   ✗ ${c.nome}: ${errUp.message}`);
      continue;
    }
    ok++;
  }
  console.log(`\n${ok}/${converter.length} convertido(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
