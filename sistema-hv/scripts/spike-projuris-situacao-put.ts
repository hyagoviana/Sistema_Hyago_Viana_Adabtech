// SPIKE: qual payload o `PUT /tarefas-situacao` do ProJuris realmente aceita?
//
// POR QUE UM EXPERIMENTO E NÃO LEITURA DE DOC. O WADL declara o tipo
// `tarefaSituacaoWs` mas não traz o schema, e o endpoint responde **204 para
// qualquer corpo** — inclusive `{}` e enum inválido. Ou seja: payload errado
// devolve "sucesso" e não faz nada. A única forma de saber é alterar e LER DE
// VOLTA.
//
// SEGURANÇA: usa uma tarefa que o PRÓPRIO SHV criou em teste (58497726), guarda a
// situação original e REVERTE ao final, sempre — inclusive se algo falhar.
//
// Uso: npx tsx scripts/spike-projuris-situacao-put.ts
import { config } from "dotenv";

config({ path: ".env.local" });

import { createProjurisClientFromEnv, PROJURIS_DEFAULT_BASE_URL } from "../src/lib/projuris/client.js";

const COD = Number(process.argv[2] ?? 58497726);
const ALVO = 3; // "Concluída sem sucesso" — bem distinto de "Pendente" (1)

type Cli = Awaited<ReturnType<typeof createProjurisClientFromEnv>>;

/** Lê a situação atual. `GET tarefa-compromisso/{codigoTarefaEvento}` é a única
 *  rota que localiza UMA tarefa pelo código — a consulta paginada ignora filtro. */
async function situacaoAtual(c: Cli): Promise<{ cod: unknown; nome: unknown; codigoTarefa: unknown } | null> {
  const r = (await c.projurisGet(`tarefa-compromisso/${COD}`).catch(() => null)) as {
    codigoTarefa?: unknown;
    tarefaEventoWs?: { tarefaEventoSituacaoWs?: { codigoTarefaEventoSituacao?: unknown; situacao?: unknown } };
  } | null;
  const sit = r?.tarefaEventoWs?.tarefaEventoSituacaoWs;
  if (!sit) return null;
  return { cod: sit.codigoTarefaEventoSituacao, nome: sit.situacao, codigoTarefa: r?.codigoTarefa };
}

async function put(acc: string, body: unknown): Promise<number> {
  const res = await fetch(`${PROJURIS_DEFAULT_BASE_URL}/tarefas-situacao`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${acc}`,
    },
    body: JSON.stringify(body),
  });
  await res.text();
  return res.status;
}

async function main() {
  const c = createProjurisClientFromEnv();
  const { token } = await c.authenticateTryingVariants();
  const acc = (token as { access_token?: string }).access_token ?? String(token);

  const antes = await situacaoAtual(c);
  if (!antes) {
    console.log(`Tarefa ${COD} não apareceu na consulta — abortando (não mexo no que não vejo).`);
    return;
  }
  console.log(`Tarefa ${COD} — situação ANTES: ${antes.cod} (${antes.nome})\n`);

  // A tarefa tem DOIS códigos e isso é a pegadinha: `codigoTarefa` (57057685) e
  // `codigoTarefaEvento` (58497726). O de-para do SHV guarda o EVENTO. Testo os dois.
  const EV = COD;
  const TAR = Number(antes.codigoTarefa);
  console.log(`  (codigoTarefa=${TAR} · codigoTarefaEvento=${EV})
`);
  const candidatos: Array<[string, unknown]> = [
    ["evento + codigoTarefaEventoSituacao", { codigosTarefa: [EV], codigoTarefaEventoSituacao: ALVO }],
    ["tarefa + codigoTarefaEventoSituacao", { codigosTarefa: [TAR], codigoTarefaEventoSituacao: ALVO }],
    ["evento + situacaoWs", { codigosTarefa: [EV], tarefaEventoSituacaoWs: { codigoTarefaEventoSituacao: ALVO, situacaoConcluida: true } }],
    ["codigosTarefaEvento[]", { codigosTarefaEvento: [EV], codigoTarefaEventoSituacao: ALVO }],
    ["lista de objetos (evento)", { tarefas: [{ codigoTarefaEvento: EV, codigoTarefaEventoSituacao: ALVO }] }],
    ["singular evento", { codigoTarefaEvento: EV, codigoTarefaEventoSituacao: ALVO }],
  ];

  let vencedor: string | null = null;
  try {
    for (const [rot, body] of candidatos) {
      const st = await put(acc, body);
      const dep = await situacaoAtual(c);
      const mudou = String(dep?.cod) === String(ALVO);
      console.log(`${mudou ? "✔ FUNCIONOU" : "·          "} ${String(st).padEnd(4)} ${rot} → agora ${dep?.cod} (${dep?.nome})`);
      if (mudou) {
        vencedor = rot;
        console.log(`\n>>> PAYLOAD QUE FUNCIONA:\n${JSON.stringify(body, null, 2)}\n`);
        break;
      }
    }
    if (!vencedor) console.log("\nNenhum dos formatos alterou a situação.");
  } finally {
    // Reverte SEMPRE — inclusive se deu erro no meio.
    if (vencedor) {
      const original = Number(antes.cod);
      for (const [, body] of candidatos) {
        const b = JSON.parse(JSON.stringify(body).replaceAll(String(ALVO), String(original)));
        await put(acc, b);
        const dep = await situacaoAtual(c);
        if (String(dep?.cod) === String(original)) {
          console.log(`REVERTIDO para ${dep?.cod} (${dep?.nome}).`);
          break;
        }
      }
    } else {
      console.log("Nada foi alterado — nada a reverter.");
    }
  }
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
