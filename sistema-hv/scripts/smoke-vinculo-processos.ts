// Smoke da conferência de vínculo caso ↔ processo.
//
// Confere o que a tela vai mostrar e prova o caminho de gravação num caso real:
// vincula, lê de volta e desfaz — deixando o banco como estava.
//
// Uso: npx tsx scripts/smoke-vinculo-processos.ts

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  desvincularCaso,
  listCasosSemProcesso,
  vincularCasoAoProcesso,
} from "@/lib/distribuicao/vinculo-processos";

async function main() {
  const t0 = Date.now();
  const casos = await listCasosSemProcesso();
  console.log(`${casos.length} casos sem processo (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);

  const com = casos.filter((c) => c.candidatos.length > 0);
  const sem = casos.filter((c) => c.candidatos.length === 0);
  const umSo = com.filter((c) => c.candidatos.length === 1);
  const variosAtivos = com.filter((c) => c.candidatos.filter((p) => !p.encerrado).length > 1);

  console.log(`  com processo do cliente : ${com.length}`);
  console.log(`     um candidato só      : ${umSo.length}`);
  console.log(`     vários ativos        : ${variosAtivos.length}`);
  console.log(`  cliente não está lá     : ${sem.length}`);

  // Quanto a sugestão por tema reduz a escolha.
  const umCombina = com.filter((c) => c.candidatos.filter((p) => p.combinaComTema).length === 1);
  const variosCombinam = com.filter((c) => c.candidatos.filter((p) => p.combinaComTema).length > 1);
  const nenhumCombina = com.filter((c) => !c.candidatos.some((p) => p.combinaComTema));
  console.log(`
sugestão por tema:`);
  console.log(`  um único candidato combina : ${umCombina.length}  <- escolha praticamente feita`);
  console.log(`  vários combinam            : ${variosCombinam.length}`);
  console.log(`  nenhum combina             : ${nenhumCombina.length}`);

  console.log("\namostra do que a tela mostra:");
  for (const c of com.slice(0, 3)) {
    console.log(`\n  ${c.clienteNome} · ${c.caseCode ?? "-"} · ${c.temaNome ?? "-"}`);
    for (const p of c.candidatos.slice(0, 4))
      console.log(
        `     ${(p.identificador ?? String(p.codigo)).padEnd(13)} ${(p.assunto ?? "—").slice(0, 30).padEnd(30)} ${(p.encerrado ? "encerrado" : "ativo").padEnd(10)} ${p.combinaComTema ? "<- combina com o tema" : ""}`,
      );
  }

  // ---- prova de ida e volta ------------------------------------------------
  const alvo = com[0];
  if (!alvo) {
    console.log("\n(sem candidato para testar a gravação)");
    return;
  }
  const proc = alvo.candidatos[0];
  console.log(`\ngravação: ${alvo.caseCode} → ${proc.identificador ?? proc.codigo}`);

  const r = await vincularCasoAoProcesso(alvo.id, proc.codigo);
  const sb = getSupabaseAdmin();
  const { data: depois } = await sb
    .from("system_cases")
    .select("projuris_codigo_processo, projuris_numero_processo")
    .eq("id", alvo.id)
    .maybeSingle();

  const gravouCerto = Number(depois?.projuris_codigo_processo) === proc.codigo;
  console.log(`  gravou   : ${gravouCerto ? "OK" : "FALHOU"} (${r.identificador})`);

  await desvincularCaso(alvo.id);
  const { data: revertido } = await sb
    .from("system_cases")
    .select("projuris_codigo_processo")
    .eq("id", alvo.id)
    .maybeSingle();
  console.log(
    `  desfez   : ${revertido?.projuris_codigo_processo == null ? "OK" : "FALHOU"} (banco como estava)`,
  );

  // Um código inventado não pode passar.
  try {
    await vincularCasoAoProcesso(alvo.id, 999999999);
    console.log("  guarda   : FALHOU — aceitou processo inexistente");
  } catch {
    console.log("  guarda   : OK — recusa processo que não existe");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
