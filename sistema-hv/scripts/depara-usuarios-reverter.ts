// S5-04 AC3 — desfaz um de-para de papéis a partir do snapshot.
//
// O snapshot é gravado por `depara-usuarios-aplicar.ts` ANTES de escrever
// qualquer coisa. Este script devolve cada pessoa ao papel que ela tinha.
//
// Reverter também é mexer no acesso de gente trabalhando: dry-run é o padrão, e
// quem já foi movido para um papel DIFERENTE do que o snapshot registrou é
// deixado em paz — nesse caso alguém decidiu outra coisa depois, e sobrescrever
// apagaria essa decisão.
//
//   npx tsx scripts/depara-usuarios-reverter.ts <snapshot.json>
//   npx tsx scripts/depara-usuarios-reverter.ts <snapshot.json> --commit
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { readFileSync } from "node:fs";

import { getSupabaseAdmin } from "../src/lib/supabase/server";

const ARQUIVO = process.argv[2];
const COMMIT = process.argv.includes("--commit");

if (!ARQUIVO) {
  console.error("Informe o snapshot: npx tsx scripts/depara-usuarios-reverter.ts <json>");
  process.exit(1);
}

async function main() {
  console.log(COMMIT ? "\nMODO COMMIT — vai reverter papéis.\n" : "\nDRY-RUN.\n");

  const snap = JSON.parse(readFileSync(ARQUIVO, "utf8")) as {
    aplicado_em: string;
    planilha: string;
    papeis: Array<{ id: string; nome: string; role_anterior: string; role_novo: string }>;
  };
  console.log(`Snapshot de ${snap.aplicado_em} · ${snap.papeis.length} pessoa(s)\n`);

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_users")
    .select("id, role")
    .in(
      "id",
      snap.papeis.map((p) => p.id),
    );
  if (error) throw new Error(error.message);
  const hoje = new Map(
    ((data ?? []) as Array<{ id: string; role: string }>).map((u) => [u.id, u.role]),
  );

  const reverter: typeof snap.papeis = [];
  const pulados: string[] = [];

  for (const p of snap.papeis) {
    const atual = hoje.get(p.id);
    if (!atual) {
      pulados.push(`${p.nome}: não existe mais no banco`);
      continue;
    }
    if (atual === p.role_anterior) continue; // já está como era
    if (atual !== p.role_novo) {
      pulados.push(
        `${p.nome}: hoje é "${atual}", e o snapshot esperava "${p.role_novo}" — alguém mudou depois, não mexo`,
      );
      continue;
    }
    reverter.push(p);
  }

  if (pulados.length) {
    console.log(`${pulados.length} pulado(s):`);
    for (const p of pulados) console.log(`   ⚠ ${p}`);
    console.log();
  }

  if (!reverter.length) {
    console.log("Nada a reverter.");
    return;
  }

  console.log(`${reverter.length} a reverter:`);
  for (const p of reverter) console.log(`   ${p.nome.padEnd(34)} ${p.role_novo} → ${p.role_anterior}`);

  if (!COMMIT) {
    console.log("\nRode com --commit para aplicar.");
    return;
  }

  let ok = 0;
  for (const p of reverter) {
    const { error: errUp } = await sb
      .from("system_users")
      .update({ role: p.role_anterior } as never)
      .eq("id", p.id);
    if (errUp) {
      console.error(`   ✗ ${p.nome}: ${errUp.message}`);
      continue;
    }
    ok++;
  }
  console.log(`\n${ok}/${reverter.length} revertida(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
