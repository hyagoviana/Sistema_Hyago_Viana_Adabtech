// QA dos 3 bugs que o Thiago mandou em 04/09.
//
// Bug 1a — comentários automáticos "robotizados" (slug com sufixo técnico).
// Bug 2  — valor sobrevive à exclusão do campo do tema.
// Bug 3  — caso "numa etapa que não existe no kanban principal".
//
// Não escreve nada em dado de produção: a purga é exercida num tema/chave de
// teste, criada e removida aqui mesmo.
//
// Rodar: npx tsx scripts/qa-bugs-thiago-0409.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getSupabaseAdmin } from "../src/lib/supabase/server";
import { makeStageLabelResolver } from "../src/lib/cases/stage-label";
import { MACRO_FIN_LABELS, MACRO_OP_LABELS } from "../src/lib/cases/constants";

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

  // ======================================================== BUG 1a e 3
  console.log("\n  BUG 1a/3 — tradução de slug de etapa\n");

  // O caso do print do Thiago.
  const { data: caso } = await sb
    .from("system_cases")
    .select("case_code, macrostatus_op, service_type_id")
    .eq("case_code", "INADIMPLENCIAHV-2026-0427")
    .maybeSingle();
  const c = caso as {
    case_code: string;
    macrostatus_op: string;
    service_type_id: string;
  } | null;

  if (c) {
    // Antes: a ficha usava só MACRO_OP_LABELS (dicionário legado).
    const rotuloAntigo =
      (MACRO_OP_LABELS as Record<string, string>)[c.macrostatus_op] ?? c.macrostatus_op;

    // Agora: usa TODAS as etapas do tipo (inclui kanbans custom).
    const { data: etapas } = await sb
      .from("system_pipeline_stages_active")
      .select("slug, label")
      .eq("service_type_id", c.service_type_id);
    const resolve = makeStageLabelResolver(
      [etapas as Array<{ slug: string; label: string | null }>],
      MACRO_OP_LABELS,
      MACRO_FIN_LABELS,
    );
    const rotuloNovo = resolve(c.macrostatus_op);

    console.log(
      `  ${c.case_code}: slug "${c.macrostatus_op}" → antes "${rotuloAntigo}", agora "${rotuloNovo}"`,
    );
    check(
      "o rótulo agora vem da etapa CONFIGURADA (não é mais o slug cru)",
      rotuloNovo !== c.macrostatus_op,
      rotuloNovo,
    );
    check("o rótulo mudou em relação ao dicionário legado", rotuloNovo !== rotuloAntigo);
  } else {
    console.log("  (caso do print não encontrado — pulando)");
  }

  // Etapa de kanban CUSTOM (o caso do "3 dias follow up mt7bl3x2nssp").
  const { data: custom } = await sb
    .from("system_pipeline_stages_active")
    .select("slug, label, service_type_id")
    .not("board_id", "is", null)
    .limit(1)
    .maybeSingle();
  const st = custom as { slug: string; label: string; service_type_id: string } | null;
  if (st) {
    const { data: todas } = await sb
      .from("system_pipeline_stages_active")
      .select("slug, label")
      .eq("service_type_id", st.service_type_id);

    const semBoards = makeStageLabelResolver(
      [
        (todas as Array<{ slug: string; label: string | null }>).filter(
          (x) => x.slug !== st.slug,
        ),
      ],
      MACRO_OP_LABELS,
    );
    const comBoards = makeStageLabelResolver(
      [todas as Array<{ slug: string; label: string | null }>],
      MACRO_OP_LABELS,
    );

    console.log(
      `  etapa de kanban custom "${st.slug}": sem boards → "${semBoards(st.slug)}", com boards → "${comBoards(st.slug)}"`,
    );
    check(
      "sem as etapas dos boards, o sufixo técnico vazava",
      semBoards(st.slug).includes(st.slug.split("_").pop() ?? ""),
    );
    check("com as etapas dos boards, sai o rótulo humano", comBoards(st.slug) === st.label);
  }

  // ======================================================== BUG 2
  console.log("\n  BUG 2 — valor purgado ao excluir o campo do tema\n");

  const { data: tema } = await sb.from("system_temas").select("id").limit(1).maybeSingle();
  const temaId = (tema as { id: string } | null)?.id;
  const { data: casoDoTema } = await sb
    .from("system_cases")
    .select("id, canonical_fields")
    .eq("tema_id", temaId as string)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  const alvo = casoDoTema as { id: string; canonical_fields: Record<string, unknown> } | null;

  if (temaId && alvo) {
    const CHAVE = "__qa_campo_teste__";
    const original = { ...(alvo.canonical_fields ?? {}) };
    try {
      await sb
        .from("system_cases")
        .update({ canonical_fields: { ...original, [CHAVE]: "valor de teste" } } as never)
        .eq("id", alvo.id);

      const { data: antes } = await sb
        .from("system_cases")
        .select("canonical_fields")
        .eq("id", alvo.id)
        .maybeSingle();
      check(
        "o valor de teste foi gravado",
        !!(antes as { canonical_fields: Record<string, unknown> })?.canonical_fields?.[CHAVE],
      );

      const { data: afetados, error } = await sb.rpc("system_fn_purge_case_field" as never, {
        p_org: "00000000-0000-0000-0000-000000000001",
        p_tema: temaId,
        p_key: CHAVE,
      } as never);
      check("a função de purga existe e roda", !error, String(error ?? ""));

      const { data: depois } = await sb
        .from("system_cases")
        .select("canonical_fields")
        .eq("id", alvo.id)
        .maybeSingle();
      const cf = (depois as { canonical_fields: Record<string, unknown> })?.canonical_fields ?? {};
      check("o valor sumiu do caso após a purga", !(CHAVE in cf));
      check(
        "a purga reporta quantos casos afetou",
        typeof afetados === "number" && afetados >= 1,
        String(afetados),
      );
      check(
        "as OUTRAS chaves do caso continuam intactas",
        Object.keys(original).every((k) => k in cf),
      );
    } finally {
      await sb
        .from("system_cases")
        .update({ canonical_fields: original } as never)
        .eq("id", alvo.id);
      console.log("  ↩ canonical_fields do caso restaurado");
    }
  } else {
    console.log("  (sem tema/caso para exercitar a purga — pulando)");
  }

  if (falhou) {
    console.error(`\nBUGS 04/09: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nBUGS 04/09: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
