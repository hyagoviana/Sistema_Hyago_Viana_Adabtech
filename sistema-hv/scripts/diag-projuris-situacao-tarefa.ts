// Descobre o CÓDIGO de "Concluída sem sucesso" na API do ProJuris (pendência da
// story TK1). O Thiago não consegue ver esse código pelo painel — é configuração
// padrão do ProJuris — mas mandou o identificador de uma tarefa que ESTÁ nesse
// status: TAR.0042154 (e TAR.0041754, que estava pendente). Se a API devolver a
// tarefa, o campo de situação entrega o código.
//
// SOMENTE LEITURA. Nenhum PUT, nenhum POST que crie ou altere coisa —
// `*/consulta` no ProJuris é POST só porque o filtro vai no corpo.
//
// Uso: npx tsx scripts/diag-projuris-situacao-tarefa.ts
import { config } from "dotenv";

config({ path: ".env.local" });

import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";

const ALVOS = ["TAR.0042154", "TAR.0041754"];

/** Acha o primeiro array não-vazio em qualquer profundidade da resposta. */
function firstArrayDeep(obj: unknown): unknown[] {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      if (Array.isArray(val) && val.length) return val;
      if (val && typeof val === "object") {
        const inner = firstArrayDeep(val);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

/** Coleta todo par chave/valor cuja chave menciona situação — em qualquer nível. */
function camposDeSituacao(obj: unknown, prefixo = ""): Array<[string, unknown]> {
  const achados: Array<[string, unknown]> = [];
  if (!obj || typeof obj !== "object") return achados;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const caminho = prefixo ? `${prefixo}.${k}` : k;
    if (/situa|conclu|status/i.test(k)) achados.push([caminho, v]);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      achados.push(...camposDeSituacao(v, caminho));
    }
  }
  return achados;
}

async function tenta(rotulo: string, fn: () => Promise<unknown>): Promise<unknown | null> {
  try {
    const r = await fn();
    console.log(`✔ ${rotulo}`);
    return r;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`· ${rotulo} → ${msg.slice(0, 200).replace(/\s+/g, " ")}`);
    return null;
  }
}

async function main() {
  const client = createProjurisClientFromEnv();
  const { username } = await client.authenticateTryingVariants();
  console.log(`Autenticado como ${username}\n`);

  // ── 1. A API tem catálogo de situações de tarefa? ────────────────────────
  console.log("── Catálogo de situações ────────────────────────────────────");
  for (const rota of [
    "tarefa/situacao",
    "tarefa-situacao",
    "tarefa/situacoes",
    "tarefa-evento-situacao",
  ]) {
    const r = await tenta(`GET ${rota}`, () => client.projurisGet(rota));
    if (r) console.log(JSON.stringify(r).slice(0, 600));
  }

  // ── 2. Buscar a tarefa pelo identificador ───────────────────────────────
  console.log("\n── Consulta das tarefas alvo ────────────────────────────────");
  for (const alvo of ALVOS) {
    console.log(`\n### ${alvo}`);
    const respostas: unknown[] = [];

    for (const [rota, body] of [
      ["tarefa/consulta-com-paginacao", { identificador: alvo, quantidadeRegistros: 5, registroInicial: 0 }],
      ["tarefa/consulta-detalhada", { identificador: alvo, quantidadeRegistros: 5, registroInicial: 0 }],
      ["tarefa/consulta-sem-paginacao", { identificador: alvo }],
    ] as Array<[string, Record<string, unknown>]>) {
      const r = await tenta(`POST ${rota}`, () => client.projurisPostConsulta(rota, body));
      if (r) respostas.push(r);
    }

    for (const r of respostas) {
      const arr = firstArrayDeep(r) as Array<Record<string, unknown>>;
      if (!arr.length) continue;
      // Se o filtro por identificador não pegou, procura o alvo na lista.
      const alvoNaLista =
        arr.find((t) => JSON.stringify(t).includes(alvo)) ?? (arr.length === 1 ? arr[0] : null);
      if (!alvoNaLista) {
        console.log(`   (${arr.length} tarefas voltaram, nenhuma é ${alvo} — filtro ignorado)`);
        continue;
      }
      console.log("   CAMPOS DE SITUAÇÃO:");
      for (const [caminho, valor] of camposDeSituacao(alvoNaLista)) {
        console.log(`     ${caminho} = ${JSON.stringify(valor)}`);
      }
      break;
    }
  }
  // Mapa completo: varre um lote e coleta os pares distintos.
  console.log("");
  console.log("-- Mapa codigo -> situacao (varredura) --");
  const mapa = new Map<number, string>();
  for (let pagina = 0; pagina < 12; pagina++) {
    const r = await client
      .projurisPostConsulta("tarefa/consulta-com-paginacao", {
        quantidadeRegistros: 200,
        registroInicial: pagina * 200,
      })
      .catch(() => null);
    const arr = firstArrayDeep(r) as Array<Record<string, unknown>>;
    if (!arr.length) break;
    for (const t of arr) {
      const cod = t.codigoSituacao;
      const nome = t.situacao;
      if (typeof cod === "number" && typeof nome === "string" && !mapa.has(cod)) {
        mapa.set(cod, nome);
      }
    }
    if (mapa.size >= 7) break;
  }
  for (const cod of [...mapa.keys()].sort((a, b) => a - b)) {
    console.log(`   ${cod} = ${mapa.get(cod)}`);
  }
  console.log(`   (${mapa.size} situacoes distintas)`);
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
