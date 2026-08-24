// Smoke da conferência de vínculo caso ↔ processos do ProJuris.
//
// Cobre o que o modelo novo trouxe (decisão do Thiago em 24/08: um caso pode ter
// VÁRIOS processos): vincular dois no mesmo caso, trocar qual é o principal,
// conferir que a coluna do caso acompanha o principal, buscar por número, e
// desfazer tudo — deixando o banco como estava.
//
// Uso: npx tsx scripts/smoke-vinculo-processos.ts

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  buscarProcessoPorNumero,
  definirPrincipal,
  desvincularProcesso,
  listCasosComProcessos,
  vincularProcesso,
} from "@/lib/distribuicao/vinculo-processos";

const sb = getSupabaseAdmin();
let falhas = 0;

function checa(rotulo: string, ok: boolean, detalhe = "") {
  console.log(`  ${ok ? "OK    " : "FALHOU"} ${rotulo}${detalhe ? "  " + detalhe : ""}`);
  if (!ok) falhas++;
}

/** O que a coluna do caso está apontando agora. */
async function principalDoCaso(casoId: string): Promise<number | null> {
  const { data } = await sb
    .from("system_cases")
    .select("projuris_codigo_processo")
    .eq("id", casoId)
    .maybeSingle();
  const v = Number(data?.projuris_codigo_processo);
  return Number.isFinite(v) && v > 0 ? v : null;
}

async function main() {
  const t0 = Date.now();
  const pendentes = await listCasosComProcessos(true);
  console.log(`${pendentes.length} casos sem processo (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  const com2 = pendentes.filter((c) => c.candidatos.length >= 2);
  const semNenhum = pendentes.filter((c) => c.candidatos.length === 0);
  const umCombina = pendentes.filter(
    (c) => c.candidatos.filter((p) => p.combinaComTema).length === 1,
  );
  console.log(`  com 2+ candidatos        : ${com2.length}`);
  console.log(`  sugestão única pelo tema : ${umCombina.length}`);
  console.log(`  sem candidato pelo nome  : ${semNenhum.length}  (usar busca por número)`);

  const todos = await listCasosComProcessos(false);
  const comVinculo = todos.filter((c) => c.vinculados.length > 0);
  console.log(`  casos já com processo    : ${comVinculo.length}`);
  console.log(
    `  com MAIS DE UM processo  : ${comVinculo.filter((c) => c.vinculados.length > 1).length}`,
  );

  // ---- busca por número ----------------------------------------------------
  console.log("\nbusca por número:");
  const algum = comVinculo[0]?.vinculados[0];
  if (algum?.identificador) {
    const achados = await buscarProcessoPorNumero(algum.identificador);
    checa(
      `procurar por "${algum.identificador}"`,
      achados.some((p) => p.codigo === algum.codigo),
      `${achados.length} resultado(s)`,
    );
  }
  if (algum?.numeroCnj) {
    const achados = await buscarProcessoPorNumero(algum.numeroCnj);
    checa(
      "procurar pelo número CNJ",
      achados.some((p) => p.codigo === algum.codigo),
      `${achados.length} resultado(s)`,
    );
  }
  checa("termo curto não busca", (await buscarProcessoPorNumero("ab")).length === 0);

  // ---- vincular dois no mesmo caso ----------------------------------------
  const alvo = com2[0];
  if (!alvo) {
    console.log("\n(nenhum caso com 2+ candidatos para testar)");
    return;
  }
  const [p1, p2] = alvo.candidatos;
  console.log(`\nvínculo múltiplo em ${alvo.caseCode} (${alvo.clienteNome.slice(0, 24)}):`);

  const v1 = await vincularProcesso(alvo.id, p1.codigo);
  checa("primeiro nasce principal", v1.principal);
  checa("coluna do caso acompanha", (await principalDoCaso(alvo.id)) === p1.codigo);

  const v2 = await vincularProcesso(alvo.id, p2.codigo);
  checa("segundo NÃO vira principal", !v2.principal);
  checa("coluna continua no primeiro", (await principalDoCaso(alvo.id)) === p1.codigo);

  const depois = (await listCasosComProcessos(false)).find((c) => c.id === alvo.id);
  checa("caso mostra os dois", depois?.vinculados.length === 2);
  checa("principal vem primeiro", depois?.vinculados[0]?.principal === true);
  checa(
    "candidatos não repetem o que já entrou",
    !depois?.candidatos.some((c) => c.codigo === p1.codigo || c.codigo === p2.codigo),
  );

  // ---- trocar o principal --------------------------------------------------
  await definirPrincipal(alvo.id, p2.codigo);
  checa("coluna segue o novo principal", (await principalDoCaso(alvo.id)) === p2.codigo);
  const { count: quantosPrincipais } = await sb
    .from("system_case_projuris_processos")
    .select("*", { count: "exact", head: true })
    .eq("case_id", alvo.id)
    .eq("principal", true);
  checa("só um principal por caso", quantosPrincipais === 1);

  // ---- guardas -------------------------------------------------------------
  let recusouRepetido = false;
  try {
    await vincularProcesso(alvo.id, p1.codigo);
  } catch {
    recusouRepetido = true;
  }
  checa("recusa vincular o mesmo duas vezes", recusouRepetido);

  let recusouInventado = false;
  try {
    await vincularProcesso(alvo.id, 999999999);
  } catch {
    recusouInventado = true;
  }
  checa("recusa processo que não existe", recusouInventado);

  // ---- desfazer ------------------------------------------------------------
  await desvincularProcesso(alvo.id, p2.codigo);
  checa("ao tirar o principal, o outro assume", (await principalDoCaso(alvo.id)) === p1.codigo);
  await desvincularProcesso(alvo.id, p1.codigo);
  checa("sem processos, a coluna zera", (await principalDoCaso(alvo.id)) === null);

  console.log(falhas === 0 ? "\nTUDO OK — banco como estava" : `\n${falhas} FALHA(S)`);
  if (falhas) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
