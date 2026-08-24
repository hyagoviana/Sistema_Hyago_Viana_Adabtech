// Completa os vínculos que vieram do backfill da migration 20260824000010.
//
// Aquele backfill só tinha o que estava na coluna do caso: o código do processo
// e o número CNJ. Faltam o identificador (PRO.0005235) e o assunto — que são
// justamente o que a pessoa reconhece na tela e o que a busca por texto procura.
//
// Idempotente: só toca em linha com identificador vazio.
//
// Uso:
//   npx tsx scripts/enriquecer-vinculos-processos.ts             (diagnóstico)
//   npx tsx scripts/enriquecer-vinculos-processos.ts --executar

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig, ORG_ID } from "@/lib/distribuicao/sync-core";

const EXECUTAR = process.argv.includes("--executar");

async function main() {
  const sb = getSupabaseAdmin();

  const { data: vazios, error } = await sb
    .from("system_case_projuris_processos")
    .select("id, codigo_processo, numero_cnj")
    .eq("organization_id", ORG_ID)
    .is("identificador", null);
  if (error) throw new Error(error.message);

  console.log(`${vazios?.length ?? 0} vínculos sem identificador`);
  if (!vazios?.length) return;

  // Listagem completa do ProJuris, indexada por código.
  const client = await buildProjurisClientFromConfig(sb);
  await client.authenticateTryingVariants();

  const porCodigo = new Map<number, { identificador: string | null; assunto: string | null }>();
  for (let pagina = 1; pagina <= 60; pagina++) {
    const r = await client.projurisPostConsulta<{
      processoConsultaResumoWs?: Array<Record<string, unknown>>;
    }>("v2/processo/consulta", {}, { pagina, "quan-registros": 200 });
    const lote = r.processoConsultaResumoWs ?? [];
    if (!lote.length) break;
    for (const p of lote)
      porCodigo.set(Number(p.codigoProcesso), {
        identificador: typeof p.identificador === "string" ? p.identificador : null,
        assunto: typeof p.assunto === "string" ? p.assunto : null,
      });
    if (lote.length < 200) break;
  }
  console.log(`ProJuris: ${porCodigo.size} processos na listagem\n`);

  let achados = 0;
  let semPar = 0;
  let gravados = 0;

  for (const v of vazios) {
    const p = porCodigo.get(Number(v.codigo_processo));
    if (!p) {
      semPar++;
      continue;
    }
    achados++;
    if (achados <= 4)
      console.log(`  ${v.codigo_processo} → ${p.identificador}  ${(p.assunto ?? "").slice(0, 34)}`);
    if (!EXECUTAR) continue;

    const { error: upErr } = await sb
      .from("system_case_projuris_processos")
      .update({ identificador: p.identificador, assunto: p.assunto } as never)
      .eq("id", v.id);
    if (upErr) {
      console.log(`  x ${v.codigo_processo}: ${upErr.message}`);
      continue;
    }
    gravados++;
  }

  console.log(`\n  encontrados no ProJuris : ${achados}`);
  console.log(`  sem par lá              : ${semPar}  (processo apagado ou fora da listagem)`);
  if (EXECUTAR) console.log(`  gravados                : ${gravados}`);
  else console.log("\n(nada gravado — rode com --executar)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
