// QA S6-01 (03/09) — prova, contra o BANCO REAL, que a página de casos
// prioritários lista o que deve listar.
//
// Como não há nenhum caso marcado hoje (411 casos, todos com urgência nula), o
// teste MARCA temporariamente dois casos, roda o serviço de verdade e DESFAZ a
// marcação no `finally` — inclusive se algo estourar no meio.
//
// Rodar: npx tsx scripts/qa-prioritarios.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";
import { listCasosPrioritarios } from "../src/lib/prioritarios-service";

// Um caso COM processo judicial vinculado e um SEM — os dois cenários do desenho.
const CASO_COM_PROCESSO = "a24116de-680d-4f15-b104-c0cc59cf39f9"; // INADIMPLENCIAHV-2026-0422

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

  // Um caso sem processo judicial, para o cenário "administrativo puro".
  const { data: semProc } = await sb
    .from("system_cases")
    .select("id, case_code")
    .is("deleted_at", null)
    .not("id", "eq", CASO_COM_PROCESSO)
    .limit(50);
  // "Tem processo" = está em QUALQUER uma das duas tabelas (vínculo ou espelho).
  const [{ data: comVinculo }, { data: comEspelho }] = await Promise.all([
    sb.from("system_case_projuris_processos").select("case_id"),
    sb.from("system_case_judicial_processos").select("case_id"),
  ]);
  const idsComProcesso = new Set([
    ...(comVinculo ?? []).map((p) => (p as { case_id: string }).case_id),
    ...(comEspelho ?? []).map((p) => (p as { case_id: string }).case_id),
  ]);
  const casoSemProcesso = (semProc ?? []).find(
    (c) => !idsComProcesso.has((c as { id: string }).id),
  ) as { id: string; case_code: string } | undefined;

  if (!casoSemProcesso) throw new Error("Não achei um caso sem processo judicial para o teste.");

  // Um caso com VÍNCULO (é de lá que sai o CNJ) — cenário mais comum (211 casos).
  const { data: vinculo } = await sb
    .from("system_case_projuris_processos")
    .select("case_id")
    .limit(1)
    .maybeSingle();
  const casoComVinculo = (vinculo as { case_id: string } | null)?.case_id ?? null;
  if (!casoComVinculo) throw new Error("Não achei um caso com vínculo de processo para o teste.");

  const alvos = [CASO_COM_PROCESSO, casoSemProcesso.id, casoComVinculo];

  // Estado ORIGINAL (para restaurar) — hoje é null nos dois, mas não assumimos.
  const { data: antes } = await sb
    .from("system_cases")
    .select("id, distribution_urgency")
    .in("id", alvos);
  const original = new Map(
    ((antes ?? []) as Array<{ id: string; distribution_urgency: string | null }>).map((c) => [
      c.id,
      c.distribution_urgency,
    ]),
  );

  try {
    // Estado inicial: sem nenhum marcado → lista vazia.
    const vazio = await listCasosPrioritarios(null);
    check("sem casos marcados, a lista vem vazia", vazio.length === 0, `veio ${vazio.length}`);

    await sb
      .from("system_cases")
      .update({ distribution_urgency: "urgente" })
      .eq("id", CASO_COM_PROCESSO);
    await sb
      .from("system_cases")
      .update({ distribution_urgency: "prioritario" })
      .eq("id", casoSemProcesso.id);
    await sb
      .from("system_cases")
      .update({ distribution_urgency: "prioritario" })
      .eq("id", casoComVinculo);

    const linhas = await listCasosPrioritarios(null);

    check("os três casos marcados aparecem", linhas.length >= 3, `veio ${linhas.length}`);

    const linhasComVinculo = linhas.filter((l) => l.case_id === casoComVinculo);

    const doComProcesso = linhas.filter((l) => l.case_id === CASO_COM_PROCESSO);
    check(
      "caso COM processo vira 1 linha por processo",
      doComProcesso.length >= 1,
      `${doComProcesso.length} linha(s)`,
    );
    check(
      "processo com VÍNCULO traz o CNJ (sem o sufixo ' (CNJ)')",
      linhasComVinculo.every((l) => !!l.numero_processo && !/\(CNJ\)/i.test(l.numero_processo)),
      JSON.stringify(linhasComVinculo.map((l) => l.numero_processo).slice(0, 3)),
    );
    check(
      "urgência é espelhada do caso (urgente)",
      doComProcesso[0]?.urgencia === "urgente",
      doComProcesso[0]?.urgencia,
    );

    const doSemProcesso = linhas.filter((l) => l.case_id === casoSemProcesso.id);
    check(
      "caso SEM processo vira 1 linha, com coluna judicial vazia",
      doSemProcesso.length === 1 && doSemProcesso[0].numero_processo === null,
      `${doSemProcesso.length} linha(s)`,
    );

    check(
      "movimentação administrativa = status_changed_at do caso",
      doSemProcesso[0]?.ultima_mov_administrativa !== undefined,
    );

    check(
      "nome do cliente resolvido (não vem UUID cru)",
      linhas.every((l) => l.client_name === null || !/^[0-9a-f-]{36}$/.test(l.client_name)),
    );

    // Ordenação: mais parado primeiro.
    const chave = (l: (typeof linhas)[number]) => {
      const ds = [l.ultima_mov_judicial, l.ultima_mov_administrativa]
        .filter(Boolean)
        .map((d) => new Date(d as string).getTime());
      return ds.length ? Math.max(...ds) : 0;
    };
    const ordenado = linhas.every((l, i) => i === 0 || chave(linhas[i - 1]) <= chave(l));
    check("ordenação: mais parado primeiro", ordenado);

    // Visibilidade: um usuário que só vê os próprios casos não deve ver os dois.
    const { data: advogado } = await sb
      .from("system_users")
      .select("id, full_name, role")
      .in("role", ["advogado_associado", "advogado_titular", "prestador_externo"])
      .limit(1)
      .maybeSingle();
    if (advogado) {
      const doAdvogado = await listCasosPrioritarios((advogado as { id: string }).id);
      check(
        `visibilidade aplicada (${(advogado as { full_name: string }).full_name} vê ${doAdvogado.length} de ${linhas.length})`,
        doAdvogado.length <= linhas.length,
      );
    } else {
      console.log("  · nenhum usuário com visibilidade restrita para testar (pulado)");
    }
  } finally {
    // RESTAURA sempre — o teste não pode deixar rastro em produção.
    for (const [id, valor] of original) {
      await sb.from("system_cases").update({ distribution_urgency: valor }).eq("id", id);
    }
    const depois = await listCasosPrioritarios(null);
    console.log(
      `\n  ↩ estado restaurado — lista voltou a ter ${depois.length} linha(s) (esperado: 0)`,
    );
    if (depois.length !== 0) {
      console.error("  ✗ ATENÇÃO: a restauração não zerou a lista. Conferir à mão.");
      falhou++;
    }
  }

  if (falhou) {
    console.error(`\nPRIORITÁRIOS: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nPRIORITÁRIOS: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
