// QA das S2-02 / S2-03 — assunto do ProJuris por tema.
//
// O defeito original (Thiago, desenho 5): todo processo criado pelo SHV nascia
// com um ASSUNTO NOVO no ProJuris, porque `criar-processo` mandava o código do
// caso nesse campo. O ProJuris acumulava um assunto por caso.
//
// Roda contra o banco REAL (dev=prod). Escreve em tema real — não dá para testar
// a cadeia sem isso — mas o `finally` devolve o assunto do tema e o assunto geral
// ao valor original. Deixar um assunto de teste gravado mudaria o que vai para o
// ProJuris no próximo processo criado.
//
// Rodar: npx tsx scripts/qa-s202-s203-assunto-projuris.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { dadosDoCasoParaProcesso } from "../src/lib/projuris/criar-processo";
import {
  getAssuntoGeral,
  resolverAssuntoDoCaso,
  setAssuntoGeral,
  setTemaAssunto,
} from "../src/lib/projuris/assunto-tema";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

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
  const geralOriginal = await getAssuntoGeral();

  // Um caso real, com tema, para exercitar a cadeia ponta a ponta.
  const { data: casoRaw } = await sb
    .from("system_cases")
    .select("id, case_code, caso_pasta_nome, tema_id")
    .not("tema_id", "is", null)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  const caso = casoRaw as {
    id: string;
    case_code: string;
    caso_pasta_nome: string | null;
    tema_id: string;
  } | null;

  if (!caso) {
    console.error("Sem caso com tema para testar.");
    process.exit(1);
  }

  const { data: temaRaw } = await sb
    .from("system_temas")
    .select("name, projuris_assunto_id, projuris_assunto_nome")
    .eq("id", caso.tema_id)
    .maybeSingle();
  const temaOriginal = temaRaw as {
    name: string;
    projuris_assunto_id: string | null;
    projuris_assunto_nome: string | null;
  };

  try {
    // ==================================================== cadeia de resolução
    console.log("\n  A — a cadeia tema → geral → bloqueio\n");

    await setTemaAssunto(caso.tema_id, { nome: "QA ASSUNTO DO TEMA", id: "9999" });
    const comTema = await resolverAssuntoDoCaso(caso.id);
    check(
      "com assunto no tema, vem o do tema",
      comTema?.nome === "QA ASSUNTO DO TEMA",
      comTema?.nome,
    );
    check("e a origem é 'tema'", comTema?.origem === "tema", comTema?.origem);
    check("com o nome do tema junto, para a UI mostrar", comTema?.temaNome === temaOriginal.name);
    check("o identificador acompanha", comTema?.id === "9999", String(comTema?.id));

    await setTemaAssunto(caso.tema_id, { nome: null, id: null });
    await setAssuntoGeral({ nome: "QA ASSUNTO GERAL" });
    const semTema = await resolverAssuntoDoCaso(caso.id);
    check("sem assunto no tema, cai no geral", semTema?.nome === "QA ASSUNTO GERAL", semTema?.nome);
    check("e a origem é 'geral'", semTema?.origem === "geral", semTema?.origem);

    await setAssuntoGeral({ nome: null });
    const semNada = await resolverAssuntoDoCaso(caso.id);
    check("sem tema E sem geral, devolve null (quem chama bloqueia)", semNada === null);

    // ================================================= o defeito não voltou
    console.log("\n  B — o código do caso nunca mais vai como assunto\n");

    // Este é o teste que importa: com a cadeia vazia, o comportamento ANTIGO
    // colocaria `caso_pasta_nome || case_code` no assunto. Tem que sair vazio.
    const semAssunto = await dadosDoCasoParaProcesso(caso.id);
    check(
      "sem assunto resolvível, o payload sai com assunto VAZIO",
      !semAssunto.assunto,
      `veio "${semAssunto.assunto}"`,
    );
    check(
      "e o assunto NÃO é o código do caso (era o bug)",
      semAssunto.assunto !== caso.case_code,
      semAssunto.assunto,
    );
    check(
      "nem o nome da pasta do caso (o outro braço do bug)",
      !caso.caso_pasta_nome || semAssunto.assunto !== caso.caso_pasta_nome,
    );
    check(
      "o nome da PASTA no ProJuris continua preenchido (outro campo, não muda)",
      !!semAssunto.nomePasta,
      semAssunto.nomePasta,
    );
    check(
      "o codigoExterno continua sendo o código do caso (é ele que amarra os dois lados)",
      semAssunto.codigoExterno === caso.case_code,
      semAssunto.codigoExterno ?? "",
    );

    await setTemaAssunto(caso.tema_id, { nome: "QA ASSUNTO DO TEMA" });
    const comAssunto = await dadosDoCasoParaProcesso(caso.id);
    check(
      "com assunto no tema, o payload leva o assunto do tema",
      comAssunto.assunto === "QA ASSUNTO DO TEMA",
      comAssunto.assunto,
    );

    // ============================================ vários temas, mesmo assunto
    console.log("\n  C — nada impede dois temas de dividirem o assunto\n");

    const { data: outroRaw } = await sb
      .from("system_temas")
      .select("id, projuris_assunto_nome")
      .neq("id", caso.tema_id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    const outro = outroRaw as { id: string; projuris_assunto_nome: string | null } | null;
    if (outro) {
      const antes = outro.projuris_assunto_nome;
      try {
        await setTemaAssunto(outro.id, { nome: "QA ASSUNTO DO TEMA" });
        const { data: conf } = await sb
          .from("system_temas")
          .select("projuris_assunto_nome")
          .eq("id", outro.id)
          .maybeSingle();
        check(
          "o mesmo assunto em dois temas é aceito (AC3 — sem unicidade)",
          (conf as { projuris_assunto_nome: string }).projuris_assunto_nome ===
            "QA ASSUNTO DO TEMA",
        );
      } finally {
        await setTemaAssunto(outro.id, { nome: antes });
      }
    } else {
      console.log("  (só um tema no banco — pulando)");
    }

    // ======================================================== o fallback semeado
    console.log("\n  D — o fallback que o Thiago indicou\n");

    check(
      'o assunto geral nasceu como "CÍVEIS" (migration)',
      geralOriginal.nome === "CÍVEIS",
      `está "${geralOriginal.nome}"`,
    );
  } finally {
    // Devolve tudo ao estado original — este script roda contra o banco de
    // produção, e deixar um assunto de teste gravado mudaria o que vai para o
    // ProJuris no próximo processo criado.
    await setTemaAssunto(caso.tema_id, {
      nome: temaOriginal.projuris_assunto_nome,
      id: temaOriginal.projuris_assunto_id,
    });
    await setAssuntoGeral({ nome: geralOriginal.nome, id: geralOriginal.id });
    console.log("\n  ↩ assunto do tema e assunto geral restaurados");
  }

  if (falhou) {
    console.error(`\nS2-02/S2-03: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nS2-02/S2-03: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
