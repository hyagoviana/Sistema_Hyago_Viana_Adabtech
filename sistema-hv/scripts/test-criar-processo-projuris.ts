// ⚠️ ESCREVE NO PROJURIS DE PRODUÇÃO — cria UM processo judicial de teste.
//
// Autorizado pelo Thiago em 31/08, com o CNJ que ele mesmo indicou para o teste:
// "pode testar/criar um novo processo lá com esse número CNJ
//  0780463-57.2026.8.07.0016. Depois que a gente concluir os testes, vamos
//  alterar e excluir na mão, sem problemas."
// Valida o contrato do `POST /processo-judicial` ponta a ponta. Não roda sozinho
// em lugar nenhum: é um script de mão, e cada execução cria um registro real.
//
// Cuidados embutidos:
//   · o processo nasce com nome/assunto marcados como TESTE + carimbo de data,
//     para ser achado e apagado depois sem dúvida sobre o que é;
//   · exige a variável CONFIRMA=SIM — rodar sem ela só faz o dry-run;
//   · imprime o código devolvido e relê o processo por GET, para provar que
//     chegou lá do jeito certo (e para vocês terem o código na mão).
//
// Uso:
//   npx tsx scripts/test-criar-processo-projuris.ts            # dry-run
//   CONFIRMA=SIM npx tsx scripts/test-criar-processo-projuris.ts   # cria mesmo
import { config } from "dotenv";

config({ path: ".env.local" });

import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";
import {
  montarProcessoJudicial,
  type NovoProcessoJudicial,
} from "../src/lib/projuris/criar-processo.js";

type Lista = {
  simpleDto?: Array<{ chave: number; valor: string }>;
  nodeWs?: Array<{ chave: number; valor: string }>;
};

const CONFIRMA = process.env.CONFIRMA === "SIM";

/** Acha um item pelo nome dentro da lista (case-insensitive), ou o primeiro. */
function escolher(lista: Lista | undefined, preferido?: RegExp) {
  const itens = lista?.simpleDto ?? lista?.nodeWs ?? [];
  if (preferido) {
    const achado = itens.find((i) => preferido.test(i.valor ?? ""));
    if (achado) return achado;
  }
  return itens[0];
}

async function main() {
  const client = createProjurisClientFromEnv();
  await client.authenticateTryingVariants();
  console.log("Autenticado no ProJuris.\n");

  // ── listas reais, para o corpo sair com chaves válidas ────────────────────
  const areas = await client.projurisGet<Lista>("processo/area");
  const justicas = await client.projurisGet<Lista>("processo/captura/dados-auxiliar/justica");
  const situacoes = await client.projurisGet<Lista>("processo/situacao");
  const classes = await client.projurisGet<Lista>("processo/classe");
  const assuntos = await client.projurisGet<Lista>("processo/assunto");

  const area = escolher(areas, /administrativa|c[íi]vel/i);
  const justica = escolher(justicas, /justi[çc]a federal/i);
  const situacao = escolher(situacoes, /aguardando/i);
  const classe = escolher(classes);
  const assunto = escolher(assuntos, /administrativo/i);

  console.log("Escolhas:");
  console.log(`  área      ${area?.chave} — ${area?.valor}`);
  console.log(`  justiça   ${justica?.chave} — ${justica?.valor}`);
  console.log(`  situação  ${situacao?.chave} — ${situacao?.valor}`);
  console.log(`  classe    ${classe?.chave} — ${classe?.valor}`);
  console.log(`  assunto   ${assunto?.chave} — ${assunto?.valor}\n`);

  // Carimbo para achar e apagar depois sem ambiguidade.
  const carimbo = new Date().toISOString().slice(0, 16).replace("T", " ");
  // CNJ indicado pelo Thiago para o teste (31/08).
  const CNJ_DO_TESTE = process.env.CNJ ?? "0780463-57.2026.8.07.0016";
  const entrada: NovoProcessoJudicial = {
    numeroCnj: CNJ_DO_TESTE,
    nomePasta: `ZZ TESTE SHV — APAGAR (${carimbo})`,
    assunto: `TESTE DE INTEGRACAO SHV — pode apagar (${carimbo})`,
    codigoArea: area?.chave ?? null,
    codigoJustica: justica?.chave ?? null,
    codigoSituacao: situacao?.chave ?? null,
    codigoClasseCnj: classe?.chave ?? null,
    codigoAssuntoCnj: assunto?.chave ?? null,
    codigoExterno: "TESTE-SHV-31-08",
  };

  console.log(`  CNJ       ${CNJ_DO_TESTE}
`);

  const corpo = montarProcessoJudicial(entrada);
  console.log("Corpo do POST /processo-judicial:");
  console.log(JSON.stringify(corpo, null, 2));

  if (!CONFIRMA) {
    console.log("\n⏸  DRY-RUN. Nada foi enviado.");
    console.log(
      "   Para criar de verdade: CONFIRMA=SIM npx tsx scripts/test-criar-processo-projuris.ts",
    );
    return;
  }

  console.log("\n🚀 Enviando (cria registro REAL no ProJuris)…");
  try {
    const resp = await client.projurisPostConsulta<Record<string, unknown>>(
      "processo-judicial",
      corpo,
    );
    console.log("✅ Resposta:", JSON.stringify(resp).slice(0, 400));

    const codigo =
      (resp?.codigoProcesso as number | string | undefined) ??
      (resp?.chave as number | string | undefined);
    if (codigo) {
      console.log(`\n🔎 Relendo GET /processo/${codigo} para confirmar…`);
      const lido = await client.projurisGet<Record<string, unknown>>(`processo/${codigo}`);
      const campos = [
        "identificador",
        "nomePasta",
        "assunto",
        "area",
        "tipoJustica",
        "situacaoProcesso",
      ];
      for (const c of campos) {
        console.log(`   ${c.padEnd(20)} ${JSON.stringify(lido?.[c])?.slice(0, 90)}`);
      }
      console.log(
        `\n📌 GUARDE: processo de teste criado com código ${codigo}. Apague pelo ProJuris.`,
      );
    }
  } catch (err) {
    console.error("\n❌ Falhou:", err instanceof Error ? err.message : err);
    console.error("   O erro acima é o contrato reclamando — é o que faltava descobrir.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
