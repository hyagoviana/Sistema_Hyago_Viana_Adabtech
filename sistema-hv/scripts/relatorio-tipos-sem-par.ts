// Lista os tipos de tarefa que existem no SHV e NÃO casaram com nenhum tipo
// HABILITADO do ProJuris — foi o que o Thiago pediu em 24/08:
//   "se tiver tarefas no SHV, que não tem no PROJURIS, se puderem me passar quais
//    seriam pq peço para revisarem novamente".
//
// Para cada um, procura o nome mais parecido entre os habilitados de lá e separa
// em dois grupos: os que provavelmente são o MESMO tipo escrito diferente (basta
// acertar o nome de um dos lados) e os que realmente parecem não existir.
//
// Uso: npx tsx scripts/relatorio-tipos-sem-par.ts

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig, ORG_ID } from "@/lib/distribuicao/sync-core";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Similaridade por palavras em comum (0 a 1), com um reforço importante: quando
 * um nome CONTÉM o outro, é praticamente certo ser o mesmo tipo com rótulo mais
 * completo — "Emenda" × "Emenda à Inicial", "Réplica" × "Réplica à Contestação".
 * Sem isso, esses pares escapavam por pouco do limiar.
 */
function parecido(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  const pa = new Set(na.split(" ").filter(Boolean));
  const pb = new Set(nb.split(" ").filter(Boolean));
  let comuns = 0;
  for (const p of pa) if (pb.has(p)) comuns++;
  return comuns / Math.max(pa.size, pb.size);
}

async function main() {
  const sb = getSupabaseAdmin();
  const client = await buildProjurisClientFromConfig(sb);
  await client.authenticateTryingVariants();

  const r = await client.projurisPostConsulta<{
    tarefaTipoConsultaWs?: Array<Record<string, unknown>>;
  }>("tarefa-tipo/consulta", { quantidadeRegistros: 1000, registroInicial: 0 });
  const doProjuris = (r.tarefaTipoConsultaWs ?? []).map((t) => ({
    codigo: String(t.codigoTarefaTipo ?? ""),
    nome: String(t.nomeTipoTarefa ?? ""),
    habilitado: t.habilitado === true,
    prazo: `${t.prazoPadrao ?? "·"}/${t.prazoFatal ?? "·"}`,
  }));
  const habilitados = doProjuris.filter((t) => t.habilitado);

  const { data } = await sb
    .from("system_task_type_mapping")
    .select("projuris_tipo_codigo, projuris_tipo_descricao, motor_task_type_id, points, active")
    .eq("organization_id", ORG_ID);

  const semPar = (data ?? []).filter((t) => !/^\d+$/.test(String(t.projuris_tipo_codigo ?? "")));

  console.log(`ProJuris: ${doProjuris.length} tipos (${habilitados.length} habilitados)`);
  console.log(`SHV: ${(data ?? []).length} tipos · ${semPar.length} ainda sem vínculo\n`);

  const provaveis: string[] = [];
  const inexistentes: string[] = [];

  for (const t of semPar) {
    const nome = t.projuris_tipo_descricao || t.motor_task_type_id || "?";
    let melhor = { nome: "", codigo: "", score: 0, prazo: "" };
    for (const p of habilitados) {
      const s = parecido(nome, p.nome);
      if (s > melhor.score) melhor = { nome: p.nome, codigo: p.codigo, score: s, prazo: p.prazo };
    }
    if (melhor.score >= 0.5) {
      provaveis.push(
        `  · SHV "${nome}"  ↔  ProJuris "${melhor.nome}" (${melhor.codigo}, prazo ${melhor.prazo})`,
      );
    } else {
      // Existe lá, porém desabilitado?
      const desab = doProjuris.find((p) => !p.habilitado && parecido(nome, p.nome) >= 0.6);
      inexistentes.push(
        `  · "${nome}"${desab ? `  — existe lá como "${desab.nome}", mas DESABILITADO` : ""}`,
      );
    }
  }

  console.log("=".repeat(70));
  console.log("A) MESMO TIPO, NOME DIFERENTE — basta acertar a grafia de um lado");
  console.log("=".repeat(70));
  console.log(provaveis.length ? provaveis.join("\n") : "  (nenhum)");

  console.log("\n" + "=".repeat(70));
  console.log("B) NÃO ENCONTRADOS entre os habilitados do ProJuris");
  console.log("=".repeat(70));
  console.log(inexistentes.length ? inexistentes.join("\n") : "  (nenhum)");

  console.log("\n" + "=".repeat(70));
  console.log("C) HABILITADOS no ProJuris que o SHV ainda não tem");
  console.log("=".repeat(70));
  const nomesShv = new Set((data ?? []).map((t) => norm(t.projuris_tipo_descricao ?? "")));
  const faltando = habilitados.filter((p) => !nomesShv.has(norm(p.nome)));
  console.log(
    faltando.length
      ? faltando.map((p) => `  · ${p.nome} (${p.codigo}, prazo ${p.prazo})`).join("\n")
      : "  (nenhum)",
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
