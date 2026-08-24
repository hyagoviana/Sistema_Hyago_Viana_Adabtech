// CAÇA AO ENDPOINT: onde a API do ProJuris expõe o "Prazo previsto/fatal" e a
// "Classificação" de cada TIPO DE TAREFA?
//
// O que já sabemos: `GET /tipo?chave-tipo=tarefa-tipo` devolve só {chave, valor}
// (código + nome). A tela do ProJuris (print do Thiago, 21/08) mostra por tipo:
// Classificação (Prazos/Processuais) e Prazo previsto/fatal (ex.: 12/15).
//
// Sem documentação, sondamos: para cada candidato, reportamos o status e as
// CHAVES do retorno. Erro 400 do Jackson costuma entregar de bandeja o nome/enum
// esperado — foi assim que descobrimos TipoSituacaoIntimacaoType.
//
// SÓ LEITURA (GET e POST de consulta). Nada é criado ou alterado no ProJuris.
//
// Uso: npx tsx scripts/diag-projuris-tipo-tarefa.ts

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig } from "@/lib/distribuicao/sync-core";

type Client = Awaited<ReturnType<typeof buildProjurisClientFromConfig>>;

/** Descreve o formato do retorno sem despejar o payload inteiro. */
function descreve(v: unknown, prof = 0): string {
  if (v === null) return "null";
  if (Array.isArray(v))
    return `array(${v.length})${v.length ? ` de ${descreve(v[0], prof + 1)}` : ""}`;
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    if (prof >= 2) return `{${keys.length} chaves}`;
    return `{ ${keys.slice(0, 14).join(", ")}${keys.length > 14 ? ", …" : ""} }`;
  }
  return typeof v;
}

/** Procura, em qualquer profundidade, chaves que cheirem a prazo/classificação. */
function procuraPrazos(v: unknown, caminho = "", achados: string[] = []): string[] {
  if (achados.length > 12) return achados;
  if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const p = caminho ? `${caminho}.${k}` : k;
      if (/prazo|previst|fatal|classific|dias/i.test(k)) {
        achados.push(`${p} = ${JSON.stringify(val)?.slice(0, 60)}`);
      }
      procuraPrazos(val, p, achados);
    }
  }
  return achados;
}

async function tentaGet(c: Client, path: string, params?: Record<string, string>) {
  const rotulo = `GET ${path}${params ? ` ?${new URLSearchParams(params)}` : ""}`;
  try {
    const r = await c.projurisGet<unknown>(path, params);
    const prazos = procuraPrazos(r);
    console.log(`✅ ${rotulo}\n     ${descreve(r)}`);
    if (prazos.length) console.log(`     🎯 PRAZOS: ${prazos.join(" | ")}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`❌ ${rotulo}\n     ${msg.slice(0, 160)}`);
  }
}

async function tentaPost(c: Client, path: string, body: Record<string, unknown>) {
  const rotulo = `POST ${path} ${JSON.stringify(body).slice(0, 60)}`;
  try {
    const r = await c.projurisPostConsulta<unknown>(path, body);
    const prazos = procuraPrazos(r);
    console.log(`✅ ${rotulo}\n     ${descreve(r)}`);
    if (prazos.length) console.log(`     🎯 PRAZOS: ${prazos.join(" | ")}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`❌ ${rotulo}\n     ${msg.slice(0, 160)}`);
  }
}

async function main() {
  const sb = getSupabaseAdmin();
  const c = await buildProjurisClientFromConfig(sb);
  await c.authenticateTryingVariants();
  console.log("autenticado.\n");

  // Um código real de tipo de tarefa, do nosso próprio mapeamento.
  const { data: umTipo } = await sb
    .from("system_task_type_mapping")
    .select("projuris_tipo_codigo, projuris_tipo_descricao")
    .not("projuris_tipo_codigo", "is", null)
    .limit(20);
  const numerico = (umTipo ?? []).find((t) => /^\d+$/.test(t.projuris_tipo_codigo ?? ""));
  const codigo = numerico?.projuris_tipo_codigo ?? "1";
  console.log(`usando o tipo ${codigo} (${numerico?.projuris_tipo_descricao ?? "?"})\n`);

  console.log("──────── 1. o endpoint que já usamos, com parâmetros extras ────────");
  await tentaGet(c, "tipo", { "chave-tipo": "tarefa-tipo" });
  await tentaGet(c, "tipo", { "chave-tipo": "tarefa-tipo", dadosCompletos: "true" });
  await tentaGet(c, "tipo", { "chave-tipo": "tarefa-tipo", detalhado: "true" });
  await tentaGet(c, `tipo/${codigo}`, { "chave-tipo": "tarefa-tipo" });

  console.log("\n──────── 2. candidatos de recurso próprio ────────");
  for (const p of [
    "tarefa-tipo",
    `tarefa-tipo/${codigo}`,
    "tipo-tarefa",
    `tipo-tarefa/${codigo}`,
    "tarefa/tipo",
    `tarefa/tipo/${codigo}`,
    "configuracao/tarefa-tipo",
    "cadastro/tarefa-tipo",
    "v2/tarefa-tipo",
  ]) {
    await tentaGet(c, p);
  }

  console.log("\n──────── 3. consultas (POST) ────────");
  for (const p of ["tarefa-tipo/consulta", "tipo-tarefa/consulta", "v2/tarefa-tipo/consulta"]) {
    await tentaPost(c, p, { quantidadeRegistros: 5, registroInicial: 0 });
  }

  console.log("\n──────── 4. uma TAREFA real (o prazo pode vir junto do tipo) ────────");
  const { data: snap } = await sb
    .from("system_distribution_kanban_tasks")
    .select("projuris_task_id")
    .limit(1)
    .maybeSingle();
  const taskId = (snap as { projuris_task_id?: string } | null)?.projuris_task_id;
  if (taskId) {
    console.log(`tarefa de exemplo: ${taskId}`);
    await tentaGet(c, `tarefa/${taskId}`);
  } else {
    console.log("(sem snapshot de tarefa no banco para testar)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
