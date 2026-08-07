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

  // ---- A7 (2026-08-05): unicidade POR TEMA + override do balde do cliente ----

  // 8) scope='caso' com a MESMA key em temaA e temaB → AMBOS criam (unicidade é
  //    por tema; o balde compartilhado do cliente NÃO se aplica a scope='caso').
  console.log("\n[8] A7 — scope='caso' mesma key em temaA e temaB → ambos criam");
  if (temaB) {
    const cA = await createTemaFieldDef({
      temaId: temaA,
      label: `${TAG} MunicipioCaso`,
      type: "text",
      scope: "caso",
    });
    created.push(cA.id);
    let okB = false;
    let bKey = "";
    try {
      const cB = await createTemaFieldDef({
        temaId: temaB,
        label: `${TAG} MunicipioCaso`, // mesma key derivada, OUTRO tema
        type: "text",
        scope: "caso",
      });
      created.push(cB.id);
      bKey = cB.key;
      okB = cB.key === cA.key && cB.tema_id === temaB;
    } catch (err) {
      console.error("    scope='caso' cross-tema recusado indevidamente:", (err as Error).message);
    }
    check("scope='caso' mesma key aceita em outro tema", okB, bKey);

    // 8b) MESMA key no MESMO tema/frente → 409 (índice/pré-check por tema).
    let dupThrew = false;
    let dupStatus = 0;
    try {
      const dup = await createTemaFieldDef({
        temaId: temaA,
        label: `${TAG} MunicipioCaso`, // mesma key, MESMO tema → duplicado
        type: "text",
        scope: "caso",
      });
      created.push(dup.id);
    } catch (err) {
      dupThrew = true;
      dupStatus = (err as { status?: number })?.status ?? 0;
    }
    check("mesma key no mesmo tema recusa (throw)", dupThrew);
    check("mesma key no mesmo tema → 409", dupStatus === 409, dupStatus);
  } else {
    console.log("  ⏭️ pulado (só 1 tema disponível)");
  }

  // 9) scope='cliente', rótulo DIFERENTE, mesma key, outro tema, SEM override → 409;
  //    o MESMO cenário COM allowSharedClientKey=true → cria.
  console.log("\n[9] A7 — scope='cliente' rótulo diferente: 409 sem override, cria com override");
  if (temaB) {
    // base no temaA
    const base = await createTemaFieldDef({
      temaId: temaA,
      label: `${TAG} Regiao`, // key smoke2607_regiao
      type: "text",
      scope: "cliente",
    });
    created.push(base.id);

    // sem override → 409 (rótulo "Região" difere de "Regiao")
    let noOverrideThrew = false;
    let noOverrideStatus = 0;
    try {
      const bad = await createTemaFieldDef({
        temaId: temaB,
        label: `${TAG} Região`, // mesma key, rótulo normalizado diferente
        type: "text",
        scope: "cliente",
      });
      created.push(bad.id);
    } catch (err) {
      noOverrideThrew = true;
      noOverrideStatus = (err as { status?: number })?.status ?? 0;
    }
    check("cliente rótulo diferente sem override recusa (throw)", noOverrideThrew);
    check(
      "cliente rótulo diferente sem override → 409",
      noOverrideStatus === 409,
      noOverrideStatus,
    );

    // com override → cria
    let overrideOk = false;
    try {
      const good = await createTemaFieldDef({
        temaId: temaB,
        label: `${TAG} Região`,
        type: "text",
        scope: "cliente",
        allowSharedClientKey: true,
      });
      created.push(good.id);
      overrideOk = good.scope === "cliente" && good.key === base.key && good.tema_id === temaB;
    } catch (err) {
      console.error("    override recusado indevidamente:", (err as Error).message);
    }
    check("cliente rótulo diferente COM override cria", overrideOk);
  } else {
    console.log("  ⏭️ pulado (só 1 tema disponível)");
  }

  // 10) update: flip para scope='cliente' com rótulo colidindo → 409 sem override;
  //     com override no patch → passa.
  console.log("\n[10] A7 — update override no patch libera a checagem do cliente");
  if (temaB) {
    // base scope='cliente' no temaA — key explícita p/ forçar a colisão do balde.
    const sharedKey = "smoke2607_estado";
    const clientBase = await createTemaFieldDef({
      temaId: temaA,
      key: sharedKey,
      label: `${TAG} Estado civil`,
      type: "text",
      scope: "cliente",
    });
    created.push(clientBase.id);

    // campo scope='caso' no temaB com a MESMA key (não colide em temaB pois é novo
    // lá, e scope='caso' NÃO passa pela checagem do balde do cliente → cria).
    const casoField = await createTemaFieldDef({
      temaId: temaB,
      key: sharedKey,
      label: `${TAG} Estado federativo`, // rótulo normalizado difere do clientBase
      type: "text",
      scope: "caso",
    });
    created.push(casoField.id);

    // flip para cliente SEM override → 409
    let flipThrew = false;
    let flipStatus = 0;
    try {
      await updateTemaFieldDef(casoField.id, { scope: "cliente" });
    } catch (err) {
      flipThrew = true;
      flipStatus = (err as { status?: number })?.status ?? 0;
    }
    check("flip→cliente colidindo sem override recusa (throw)", flipThrew);
    check("flip→cliente colidindo sem override → 409", flipStatus === 409, flipStatus);

    // flip para cliente COM override → passa
    let flipOk = false;
    try {
      const flipped = await updateTemaFieldDef(casoField.id, {
        scope: "cliente",
        allowSharedClientKey: true,
      });
      flipOk = flipped.scope === "cliente";
    } catch (err) {
      console.error("    flip com override recusado indevidamente:", (err as Error).message);
    }
    check("flip→cliente colidindo COM override passa", flipOk);
  } else {
    console.log("  ⏭️ pulado (só 1 tema disponível)");
  }

  // ---- A5 (2026-08-05): initial_occurrences (linhas iniciais <= teto) ----

  // 11) default initial_occurrences=1; text com initial=3 <= max=5 persiste.
  console.log("\n[11] A5 — initial_occurrences: default 1 e persistência (text)");
  const a5default = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} EditalA`,
    type: "text",
    maxOccurrences: 5,
  });
  created.push(a5default.id);
  check(
    "default initial_occurrences=1",
    a5default.initial_occurrences === 1,
    a5default.initial_occurrences,
  );

  const a5set = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} EditalB`,
    type: "text",
    maxOccurrences: 5,
    initialOccurrences: 3,
  });
  created.push(a5set.id);
  check(
    "initial_occurrences=3 <= max=5",
    a5set.initial_occurrences === 3,
    a5set.initial_occurrences,
  );
  check("max_occurrences=5 preservado", a5set.max_occurrences === 5, a5set.max_occurrences);

  // 12) clamp: initial > max → clampa no teto.
  console.log("\n[12] A5 — initial acima do teto clampa no max");
  const a5clamp = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} EditalC`,
    type: "number",
    maxOccurrences: 4,
    initialOccurrences: 10, // > max
  });
  created.push(a5clamp.id);
  check(
    "initial clampado no teto (4)",
    a5clamp.initial_occurrences === 4,
    a5clamp.initial_occurrences,
  );

  // 13) só text/number/date: boolean força initial=1.
  console.log("\n[13] A5 — boolean força initial_occurrences=1");
  const a5bool = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} FlagA5`,
    type: "boolean",
    maxOccurrences: 5,
    initialOccurrences: 3,
  });
  created.push(a5bool.id);
  check(
    "boolean força initial_occurrences=1",
    a5bool.initial_occurrences === 1,
    a5bool.initial_occurrences,
  );

  // 14) update: rebaixar o teto abaixo do initial atual reclampa o initial.
  console.log("\n[14] A5 — rebaixar teto abaixo do initial reclampa (CHECK initial<=max)");
  const a5upd = await updateTemaFieldDef(a5set.id, { maxOccurrences: 2 });
  check("teto rebaixado p/ 2", a5upd.max_occurrences === 2, a5upd.max_occurrences);
  check("initial reclampado p/ <= 2", a5upd.initial_occurrences <= 2, a5upd.initial_occurrences);

  // ---- A4 (2026-08-05): campos DEPENDENTES (pai→filho) ----
  console.log("\n[15] A4 — hierarquia pai→filho→neto e limites (422)");

  // Cria uma cadeia no temaA: raiz(1) → filho(2) → neto(3).
  const root = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} DepMunicipio`,
    type: "text",
  });
  created.push(root.id);
  check("raiz sem pai", root.parent_field_def_id === null, root.parent_field_def_id);

  const child = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} DepPeriodo`,
    type: "text",
    parentFieldDefId: root.id,
  });
  created.push(child.id);
  check(
    "filho grava parent_field_def_id",
    child.parent_field_def_id === root.id,
    child.parent_field_def_id,
  );

  const grand = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} DepDetalhe`,
    type: "text",
    parentFieldDefId: child.id,
  });
  created.push(grand.id);
  check(
    "neto (nível 3) permitido",
    grand.parent_field_def_id === child.id,
    grand.parent_field_def_id,
  );

  // 4º nível (bisneto sob o neto) → 422.
  let depthThrew = false;
  let depthStatus = 0;
  try {
    const bis = await createTemaFieldDef({
      temaId: temaA,
      label: `${TAG} DepBisneto`,
      type: "text",
      parentFieldDefId: grand.id,
    });
    created.push(bis.id);
  } catch (err) {
    depthThrew = true;
    depthStatus = (err as { status?: number })?.status ?? 0;
  }
  check("4º nível recusado (throw)", depthThrew);
  check("4º nível → 422", depthStatus === 422, depthStatus);

  // 3 filhos ok, 4º filho do mesmo pai → 422. (root já tem 1 filho: child.)
  const c2 = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} DepFilho2`,
    type: "text",
    parentFieldDefId: root.id,
  });
  created.push(c2.id);
  const c3 = await createTemaFieldDef({
    temaId: temaA,
    label: `${TAG} DepFilho3`,
    type: "text",
    parentFieldDefId: root.id,
  });
  created.push(c3.id);
  check(
    "3 filhos por pai OK",
    c2.parent_field_def_id === root.id && c3.parent_field_def_id === root.id,
  );

  let childrenThrew = false;
  let childrenStatus = 0;
  try {
    const c4 = await createTemaFieldDef({
      temaId: temaA,
      label: `${TAG} DepFilho4`,
      type: "text",
      parentFieldDefId: root.id,
    });
    created.push(c4.id);
  } catch (err) {
    childrenThrew = true;
    childrenStatus = (err as { status?: number })?.status ?? 0;
  }
  check("4º filho recusado (throw)", childrenThrew);
  check("4º filho → 422", childrenStatus === 422, childrenStatus);

  // Ciclo: fazer o root depender do seu neto → 422.
  let cycleThrew = false;
  let cycleStatus = 0;
  try {
    await updateTemaFieldDef(root.id, { parentFieldDefId: grand.id });
  } catch (err) {
    cycleThrew = true;
    cycleStatus = (err as { status?: number })?.status ?? 0;
  }
  check("ciclo recusado (throw)", cycleThrew);
  check("ciclo → 422", cycleStatus === 422, cycleStatus);

  // Auto-referência → 422.
  let selfThrew = false;
  let selfStatus = 0;
  try {
    await updateTemaFieldDef(child.id, { parentFieldDefId: child.id });
  } catch (err) {
    selfThrew = true;
    selfStatus = (err as { status?: number })?.status ?? 0;
  }
  check("auto-referência recusada (throw)", selfThrew);
  check("auto-referência → 422", selfStatus === 422, selfStatus);

  // Pai em outro tema → 422 (mesmo tema exigido).
  if (temaB) {
    const alien = await createTemaFieldDef({
      temaId: temaB,
      label: `${TAG} DepAlien`,
      type: "text",
    });
    created.push(alien.id);
    let crossThrew = false;
    let crossStatus = 0;
    try {
      const bad = await createTemaFieldDef({
        temaId: temaA,
        label: `${TAG} DepCross`,
        type: "text",
        parentFieldDefId: alien.id,
      });
      created.push(bad.id);
    } catch (err) {
      crossThrew = true;
      crossStatus = (err as { status?: number })?.status ?? 0;
    }
    check("pai de outro tema recusado (throw)", crossThrew);
    check("pai de outro tema → 422", crossStatus === 422, crossStatus);
  }

  // Remover dependência via update (parentFieldDefId: null).
  const unlinked = await updateTemaFieldDef(c3.id, { parentFieldDefId: null });
  check(
    "remover dependência (null)",
    unlinked.parent_field_def_id === null,
    unlinked.parent_field_def_id,
  );
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
