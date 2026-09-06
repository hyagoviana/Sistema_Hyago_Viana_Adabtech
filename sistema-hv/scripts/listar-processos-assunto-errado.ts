// S2-03 AC4 — lista os processos que nasceram no ProJuris com o ASSUNTO errado.
//
// Antes da S2-03, `criar-processo` mandava `assunto: caso_pasta_nome || case_code`.
// Quando a pasta do caso não tinha nome, ia o CÓDIGO DO CASO — e o ProJuris
// criava um assunto novo para aquele caso. Thiago (desenho 5): "no sistema foi
// criado um novo 'assunto' com o identificador do SHV (…) 1 assunto para cada
// caso".
//
// A correção só vale daqui para frente: os processos já criados continuam com o
// assunto errado lá. Este script diz QUAIS são, para o Thiago corrigir no
// ProJuris (ou pedir correção em massa depois).
//
// SOMENTE LEITURA. Não toca no ProJuris nem no banco.
//
// Rodar: npx tsx scripts/listar-processos-assunto-errado.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { resolverAssuntoDoCaso } from "../src/lib/projuris/assunto-tema";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

async function main() {
  const sb = getSupabaseAdmin();

  // Só os processos CRIADOS pelo SHV — são os únicos que receberam o assunto
  // errado. `projuris_codigo_processo` não serve para isso: ele também é
  // preenchido pela SINCRONIZAÇÃO, e a maioria absoluta dos casos veio da
  // importação (211 sincronizados contra 1 criado daqui). Filtrar por ele daria
  // 210 falsos positivos — processos cujo assunto foi cadastrado corretamente no
  // ProJuris e que ninguém deve mexer.
  //
  // A marca confiável é o evento gravado por `criarProcessoFn`.
  const { data: eventos, error: errEv } = await sb
    .from("system_case_events")
    .select("case_id")
    .eq("action", "projuris_processo_criado");
  if (errEv) throw new Error(errEv.message);
  const criadosAqui = [
    ...new Set(((eventos ?? []) as Array<{ case_id: string }>).map((e) => e.case_id)),
  ];

  if (!criadosAqui.length) {
    console.log("\nNenhum processo foi criado no ProJuris a partir do SHV. Nada a corrigir.\n");
    return;
  }

  const { data, error } = await sb
    .from("system_cases")
    .select("id, case_code, caso_pasta_nome, projuris_codigo_processo, tema_id")
    .in("id", criadosAqui)
    .is("deleted_at", null)
    .order("case_code");
  if (error) throw new Error(error.message);

  const casos = (data ?? []) as Array<{
    id: string;
    case_code: string;
    caso_pasta_nome: string | null;
    projuris_codigo_processo: number | null;
    tema_id: string | null;
  }>;

  console.log(`\n${casos.length} processo(s) criado(s) no ProJuris a partir do SHV.\n`);
  if (!casos.length) return;

  const suspeitos: Array<{
    case_code: string;
    codigo: string;
    assuntoAntigo: string;
    assuntoNovo: string;
  }> = [];

  for (const c of casos) {
    // Reproduz a regra ANTIGA para saber o que foi gravado lá.
    const assuntoAntigo = c.caso_pasta_nome || c.case_code;
    // Só é problema quando o que foi gravado é o código do caso: aí virou um
    // assunto exclusivo daquele caso no ProJuris. Quando havia nome de pasta, o
    // assunto pode até estar razoável.
    if (assuntoAntigo !== c.case_code) continue;

    const resolvido = await resolverAssuntoDoCaso(c.id);
    suspeitos.push({
      case_code: c.case_code,
      codigo: String(c.projuris_codigo_processo),
      assuntoAntigo,
      assuntoNovo: resolvido
        ? `${resolvido.nome} (${resolvido.origem === "tema" ? `tema ${resolvido.temaNome}` : "geral"})`
        : "⚠ nenhum — configure o assunto do tema ou o geral",
    });
  }

  if (!suspeitos.length) {
    console.log("Nenhum processo com assunto igual ao código do caso. Nada a corrigir.");
    return;
  }

  console.log(`${suspeitos.length} processo(s) com o assunto igual ao código do caso:\n`);
  console.log(
    `  ${"CASO".padEnd(28)} ${"PROCESSO".padEnd(10)} ${"ASSUNTO HOJE".padEnd(28)} DEVERIA SER`,
  );
  for (const s of suspeitos) {
    console.log(
      `  ${s.case_code.padEnd(28)} ${s.codigo.padEnd(10)} ${s.assuntoAntigo.padEnd(28)} ${s.assuntoNovo}`,
    );
  }

  const semAssunto = suspeitos.filter((s) => s.assuntoNovo.startsWith("⚠")).length;
  if (semAssunto) {
    console.log(
      `\n⚠ ${semAssunto} caso(s) ainda não têm assunto resolvível. Defina o assunto do tema em ` +
        `Configurações › Temas › Integrações, ou o assunto geral, antes de corrigir no ProJuris.`,
    );
  }
  console.log("\nA correção é no ProJuris — este script não escreve lá.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
