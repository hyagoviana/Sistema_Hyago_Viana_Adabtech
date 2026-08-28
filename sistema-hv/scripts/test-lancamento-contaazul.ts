// Prova de ponta a ponta do "Fazer lançamento" (FN2), contra a conta REAL.
//
// SEGURANÇA — o que este teste faz para não sujar a base do escritório:
//   · usa o cliente que o próprio Thiago criou para isso: "thiago correia silva
//     (teste CA)", CPF 988.119.405-91. Nenhum cliente real é tocado;
//   · valor de R$ 1,00 e descrição gritante "[TESTE SHV — PODE APAGAR]";
//   · cria caso + lançamento TEMPORÁRIOS no SHV e apaga os dois no fim, sempre;
//   · roda o caminho de produção (`fazerLancamento`), não um atalho.
//
// ⚠️ O registro criado no ContaAzul provavelmente NÃO sai pela API: as rotas de
// DELETE respondem 404 genérico e não dá para distinguir "rota não existe" de
// "id não existe". O script informa o id no fim para exclusão pela tela.
//
// Uso: npx tsx scripts/test-lancamento-contaazul.ts
import { config } from "dotenv";

config({ path: ".env.local" });

import pg from "pg";
import { fazerLancamento } from "../src/lib/contaazul/lancamento-service";
import { listarContasParaSelecao } from "../src/lib/contaazul/catalogo-service";

const ORG = "00000000-0000-0000-0000-000000000001";
const CLIENTE_TESTE_CA = "608d0239-4e06-4a13-b388-16a81d2a946c";
const SUFIXO = String(Date.now()).slice(-6);
const DESCRICAO = `[TESTE SHV — PODE APAGAR] validação da integração ${SUFIXO}`;

async function main() {
  const db = new pg.Client({
    host: `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const contas = await listarContasParaSelecao();
  const conta = contas.find((c) => /conta azul/i.test(c.nome)) ?? contas[0];
  console.log(`Conta escolhida para o teste: ${conta.nome}`);

  // Categoria JÁ vinculada (sem isso o lançamento é recusado, corretamente).
  const { rows: cats } = await db.query(
    `select id, codigo, nome from system_fin_categorias
      where contaazul_id is not null and kind = 'RECEITA' and deleted_at is null limit 1`,
  );
  if (!cats.length) {
    console.log("Nenhuma categoria de receita vinculada — rode o de-para primeiro.");
    return;
  }
  console.log(`Categoria: ${cats[0].codigo} ${cats[0].nome}`);

  // Cliente de teste no SHV, apontando para a pessoa de teste do ContaAzul.
  const { rows: cli } = await db.query(
    `insert into system_clients (organization_id, full_name, cpf_cnpj, contaazul_customer_id)
     values ($1, '[TESTE SHV] cliente temporário', $3, $2) returning id`,
    [ORG, CLIENTE_TESTE_CA, `TESTE-LANC-${SUFIXO}`],
  );
  const { rows: caso } = await db.query(
    `insert into system_cases (organization_id, client_id, case_code, case_type)
     values ($1, $2, $3, 'FIES') returning id`,
    [ORG, cli[0].id, `TESTE-LANC-${SUFIXO}`],
  );
  const venc = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const { rows: ent } = await db.query(
    `insert into system_case_fin_entries
       (organization_id, case_id, kind, tipo, categoria_id, status, descricao,
        valor_centavos, forma_pagamento, conta_financeira, data_vencimento, parcelas)
     values ($1, $2, 'RECEITA', 'ENTRADA', $3, 'AGUARDANDO', $4, 100, 'PIX', $5, $6, 1)
     returning id`,
    [ORG, caso[0].id, cats[0].id, DESCRICAO, conta.id, venc],
  );
  console.log(`\nLançamento de teste criado no SHV (R$ 1,00, vence ${venc}).`);

  let registroId: string | null = null;
  try {
    const r = await fazerLancamento(ent[0].id);
    console.log(`\nResultado: ${JSON.stringify(r)}`);
    if (r.lancado) {
      registroId = r.registroId;
      console.log("\n✅ LANÇOU E CONFIRMOU no ContaAzul.");
      // Idempotência: segunda chamada não pode criar outro.
      const r2 = await fazerLancamento(ent[0].id);
      console.log(
        `2ª chamada: ${JSON.stringify(r2)} ${r2.lancado && r2.jaEstava ? "→ NÃO duplicou ✔" : "→ ATENÇÃO"}`,
      );
    } else {
      console.log(`\n❌ não lançou: ${r.motivo}`);
    }
  } finally {
    await db.query(`delete from system_case_fin_installments where entry_id = $1`, [ent[0].id]);
    await db.query(`delete from system_case_fin_entries where id = $1`, [ent[0].id]);
    await db.query(`delete from system_cases where id = $1`, [caso[0].id]);
    await db.query(`delete from system_clients where id = $1`, [cli[0].id]);
    console.log("\nLimpeza no SHV: caso, cliente e lançamento temporários apagados.");
    await db.end();
  }

  if (registroId) {
    console.log(
      `\n⚠️ NO CONTAAZUL ficou o registro ${registroId} — "${DESCRICAO}", R$ 1,00.\n   Apague pela tela (Financeiro → Contas a receber).`,
    );
  }
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
