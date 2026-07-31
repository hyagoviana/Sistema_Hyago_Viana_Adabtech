// Smoke test das melhorias de CAMPOS por TEMA (reunião 2026-07-29): colunas novas
// (scope / hidden_in_list / max_occurrences), normalização de max_occurrences e o
// GUARD de colisão de chave no balde do cliente (scope='cliente').
//
// Exercita o service REAL contra o banco (dev=prod). Cria defs de TESTE com
// rótulos únicos e faz SOFT-DELETE de tudo no final (finally) — footprint mínimo
// e reversível. NÃO toca em dados reais.
//
// Uso: npx tsx scripts/smoke-tema-fields.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import {
  createTemaFieldDef,
  deleteTemaFieldDef,
  listTemaFieldDefsAdmin,
  updateTemaFieldDef,
} from "../src/lib/tema-field-defs-service";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    pass++;
  } else {
    console.error(`  ❌ ${name}`, extra ?? "");
    fail++;
  }
}

const TAG = "SMOKE2607"; // marcador (sem underscore: toKey removeria _ ao reprocessar)
const created: string[] = [];

async function main() {
  const sb = getSupabaseAdmin();

  // Pega até 2 temas ativos (o 2º permite testar colisão cross-tema, já que a
  // unicidade dentro do MESMO tema dispararia antes do guard).
  const { data: temas } = await sb.from("system_temas_active").select("id, name").limit(2);
  if (!temas || temas.length === 0) {
    console.error("Sem temas ativos — não dá para rodar o smoke.");
    process.exit(2);
  }
  const temaA = temas[0].id;
  const temaB = temas[1]?.id ?? null;
  console.log(`Tema A: ${temas[0].name}${temaB ? ` | Tema B: ${temas[1].name}` : " (só 1 tema)"}`);

  // 1) scope='cliente' + max_occurrences (text) + hidden_in_list persistem.
  console.log("\n[1] Criar campo scope='cliente', text, 3 ocorrências, oculto na lista");
  // Rótulo "Nacao" → key "smoke2607_nacao". O teste de colisão usa "Nação" (mesmo
  // key após transliteração ç→c/ã→a, mas rótulo normalizado diferente).
  const f1 = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} Nacao`,
    type: "text",
    scope: "cliente",
    maxOccurrences: 3,
    hiddenInList: true,
  });
  created.push(f1.id);
  check("scope='cliente'", f1.scope === "cliente", f1.scope);
  check("max_occurrences=3", f1.max_occurrences === 3, f1.max_occurrences);
  check("hidden_in_list=true", f1.hidden_in_list === true, f1.hidden_in_list);

  // 2) max_occurrences respeita o tipo: boolean NÃO aceita >1 → trava em 1.
  console.log("\n[2] boolean com maxOccurrences=5 deve travar em 1");
  const f2 = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} Ativo`,
    type: "boolean",
    maxOccurrences: 5,
  });
  created.push(f2.id);
  check("boolean força max_occurrences=1", f2.max_occurrences === 1, f2.max_occurrences);
  check("default scope='caso'", f2.scope === "caso", f2.scope);

  // 3) number com 5 ocorrências (tipo permitido).
  console.log("\n[3] number com maxOccurrences=5");
  const f3 = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} Periodo`,
    type: "number",
    maxOccurrences: 5,
  });
  created.push(f3.id);
  check("number aceita max_occurrences=5", f3.max_occurrences === 5, f3.max_occurrences);

  // 4) GUARD de colisão: mesma key, scope='cliente', RÓTULO DIFERENTE, em OUTRO
  //    tema → deve recusar (409). Precisa de 2 temas.
  console.log("\n[4] Guard de colisão (mesmo key derivado, rótulo diferente, outro tema)");
  if (temaB) {
    let threw = false;
    let status = 0;
    try {
      const bad = await createTemaFieldDef({
        temaId: temaB,
        label: `${TAG} Nação`, // key = smoke2607_nacao (= f1), mas rótulo difere
        type: "text",
        scope: "cliente",
      });
      created.push(bad.id); // não deveria chegar aqui
    } catch (err) {
      threw = true;
      status = (err as { status?: number })?.status ?? 0;
    }
    check("recusou colisão (throw)", threw);
    check("status 409", status === 409, status);
  } else {
    console.log("  ⏭️ pulado (só 1 tema disponível)");
  }

  // 5) REUSO legítimo: mesma key, scope='cliente', MESMO rótulo, em outro tema →
  //    deve PERMITIR (mesmo dado da pessoa).
  console.log("\n[5] Reuso do mesmo conceito (mesmo key + mesmo rótulo, outro tema) deve permitir");
  if (temaB) {
    let ok = false;
    try {
      const reuse = await createTemaFieldDef({
        temaId: temaB,
        label: `${TAG} Nacao`, // MESMO rótulo do f1 → mesmo key → reuso permitido
        type: "text",
        scope: "cliente",
      });
      created.push(reuse.id);
      ok = reuse.scope === "cliente" && reuse.key === f1.key;
    } catch (err) {
      console.error("    erro inesperado:", (err as Error).message);
    }
    check("permitiu reuso do mesmo conceito", ok);
  } else {
    console.log("  ⏭️ pulado (só 1 tema disponível)");
  }

  // 6) update: flip para scope='cliente' colidindo deve recusar; e leitura admin
  //    expõe as colunas novas.
  console.log("\n[6] Leitura admin expõe colunas novas");
  const admin = await listTemaFieldDefsAdmin(temaA);
  const f1Read = admin.find((d) => d.id === f1.id);
  check("read traz scope", f1Read?.scope === "cliente", f1Read?.scope);
  check("read traz max_occurrences", f1Read?.max_occurrences === 3, f1Read?.max_occurrences);
  check("read traz hidden_in_list", f1Read?.hidden_in_list === true, f1Read?.hidden_in_list);

  // 7) update normaliza max_occurrences ao trocar de tipo.
  console.log("\n[7] update text→boolean normaliza max_occurrences para 1");
  const f3u = await updateTemaFieldDef(f3.id, { type: "boolean" });
  check("f3 virou boolean com max_occurrences=1", f3u.max_occurrences === 1, f3u.max_occurrences);
}

main()
  .catch((err) => {
    console.error("\nERRO no smoke:", err instanceof Error ? err.message : err);
    fail++;
  })
  .finally(async () => {
    // Cleanup: soft-delete de tudo que foi criado.
    console.log(`\nLimpando ${created.length} def(s) de teste…`);
    for (const id of created) {
      try {
        await deleteTemaFieldDef(id);
      } catch (e) {
        console.error(`  falha ao limpar ${id}:`, (e as Error).message);
      }
    }
    console.log(`\nRESULTADO: ${pass} passou, ${fail} falhou.`);
    process.exit(fail > 0 ? 1 : 0);
  });
