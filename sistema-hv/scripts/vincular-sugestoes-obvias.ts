// Vincula os casos em que a escolha do processo é praticamente única.
//
// Critério estreito de propósito: só entra o caso em que EXATAMENTE UM processo
// do cliente tem assunto conversando com o tema do caso. Onde há dois candidatos
// plausíveis, o script não opina — a decisão é da controladoria, como o Thiago
// definiu ("a gente vai resolver na mão").
//
// Ainda assim isto é uma sugestão automática, então: nada é irreversível. O
// vínculo sai pela mesma tela, e o relatório abaixo diz exatamente o que foi
// feito, caso a caso, para conferência.
//
// Uso:
//   npx tsx scripts/vincular-sugestoes-obvias.ts             (mostra o que faria)
//   npx tsx scripts/vincular-sugestoes-obvias.ts --executar

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { listCasosComProcessos, vincularProcesso } from "@/lib/distribuicao/vinculo-processos";

const EXECUTAR = process.argv.includes("--executar");

async function main() {
  console.log(EXECUTAR ? "MODO: EXECUTAR\n" : "MODO: simulação (use --executar)\n");

  const pendentes = await listCasosComProcessos(true);
  console.log(`${pendentes.length} casos sem processo`);

  const obvios = pendentes
    .map((c) => ({ caso: c, combinam: c.candidatos.filter((p) => p.combinaComTema) }))
    .filter((x) => x.combinam.length === 1);

  console.log(`${obvios.length} com um único candidato que combina com o tema\n`);
  if (!obvios.length) return;

  let ok = 0;
  const falhas: string[] = [];
  const ativos = obvios.filter((x) => !x.combinam[0].encerrado).length;
  console.log(
    `  (${ativos} apontam para processo ativo; ${obvios.length - ativos} para encerrado)\n`,
  );

  for (const { caso, combinam } of obvios) {
    const p = combinam[0];
    const rotulo = `${(caso.caseCode ?? caso.id).padEnd(34)} → ${(p.identificador ?? String(p.codigo)).padEnd(12)} ${(p.assunto ?? "—").slice(0, 26)}`;

    if (!EXECUTAR) {
      console.log(`  ${rotulo}${p.encerrado ? "  (encerrado)" : ""}`);
      continue;
    }

    try {
      await vincularProcesso(caso.id, p.codigo);
      ok++;
      console.log(`  OK  ${rotulo}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      falhas.push(`${caso.caseCode}: ${msg}`);
      console.log(`  --  ${rotulo}  ${msg.slice(0, 60)}`);
    }
  }

  if (!EXECUTAR) {
    console.log("\n(nada foi gravado — rode com --executar)");
    return;
  }

  console.log(`\nvinculados: ${ok} de ${obvios.length}`);
  if (falhas.length) {
    console.log("falhas:");
    for (const f of falhas) console.log(`  ${f}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
