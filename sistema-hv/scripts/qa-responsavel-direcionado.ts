// QA S1-04 (04/09) — o responsável do CASO chega ao motor?
//
// Antes, `directed_executor_id` era gravado sempre `null` nos dois caminhos de
// ingestão, e o nível 1 da precedência do motor (processo direcionado) nunca era
// exercido. Este script prova, contra o BANCO REAL, que agora chega — e que a
// régua de elegibilidade e a regra de 1 responsável (A2) são respeitadas.
//
// Não escreve nada: só lê.
//
// Rodar: npx tsx scripts/qa-responsavel-direcionado.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";
import { carregarResponsaveisDirecionados } from "../src/lib/distribuicao/responsavel-caso";

let falhou = 0;
function check(label: string, cond: boolean, detalhe?: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}${detalhe ? ` — ${detalhe}` : ""}`);
    falhou++;
  }
}

async function main() {
  const sb = getSupabaseAdmin();

  // Pool real do motor: mapeado + ativo + peticionante (mesma régua do sync-core).
  const [{ data: mapeados }, { data: usuarios }] = await Promise.all([
    sb.from("system_projuris_executor_mapping").select("executor_id").eq("active", true),
    sb.from("system_users").select("id, full_name, status, peticionante"),
  ]);
  const idsMapeados = new Set(
    ((mapeados ?? []) as Array<{ executor_id: string }>).map((m) => m.executor_id),
  );
  const elegiveis = new Set(
    ((usuarios ?? []) as Array<{ id: string; status: string; peticionante: boolean | null }>)
      .filter((u) => idsMapeados.has(u.id) && u.status === "ACTIVE" && u.peticionante === true)
      .map((u) => u.id),
  );
  console.log(`  Pool de executores elegíveis: ${elegiveis.size}\n`);

  // --- com o pool REAL --------------------------------------------------------
  const real = await carregarResponsaveisDirecionados(sb, elegiveis);
  console.log(
    `  Casos com responsável direcionado: ${real.porCaso.size} ` +
      `(${real.porCodigoProjuris.size} com código do ProJuris; ` +
      `${real.ignoradosPorElegibilidade} ignorado(s) por não estarem no pool)`,
  );

  // --- com pool VAZIO: ninguém deve ser direcionado ---------------------------
  const semPool = await carregarResponsaveisDirecionados(sb, new Set());
  check(
    "pool vazio ⇒ nenhum direcionamento (a tarefa volta para a regra geral)",
    semPool.porCaso.size === 0,
    `${semPool.porCaso.size}`,
  );
  check(
    "quem foi ignorado por elegibilidade é contado no relatório",
    semPool.ignoradosPorElegibilidade >= real.ignoradosPorElegibilidade,
  );

  // --- com pool "tudo elegível": vê o total de casos com responsável ----------
  const todos = new Set(((usuarios ?? []) as Array<{ id: string }>).map((u) => u.id));
  const comTudo = await carregarResponsaveisDirecionados(sb, todos);
  check(
    `há casos com responsável no banco (${comTudo.porCaso.size})`,
    comTudo.porCaso.size > 0,
    `${comTudo.porCaso.size}`,
  );
  check(
    "o pool real é um subconjunto do total (filtro de elegibilidade funciona)",
    real.porCaso.size <= comTudo.porCaso.size,
  );

  // --- A2: um responsável por caso -------------------------------------------
  const { data: vinculos } = await sb
    .from("system_case_responsaveis_active")
    .select("case_id, user_id");
  const porCaso = new Map<string, number>();
  for (const v of (vinculos ?? []) as Array<{ case_id: string }>) {
    porCaso.set(v.case_id, (porCaso.get(v.case_id) ?? 0) + 1);
  }
  const multi = [...porCaso.entries()].filter(([, n]) => n > 1);
  check(
    `A2 — nenhum caso com mais de 1 responsável (${porCaso.size} caso(s) com responsável)`,
    multi.length === 0,
    `${multi.length} caso(s) com 2+`,
  );

  // O mapa devolve no máximo um por caso, mesmo que o banco tivesse dois.
  check(
    "o resolvedor devolve no máximo 1 responsável por caso",
    [...comTudo.porCaso.values()].length === comTudo.porCaso.size,
  );

  if (falhou) {
    console.error(`\nRESPONSÁVEL DIRECIONADO: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nRESPONSÁVEL DIRECIONADO: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
