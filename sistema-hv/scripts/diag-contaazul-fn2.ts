// SPIKE da FN2 — o que a API do ContaAzul realmente oferece (doc 25.08).
//
// As 4 perguntas que o owner mandou confirmar:
//   1. Existe venda de serviço / contrato RECORRENTE por API? (é o que decide se
//      a limitação das 24 competências nos atinge)
//   2. Existe contas a PAGAR (despesa)?
//   3. Dá para listar categorias, centro de custo e serviço?
//   4. Existe o endpoint da importação por IA que ele viu no painel?
//
// SOMENTE LEITURA (GET). Nenhuma escrita, nenhum registro criado.
//
// Uso: npx tsx scripts/diag-contaazul-fn2.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

const BASE = "https://api-v2.contaazul.com";

async function token(): Promise<string> {
  const clientId = process.env.CONTAAZUL_CLIENT_ID;
  const clientSecret = process.env.CONTAAZUL_CLIENT_SECRET;
  const refresh = process.env.CONTAAZUL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refresh) {
    throw new Error("Faltam CONTAAZUL_CLIENT_ID / _SECRET / _REFRESH_TOKEN no .env.local");
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://auth.contaazul.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Falha no refresh (${res.status}): ${txt.slice(0, 300)}`);
  const json = JSON.parse(txt) as { access_token?: string };
  if (!json.access_token) throw new Error("Refresh sem access_token");
  return json.access_token;
}

/** GET simples que NUNCA lança: devolve status + amostra, para o relatório. */
async function sonda(
  access: string,
  caminho: string,
): Promise<{ caminho: string; status: number; amostra: string }> {
  try {
    const res = await fetch(`${BASE}/${caminho}`, {
      headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
    });
    const txt = await res.text();
    return { caminho, status: res.status, amostra: txt.slice(0, 240).replace(/\s+/g, " ") };
  } catch (err) {
    return { caminho, status: 0, amostra: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const access = await token();
  console.log("Autenticado.\n");

  // Endpoints já usados pelo sistema (controle: têm de responder 200).
  const conhecidos = [
    "v1/categorias",
    "v1/servicos",
    "v1/conta-financeira",
    "v1/pessoas?tamanho_pagina=1",
  ];

  // Candidatos para as perguntas em aberto. Nomes derivados do padrão da API v2
  // (v1/financeiro/eventos-financeiros/...) e do vocabulário do painel.
  const candidatos = [
    // 2. contas a PAGAR
    "v1/financeiro/eventos-financeiros/contas-a-pagar/buscar",
    "v1/financeiro/eventos-financeiros/contas-a-pagar",
    // 1. venda / contrato recorrente
    "v1/vendas",
    "v1/venda",
    "v1/contratos",
    "v1/vendas/contratos",
    "v1/financeiro/vendas",
    // 3. centro de custo
    "v1/centros-de-custo",
    "v1/centro-de-custo",
    "v1/centros-custo",
    // 4. importação por IA
    "v1/importacoes",
    "v1/importacao",
  ];

  console.log("── Controle (o que já usamos) ───────────────────────────────");
  for (const c of conhecidos) {
    const r = await sonda(access, c);
    console.log(`${String(r.status).padEnd(4)} ${r.caminho}`);
  }

  console.log("\n── Candidatos (as 4 perguntas) ──────────────────────────────");
  for (const c of candidatos) {
    const r = await sonda(access, c);
    const marca = r.status === 200 ? "✔" : r.status === 404 ? "·" : "?";
    console.log(`${marca} ${String(r.status).padEnd(4)} ${c}`);
    if (r.status !== 404 && r.status !== 0) console.log(`      ${r.amostra}`);
  }

  // Detalhe do que interessa: as categorias de DESPESA existem lá?
  console.log("\n── Categorias (amostra) ─────────────────────────────────────");
  const cat = await sonda(access, "v1/categorias");
  console.log(cat.amostra);
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
