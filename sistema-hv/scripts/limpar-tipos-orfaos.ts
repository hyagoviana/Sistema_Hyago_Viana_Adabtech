// Limpeza dos tipos de tarefa que ficaram órfãos ou trocados depois que o Thiago
// arrumou o catálogo do ProJuris (24/08).
//
// Verificado antes de escrever: NENHUM dos tipos abaixo tem tarefa do caso ou
// exceção por tema apontando para ele — por isso a limpeza é segura.
//
// O que faz:
//   1. CORRIGE o vínculo trocado. O SHV tinha "Protocolo" apontando para o código
//      de "Protocolo Intercorrente". Lá existem os dois: "Protocolo Inicial"
//      (4327344) e "Protocolo Intercorrente" (3843093) — cada um vai para o seu.
//   2. LIMPA o código de tipos cujo código não existe mais no ProJuris, para o
//      sync parar de tentar casá-los por um número morto.
//   3. ARQUIVA (não apaga) os que não têm mais razão de aparecer: duplicata
//      interna e substituído. Arquivado some das listas de "criar tarefa" e do
//      motor, mas o registro continua para o histórico.
//
// Uso:
//   npx tsx scripts/limpar-tipos-orfaos.ts          (só mostra o que faria)
//   npx tsx scripts/limpar-tipos-orfaos.ts --executar

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ORG_ID } from "@/lib/distribuicao/sync-core";

const EXECUTAR = process.argv.includes("--executar");
const sb = getSupabaseAdmin();

/** Códigos que sumiram do ProJuris — o vínculo aponta para o nada. */
const CODIGO_MORTO = [
  "ANALISE_PROCESSUAL",
  "PESQUISA",
  "EXECUCAO_EXTRAJUDICIAL",
  "PETICAO_DE_JUNTADA",
  "SOLICITACAO_ADMINISTRATIVA",
];

/** Não devem mais aparecer: duplicata interna e substituído pelo importado. */
const ARQUIVAR: Array<[string, string]> = [
  ["audiencia_trabalhista", "duplicata de AUDIENCIA dentro do próprio SHV"],
  ["DILIGENCIAS_BALCAO", 'substituído pelo importado "Diligência/Balcão" (3843090)'],
];

async function main() {
  console.log(EXECUTAR ? "MODO: EXECUTAR\n" : "MODO: simulação (use --executar)\n");

  // ---------------------------------------------------------------- 1
  //
  // No ProJuris existem DOIS: "Protocolo Inicial" (4327344) e "Protocolo
  // Intercorrente" (3843093). O SHV tinha um "Protocolo" genérico apontando para
  // o código do Intercorrente, e o "Protocolo Intercorrente" apontando para um
  // código morto. O sync já importou o Inicial como tipo próprio, então:
  //   · PROTOCOLO_INTERCORRENTE recebe o código certo (3843093)
  //   · PROTOCOLO genérico é ARQUIVADO — quem faz esse papel agora é o importado
  console.log("1) Vínculos trocados de Protocolo");
  const { data: prot } = await sb
    .from("system_task_type_mapping")
    .select("id, motor_task_type_id, projuris_tipo_codigo, projuris_tipo_descricao, archived_at")
    .eq("organization_id", ORG_ID)
    .in("motor_task_type_id", ["PROTOCOLO", "PROTOCOLO_INTERCORRENTE", "PROTOCOLO_INICIAL"]);

  const p = (prot ?? []).find((x) => x.motor_task_type_id === "PROTOCOLO");
  const pi = (prot ?? []).find((x) => x.motor_task_type_id === "PROTOCOLO_INTERCORRENTE");
  const pIni = (prot ?? []).find((x) => x.motor_task_type_id === "PROTOCOLO_INICIAL");

  console.log(`   PROTOCOLO_INICIAL       ${pIni?.projuris_tipo_codigo} (importado, correto)`);
  console.log(`   PROTOCOLO_INTERCORRENTE ${pi?.projuris_tipo_codigo} → deve ser 3843093`);
  console.log(
    `   PROTOCOLO (genérico)    ${p?.projuris_tipo_codigo} → arquivar (o Inicial ocupa o lugar)`,
  );

  if (EXECUTAR && p && pi) {
    // Ordem importa: 3843093 está ocupado pelo PROTOCOLO (UNIQUE por org), então
    // ele precisa soltar o código antes.
    const passos: Array<[string, Promise<{ error: unknown }>]> = [
      [
        "soltar o código do PROTOCOLO",
        sb
          .from("system_task_type_mapping")
          .update({ projuris_tipo_codigo: "Protocolo (legado)" } as never)
          .eq("id", p.id) as never,
      ],
    ];
    for (const [rotulo, promessa] of passos) {
      const { error } = await promessa;
      if (error) throw new Error(`${rotulo}: ${(error as { message: string }).message}`);
    }

    const { error: e2 } = await sb
      .from("system_task_type_mapping")
      .update({
        projuris_tipo_codigo: "3843093",
        projuris_tipo_descricao: "Protocolo Intercorrente",
      } as never)
      .eq("id", pi.id);
    if (e2) throw new Error(`vincular PROTOCOLO_INTERCORRENTE: ${e2.message}`);

    const { error: e3 } = await sb
      .from("system_task_type_mapping")
      .update({ archived_at: new Date().toISOString(), aparece_no_motor: false } as never)
      .eq("id", p.id);
    if (e3) throw new Error(`arquivar PROTOCOLO: ${e3.message}`);

    console.log("   ✔ Intercorrente vinculado e genérico arquivado");
  }

  // ---------------------------------------------------------------- 2
  console.log("\n2) Códigos que não existem mais no ProJuris (limpar o número, manter o tipo)");
  for (const motor of CODIGO_MORTO) {
    const { data: t } = await sb
      .from("system_task_type_mapping")
      .select("id, projuris_tipo_codigo, projuris_tipo_descricao")
      .eq("organization_id", ORG_ID)
      .eq("motor_task_type_id", motor)
      .maybeSingle();
    if (!t) continue;
    const nome = t.projuris_tipo_descricao || motor;
    console.log(
      `   ${motor.padEnd(28)} código ${t.projuris_tipo_codigo} → limpar (fica "${nome}")`,
    );
    if (EXECUTAR) {
      // O código volta a ser o NOME (placeholder), como o sync espera de um tipo
      // ainda não vinculado. Assim ele não tenta casar por um número morto.
      const { error } = await sb
        .from("system_task_type_mapping")
        .update({ projuris_tipo_codigo: nome } as never)
        .eq("id", t.id);
      if (error) throw new Error(`limpar código de ${motor}: ${error.message}`);
    }
  }

  // ---------------------------------------------------------------- 3
  console.log("\n3) Arquivar (some das listas, registro preservado)");
  for (const [motor, motivo] of ARQUIVAR) {
    const { data: t } = await sb
      .from("system_task_type_mapping")
      .select("id, archived_at")
      .eq("organization_id", ORG_ID)
      .eq("motor_task_type_id", motor)
      .maybeSingle();
    if (!t) continue;
    console.log(
      `   ${motor.padEnd(28)} ${t.archived_at ? "(já arquivado)" : `→ arquivar · ${motivo}`}`,
    );
    if (EXECUTAR && !t.archived_at) {
      const { error } = await sb
        .from("system_task_type_mapping")
        .update({ archived_at: new Date().toISOString(), aparece_no_motor: false } as never)
        .eq("id", t.id);
      if (error) throw new Error(`arquivar ${motor}: ${error.message}`);
    }
  }

  // ---------------------------------------------------------------- resumo
  const { data: fim } = await sb
    .from("system_task_type_mapping")
    .select("projuris_tipo_codigo, archived_at, aparece_no_motor")
    .eq("organization_id", ORG_ID);
  const t = fim ?? [];
  console.log(
    `\nSHV: ${t.length} tipos · ${t.filter((x) => /^\d+$/.test(String(x.projuris_tipo_codigo))).length} vinculados · ${t.filter((x) => x.archived_at).length} arquivados · ${t.filter((x) => !x.archived_at && x.aparece_no_motor).length} ativos no motor`,
  );
  if (!EXECUTAR) console.log("\n(nada foi alterado — rode com --executar)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
