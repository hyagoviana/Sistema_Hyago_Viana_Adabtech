// PRÉ-VISUALIZAÇÃO do cadastro de processo no ProJuris — mostra exatamente o
// corpo que seria enviado, e confirma que as listas do formulário respondem.
//
// NÃO ESCREVE NADA. É o passo que vem antes de autorizar o primeiro envio real:
// cadastrar processo cria registro na base do escritório, então a regra aqui é
// olhar primeiro.
//
// Uso:
//   npx tsx scripts/preview-processo-projuris.ts            # listas + exemplo
//   npx tsx scripts/preview-processo-projuris.ts <caseId>   # com um caso real
import { config } from "dotenv";

config({ path: ".env.local" });

import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";
import {
  LISTAS_DE_APOIO,
  montarProcessoJudicial,
  type NovoProcessoJudicial,
} from "../src/lib/projuris/criar-processo.js";

type ListaPlana = { simpleDto?: Array<{ chave: number; valor: string }> };
type Arvore = { nodeWs?: Array<{ chave: number; valor: string }> };

async function main() {
  const client = createProjurisClientFromEnv();
  await client.authenticateTryingVariants();

  console.log("═══ LISTAS QUE ALIMENTAM O FORMULÁRIO ═══════════════════════\n");
  const escolhas: Record<string, { chave: number; valor: string } | undefined> = {};
  for (const [nome, rota] of Object.entries(LISTAS_DE_APOIO)) {
    try {
      const r = await client.projurisGet<ListaPlana & Arvore>(rota);
      const itens = r.simpleDto ?? r.nodeWs ?? [];
      escolhas[nome] = itens[0];
      const amostra = itens
        .slice(0, 3)
        .map((i) => `${i.chave}=${i.valor}`)
        .join(" · ");
      console.log(`  ${nome.padEnd(12)} ${String(itens.length).padStart(4)} itens   ${amostra}`);
    } catch (err) {
      console.log(
        `  ${nome.padEnd(12)} ERRO: ${err instanceof Error ? err.message.slice(0, 90) : err}`,
      );
    }
  }

  // Monta um exemplo com as chaves REAIS que acabaram de vir do ProJuris.
  const exemplo: NovoProcessoJudicial = {
    numeroCnj: "0000000-00.2026.4.01.0000",
    nomePasta: "FULANO DE TAL — exemplo",
    assunto: "RESTITUIÇÃO INSS",
    codigoJustica: escolhas.justicas?.chave ?? null,
    codigoArea: escolhas.areas?.chave ?? null,
    codigoTipoVara: escolhas.tiposVara?.chave ?? null,
    codigoSituacao: escolhas.situacoes?.chave ?? null,
    codigoClasseCnj: escolhas.classes?.chave ?? null,
    codigoAssuntoCnj: escolhas.assuntos?.chave ?? null,
    dataDistribuicao: "2026-08-31",
    codigoExterno: "MAISMEDICOS-2026-0001",
  };

  console.log("\n═══ CORPO QUE SERIA ENVIADO (POST /processo-judicial) ═══════\n");
  console.log(JSON.stringify(montarProcessoJudicial(exemplo), null, 2));

  console.log("\n═══ LEITURA ═════════════════════════════════════════════════");
  console.log("  · Nenhuma escrita foi feita. Este script só monta e imprime.");
  console.log("  · As chaves acima são REAIS, vieram do ProJuris agora.");
  console.log("  · Falta apenas autorizar UM envio de teste para confirmar o");
  console.log("    contrato ponta a ponta (cria um processo real lá).");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
