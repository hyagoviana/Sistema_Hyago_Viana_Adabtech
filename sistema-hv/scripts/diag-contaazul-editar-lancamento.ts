// SPIKE (31/08) — a pergunta do Thiago: "dá para alterar EM LOTE a categoria
// financeira / centro de custo de lançamentos ANTERIORES do ContaAzul, pela API?"
//
// A documentação que temos só descreve categoria/centro de custo na CRIAÇÃO do
// lançamento. Este script existe para cravar se há rota de EDIÇÃO escondida.
//
// SEGURANÇA: todas as chamadas de escrita usam um UUID que NÃO EXISTE
// (00000000-…-000000000000). Se a rota existir, a resposta é 404/422 de "não
// encontrado" — nenhum lançamento real é tocado. O que interessa aqui é
// distinguir "rota existe mas o id não" de "rota não existe" (404 de roteamento
// / 405 method-not-allowed).
//
// Uso: npx tsx scripts/diag-contaazul-editar-lancamento.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

const BASE = "https://api-v2.contaazul.com";
const ID_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

import { getAccessToken } from "../src/lib/contaazul/client";

async function sonda(
  access: string,
  metodo: string,
  caminho: string,
  body?: unknown,
): Promise<void> {
  try {
    const res = await fetch(`${BASE}/${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${access}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const txt = (await res.text()).slice(0, 200).replace(/\s+/g, " ");
    const marca = res.status === 404 || res.status === 502 ? "·" : res.status < 500 ? "?" : "·";
    console.log(`${marca} ${res.status}  ${metodo} ${caminho}`);
    if (txt) console.log(`      ${txt}`);
  } catch (err) {
    console.log(`· ERRO ${metodo} ${caminho}: ${err instanceof Error ? err.message : err}`);
  }
}

async function main() {
  const access = await getAccessToken();
  console.log("Autenticado.\n");

  console.log("── Rota individual de conta a receber (leitura) ──────────────");
  await sonda(
    access,
    "GET",
    `v1/financeiro/eventos-financeiros/contas-a-receber/${ID_INEXISTENTE}`,
  );
  await sonda(access, "GET", `v1/financeiro/eventos-financeiros/${ID_INEXISTENTE}`);

  console.log("\n── Edição de conta a receber (id inexistente, nada é alterado) ──");
  await sonda(
    access,
    "PATCH",
    `v1/financeiro/eventos-financeiros/contas-a-receber/${ID_INEXISTENTE}`,
    { observacao: "sonda" },
  );
  await sonda(
    access,
    "PUT",
    `v1/financeiro/eventos-financeiros/contas-a-receber/${ID_INEXISTENTE}`,
    {
      observacao: "sonda",
    },
  );

  console.log("\n── Edição de PARCELA: aceita categoria/centro de custo? ──────");
  // O PATCH de parcela é documentado, mas só para vencimento/valor/observação/
  // conta financeira. Se ele ACEITASSE categoria, o erro para o id inexistente
  // viria depois da validação de corpo — e um corpo inválido dá 400 citando o
  // campo. É assim que se descobre se o campo é reconhecido.
  await sonda(access, "PATCH", `v1/financeiro/eventos-financeiros/parcelas/${ID_INEXISTENTE}`, {
    categoria: ID_INEXISTENTE,
  });
  await sonda(access, "PATCH", `v1/financeiro/eventos-financeiros/parcelas/${ID_INEXISTENTE}`, {
    rateio_centro_custo: [{ id_centro_custo: ID_INEXISTENTE, valor: 1 }],
  });

  console.log("\n── Alguma rota de operação em LOTE? ─────────────────────────");
  await sonda(access, "POST", "v1/financeiro/eventos-financeiros/contas-a-receber/lote");
  await sonda(access, "POST", "v1/financeiro/eventos-financeiros/contas-a-receber/atualizar-lote");
  await sonda(access, "PUT", "v1/financeiro/eventos-financeiros/contas-a-receber/categoria");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
