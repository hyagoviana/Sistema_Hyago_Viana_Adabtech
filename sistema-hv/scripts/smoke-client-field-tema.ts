// Smoke test da Story B1 (reunião 2026-08-05): campo do CLIENTE espelhado no(s)
// CASO(s). Exercita o service REAL contra o banco (dev=prod):
//   (a) criar campo do cliente com appears_in_cases=true;
//   (b) vincular a T1+T2 → 2 defs-espelho scope='cliente' com a MESMA key;
//   (c) gravar valor no cliente → lido pelos 2 temas (mesmo balde/mesma key);
//   (d) desvincular T2 → def-espelho de T2 OCULTA (active=false), valor intacto;
//   (e) key-conflito de conceito diferente barrado.
// Cleanup por SOFT-DELETE no finally.
//
// Uso: npx tsx scripts/smoke-client-field-tema.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import {
  createFieldDef,
  deleteFieldDef,
  listClientFieldTemaLinks,
  reconcileClientFieldTemaLinks,
} from "../src/lib/client-fields-service";
import { getSupabaseAdmin } from "../src/lib/supabase/server";
import { createTemaFieldDef } from "../src/lib/tema-field-defs-service";

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

// Tag ÚNICA por execução — evita colisão de key entre rodadas (a def-espelho usa
// a MESMA key do campo do cliente; rodar 2× com tag fixa reusaria a mesma key).
const TAG = `SMOKEB1 ${Date.now().toString(36)}`;
const createdClientDefs: string[] = [];
const createdTemaDefs: string[] = [];

async function main() {
  const sb = getSupabaseAdmin();

  const { data: temas } = await sb.from("system_temas_active").select("id, name").limit(2);
  if (!temas || temas.length < 2) {
    console.error("Preciso de 2 temas ativos para rodar o smoke B1.");
    process.exit(2);
  }
  const temaA = temas[0].id;
  const temaB = temas[1].id;
  console.log(`Tema A: ${temas[0].name} | Tema B: ${temas[1].name}`);

  // 1) Criar campo do cliente com appears_in_cases=true.
  console.log("\n[1] Criar campo do cliente appears_in_cases=true");
  const cli = await createFieldDef({
    label: `${TAG} IVS municipio`,
    field_type: "text",
    required: false,
    appears_in_cases: true,
  });
  createdClientDefs.push(cli.id);
  check("appears_in_cases=true", cli.appears_in_cases === true, cli.appears_in_cases);
  const key = cli.key;

  // 2) Vincular a T1+T2 → 2 defs-espelho scope='cliente' com a MESMA key.
  console.log("\n[2] Vincular a T1+T2 → defs-espelho scope='cliente' mesma key");
  await reconcileClientFieldTemaLinks(cli.id, [temaA, temaB]);
  const links = await listClientFieldTemaLinks(cli.id);
  check(
    "2 vínculos ativos",
    links.length === 2 && links.includes(temaA) && links.includes(temaB),
    links,
  );

  const { data: mirrorsAfterLink } = await sb
    .from("system_tema_field_defs_active")
    .select("id, tema_id, key, scope, label, active")
    .eq("scope", "cliente")
    .eq("key", key)
    .in("tema_id", [temaA, temaB]);
  for (const m of mirrorsAfterLink ?? []) createdTemaDefs.push(m.id as string);
  const mA = (mirrorsAfterLink ?? []).find((m) => m.tema_id === temaA);
  const mB = (mirrorsAfterLink ?? []).find((m) => m.tema_id === temaB);
  check("espelho no temaA existe/ativo", !!mA && mA.active === true);
  check("espelho no temaB existe/ativo", !!mB && mB.active === true);
  check("espelho usa a MESMA key do cliente", mA?.key === key && mB?.key === key, {
    key,
    mA: mA?.key,
    mB: mB?.key,
  });
  check("mesmo label do campo do cliente", mA?.label === cli.label && mB?.label === cli.label);

  // 3) Idempotência: re-vincular os MESMOS temas não duplica.
  console.log("\n[3] Re-vincular os mesmos temas é idempotente");
  await reconcileClientFieldTemaLinks(cli.id, [temaA, temaB]);
  const links2 = await listClientFieldTemaLinks(cli.id);
  check("continua com 2 vínculos", links2.length === 2, links2.length);
  const { data: dupCheck } = await sb
    .from("system_tema_field_defs_active")
    .select("id")
    .eq("scope", "cliente")
    .eq("key", key)
    .eq("tema_id", temaA);
  check("sem duplicar espelho em temaA", (dupCheck ?? []).length === 1, (dupCheck ?? []).length);

  // 4) Gravar valor no cliente → leitura única (mesmo balde/mesma key).
  console.log("\n[4] Gravar valor no cliente e ler pelo balde único");
  const { data: someClient } = await sb
    .from("system_clients")
    .select("id, custom_fields")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (someClient) {
    const merged = { ...(someClient.custom_fields ?? {}), [key]: "0.55" };
    await sb.from("system_clients").update({ custom_fields: merged }).eq("id", someClient.id);
    const { data: reread } = await sb
      .from("system_clients")
      .select("custom_fields")
      .eq("id", someClient.id)
      .maybeSingle();
    const val = (reread?.custom_fields as Record<string, unknown> | null)?.[key];
    check("valor único gravado/lido no balde do cliente", val === "0.55", val);
    // limpa o valor do cliente (não deixa lixo)
    const cleaned = { ...(reread?.custom_fields ?? {}) } as Record<string, unknown>;
    delete cleaned[key];
    await sb.from("system_clients").update({ custom_fields: cleaned }).eq("id", someClient.id);
  } else {
    console.log("  ⏭️ sem clientes para testar valor (pulado)");
  }

  // 5) Desvincular T2 → espelho de T2 OCULTA (active=false); valor intacto; T1 fica.
  console.log("\n[5] Desvincular T2 → espelho de T2 oculta, T1 permanece");
  await reconcileClientFieldTemaLinks(cli.id, [temaA]);
  const links3 = await listClientFieldTemaLinks(cli.id);
  check("só T1 vinculado", links3.length === 1 && links3[0] === temaA, links3);

  const { data: mBAfter } = await sb
    .from("system_tema_field_defs")
    .select("active, deleted_at")
    .eq("scope", "cliente")
    .eq("key", key)
    .eq("tema_id", temaB)
    .is("frente_slug", null)
    .maybeSingle();
  check("espelho T2 ocultado (active=false)", mBAfter?.active === false, mBAfter?.active);
  check("espelho T2 NÃO deletado", mBAfter?.deleted_at === null, mBAfter?.deleted_at);

  const { data: mAAfter } = await sb
    .from("system_tema_field_defs_active")
    .select("active")
    .eq("scope", "cliente")
    .eq("key", key)
    .eq("tema_id", temaA)
    .is("frente_slug", null)
    .maybeSingle();
  check("espelho T1 continua ativo", mAAfter?.active === true, mAAfter?.active);

  // 6) Re-vincular T2 → reativa o espelho existente (não recria).
  console.log("\n[6] Re-vincular T2 reativa o espelho (sem recriar)");
  await reconcileClientFieldTemaLinks(cli.id, [temaA, temaB]);
  const { data: mBReact } = await sb
    .from("system_tema_field_defs")
    .select("id, active")
    .eq("scope", "cliente")
    .eq("key", key)
    .eq("tema_id", temaB)
    .is("frente_slug", null)
    .maybeSingle();
  check("espelho T2 reativado", mBReact?.active === true, mBReact?.active);
  const { count: mBCount } = await sb
    .from("system_tema_field_defs")
    .select("id", { count: "exact", head: true })
    .eq("scope", "cliente")
    .eq("key", key)
    .eq("tema_id", temaB)
    .is("deleted_at", null);
  check("não recriou (1 espelho T2)", mBCount === 1, mBCount);

  // 7) Conflito de CONCEITO diferente: criar def scope='cliente' com a MESMA key
  //    e rótulo divergente deve ser barrado (409).
  console.log("\n[7] Conflito de conceito (mesma key, rótulo diferente) barrado");
  let threw = false;
  let status = 0;
  try {
    const bad = await createTemaFieldDef({
      temaId: temaA,
      key,
      rawKey: true, // usa a key exata (com underscores) para forçar a colisão de balde
      label: `${TAG} Outra coisa`,
      type: "text",
      scope: "cliente",
    });
    createdTemaDefs.push(bad.id);
  } catch (err) {
    threw = true;
    status = (err as { status?: number })?.status ?? 0;
  }
  check("conflito de conceito recusado (throw)", threw);
  check("conflito → 409", status === 409, status);

  // 8) Excluir o campo do cliente desfaz a bifurcação (vínculos zerados + espelhos ocultos).
  console.log("\n[8] Excluir campo do cliente zera vínculos e oculta espelhos");
  await deleteFieldDef(cli.id);
  createdClientDefs.splice(createdClientDefs.indexOf(cli.id), 1); // já excluído
  const linksAfterDelete = await listClientFieldTemaLinks(cli.id);
  check("sem vínculos após excluir", linksAfterDelete.length === 0, linksAfterDelete.length);
  // Espelhos ficam OCULTOS (active=false), NÃO deletados — o dado do cliente e a
  // def de tema permanecem geríveis. Assim, seguem em _active (deleted_at IS NULL)
  // porém com active=false.
  const { data: mirrorsAfterDelete } = await sb
    .from("system_tema_field_defs")
    .select("id, active")
    .eq("scope", "cliente")
    .eq("key", key)
    .is("deleted_at", null)
    .in("tema_id", [temaA, temaB]);
  const allHidden =
    (mirrorsAfterDelete ?? []).length > 0 &&
    (mirrorsAfterDelete ?? []).every((m) => m.active === false);
  check(
    "espelhos ocultos (active=false) após excluir campo",
    allHidden,
    (mirrorsAfterDelete ?? []).map((m) => m.active),
  );
}

main()
  .catch((err) => {
    console.error("\nERRO no smoke:", err instanceof Error ? err.message : err);
    fail++;
  })
  .finally(async () => {
    const sb = getSupabaseAdmin();
    const now = new Date().toISOString();
    console.log(`\nLimpando ${createdClientDefs.length} campo(s) do cliente e defs de tema…`);
    for (const id of createdClientDefs) {
      try {
        await deleteFieldDef(id);
      } catch (e) {
        console.error(`  falha ao limpar client def ${id}:`, (e as Error).message);
      }
    }
    // Soft-delete das defs de tema espelho/teste criadas (dedup) + varredura por
    // rótulo desta execução (pega espelhos não capturados por id).
    for (const id of [...new Set(createdTemaDefs)]) {
      try {
        await sb
          .from("system_tema_field_defs")
          .update({ deleted_at: now })
          .eq("id", id)
          .is("deleted_at", null);
      } catch (e) {
        console.error(`  falha ao limpar tema def ${id}:`, (e as Error).message);
      }
    }
    try {
      await sb
        .from("system_tema_field_defs")
        .update({ deleted_at: now })
        .ilike("label", `${TAG}%`)
        .is("deleted_at", null);
    } catch {
      /* noop */
    }
    console.log(`\nRESULTADO: ${pass} passou, ${fail} falhou.`);
    process.exit(fail > 0 ? 1 : 0);
  });
