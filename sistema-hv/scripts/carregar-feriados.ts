// A3 (Thiago, 04/09) — carrega os FERIADOS NACIONAIS no calendário do motor.
//
// "pode carregar os feriados nacionais automaticamente, beleza."
//
// Bloqueio `general` no `system_distribution_calendar` = o motor não distribui
// naquele dia (a mesma régua que já vale para sábado e domingo).
//
// Idempotente e conservador:
//   • não insere data que já tenha bloqueio geral (a tabela ACEITA duplicata,
//     porque a UNIQUE inclui executor_id e NULL não conflita com NULL — este
//     script confere antes em vez de confiar na constraint);
//   • nunca apaga nada: feriado estadual/municipal e recesso, cadastrados à mão,
//     ficam onde estão.
//
// Uso:
//   npx tsx scripts/carregar-feriados.ts                    # dry-run do ano atual + próximo
//   npx tsx scripts/carregar-feriados.ts --commit
//   npx tsx scripts/carregar-feriados.ts --de 2026 --ate 2028 --commit
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";
import { feriadosNacionaisEntre } from "../src/lib/br/feriados";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const arg = (nome: string): number | null => {
  const i = args.indexOf(nome);
  if (i < 0) return null;
  const v = Number(args[i + 1]);
  return Number.isFinite(v) ? v : null;
};

const anoAtual = new Date().getFullYear();
const de = arg("--de") ?? anoAtual;
const ate = arg("--ate") ?? anoAtual + 1;

async function main() {
  const sb = getSupabaseAdmin();
  const feriados = feriadosNacionaisEntre(de, ate);

  // O que já está bloqueado (por qualquer motivo) não é tocado.
  const { data: existentes, error } = await sb
    .from("system_distribution_calendar")
    .select("date")
    .eq("organization_id", ORG_ID)
    .eq("block_type", "general")
    .gte("date", `${de}-01-01`)
    .lte("date", `${ate}-12-31`);
  if (error) throw new Error(`Falha ao ler o calendário: ${error.message}`);

  const jaBloqueadas = new Set(
    ((existentes ?? []) as Array<{ date: string }>).map((r) => String(r.date).slice(0, 10)),
  );

  const aInserir = feriados.filter((f) => !jaBloqueadas.has(f.date));

  console.log(
    `${commit ? "COMMIT" : "DRY-RUN"} · feriados nacionais ${de}–${ate} · ` +
      `${feriados.length} no período · ${jaBloqueadas.size} data(s) já bloqueada(s) · ` +
      `${aInserir.length} a inserir\n`,
  );

  for (const f of aInserir) {
    console.log(`  ${commit ? "+" : "·"} ${f.date}  ${f.nome}${f.movel ? " (móvel)" : ""}`);
  }

  const jaTinham = feriados.filter((f) => jaBloqueadas.has(f.date));
  if (jaTinham.length) {
    console.log(`\n  ${jaTinham.length} já estava(m) no calendário (não duplicamos):`);
    for (const f of jaTinham) console.log(`    = ${f.date}  ${f.nome}`);
  }

  if (!commit) {
    console.log("\nNada foi alterado. Rode com --commit para aplicar.");
    return;
  }

  if (aInserir.length === 0) {
    console.log("\nNada a fazer — o calendário já cobre o período.");
    return;
  }

  const { error: insErr } = await sb.from("system_distribution_calendar").insert(
    aInserir.map((f) => ({
      organization_id: ORG_ID,
      date: f.date,
      block_type: "general",
      executor_id: null,
      // A tabela não tem coluna de descrição; o nome do feriado fica no log.
    })) as never,
  );
  if (insErr) throw new Error(`Falha ao inserir: ${insErr.message}`);

  console.log(`\n✓ ${aInserir.length} feriado(s) inserido(s) como bloqueio geral.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
