// S1-05 (reunião 02/09) — cria no CADASTRO DO CLIENTE as defs que só existem no
// TEMA com scope='cliente'.
//
// Thiago: "Essas são informações que eu tinha adicionado como campos
// personalizados de casos (opção campos clientes), e acabaram não ficando junto
// aos outros ali em baixo (…) mesmo estando no tema como 'do cliente', não
// aparece na página de campos do cliente e nem aparece junto aos campos
// adicionais da página cliente."
//
// A bifurcação existia só no sentido cliente→tema. A partir de agora o código faz
// os dois sentidos (ensureClientDefFromTemaDef); este script cuida do que JÁ está
// no banco.
//
// O que faz:  para cada def de tema ativa com scope='cliente' cuja `key` não tem
//             correspondente em system_client_field_defs, cria a def do cliente
//             com a MESMA key (o valor já é compartilhado no balde
//             system_clients.custom_fields — nada é copiado nem migrado).
// O que NÃO faz: não altera def existente, não reativa def oculta, não apaga nada.
//
// Uso:
//   npx tsx scripts/backfill-campos-cliente-do-tema.ts            # dry-run (padrão)
//   npx tsx scripts/backfill-campos-cliente-do-tema.ts --commit   # aplica
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";
import { ensureClientDefFromTemaDef } from "../src/lib/client-fields-service";
import { CLIENT_RESERVED_FIELD_KEYS } from "../src/lib/validators/client";

const commit = process.argv.includes("--commit");

async function main() {
  const sb = getSupabaseAdmin();

  const { data: temaDefs, error } = await sb
    .from("system_tema_field_defs")
    .select(
      "id, key, label, type, options, required, max_occurrences, initial_occurrences, subtitle_mode, subtitles, tema_id",
    )
    .eq("scope", "cliente")
    .eq("active", true)
    .is("deleted_at", null)
    .order("key");
  if (error) throw new Error(`Falha ao listar defs de tema: ${error.message}`);

  const { data: clientDefs } = await sb
    .from("system_client_field_defs")
    .select("key")
    .is("deleted_at", null);
  const jaExiste = new Set((clientDefs ?? []).map((d) => d.key as string));

  // A mesma key pode aparecer em vários temas (é o casamento de key que faz o
  // dado ser único). Uma def de cliente por key, não por tema.
  const porKey = new Map<string, (typeof temaDefs)[number]>();
  // Keys que já são campo PADRÃO do cadastro: não criar (viraria campo duplicado
  // na ficha, com dois valores). Vão para o relatório, para o owner decidir.
  const colidemComPadrao: Array<{ key: string; label: string }> = [];
  for (const d of temaDefs ?? []) {
    const k = d.key as string;
    if (jaExiste.has(k)) continue;
    if (CLIENT_RESERVED_FIELD_KEYS.has(k)) {
      if (!colidemComPadrao.some((c) => c.key === k))
        colidemComPadrao.push({ key: k, label: d.label as string });
      continue;
    }
    if (!porKey.has(k)) porKey.set(k, d);
  }

  console.log(
    `${commit ? "COMMIT" : "DRY-RUN"} · ${temaDefs?.length ?? 0} def(s) de tema com escopo cliente · ` +
      `${porKey.size} a criar · ${colidemComPadrao.length} colidem com campo padrão\n`,
  );

  if (colidemComPadrao.length) {
    console.log("ATENÇÃO — estes já existem como campo PADRÃO do cadastro do cliente:");
    for (const c of colidemComPadrao) {
      console.log(`  ! ${c.key} ("${c.label}") — NÃO criado (evita campo duplicado na ficha)`);
    }
    console.log(
      "  Decisão do owner: usar o campo padrão e remover a def do tema, ou renomear a key.\n",
    );
  }

  let criados = 0;
  let falhas = 0;

  for (const d of porKey.values()) {
    const rotulo = `${d.key} ("${d.label}", ${d.type})`;
    if (!commit) {
      console.log(`· CRIARIA no cadastro do cliente: ${rotulo}`);
      criados++;
      continue;
    }
    try {
      await ensureClientDefFromTemaDef(d as never);
      console.log(`✓ ${rotulo}`);
      criados++;
    } catch (err) {
      falhas++;
      console.error(`! ${rotulo}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `\nResumo (${commit ? "aplicado" : "simulação"}):` +
      `\n  campos criados no cliente ... ${criados}` +
      `\n  já existiam ................. ${(temaDefs?.length ?? 0) - porKey.size}` +
      `\n  falhas ...................... ${falhas}`,
  );
  if (!commit && criados > 0) {
    console.log("\nRode com --commit para aplicar.");
  }
  if (falhas) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
