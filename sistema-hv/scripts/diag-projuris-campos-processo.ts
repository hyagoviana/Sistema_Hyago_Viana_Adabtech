// Dump dos CAMPOS do /processo (valores reais) para mapear os campos judiciais
// espelhados (docx do Thiago). SO LEITURA. Pega processos das intimacoes recentes.
import { config } from "dotenv";
config({ path: ".env.local" });

import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

const CAMPOS = [
  "orgaoJudicial",
  "orgaoJudicialConcatenado",
  "classeCnj",
  "assuntoCnj",
  "assunto",
  "situacaoProcesso",
  "valorAcao",
  "valorProvisionado",
  "valorCondenacao",
  "fase",
  "instanciaCnj",
  "dataDistribuicao",
  "dataJulgamento",
  "resultadoEncerramento",
  "descricaoEncerramento",
  "vara",
  "tipoVara",
  "estado",
  "cidade",
  "area",
  "tipoJustica",
  "numeroProcesso",
  "identificador",
  // candidatos p/ Monitoramento (Push) e última decisão
  "monitoramento",
  "monitoramentoPush",
  "push",
  "flagMonitoramento",
  "flagPush",
  "monitoramentoAtivo",
  "publicacaoAutomatica",
  "ultimaMovimentacao",
  "ultimoAndamento",
  "ultimaDecisao",
  "dataUltimaMovimentacao",
];

// Também dumpa TODAS as chaves de topo do 1o processo, p/ achar campos não previstos.
const DUMP_ALL_KEYS = true;

async function main() {
  const client = createProjurisClientFromEnv();
  await client.authenticateTryingVariants();

  const hoje = new Date().toISOString().slice(0, 10);
  const intResp = await client.projurisPostConsulta<{
    intimacaoConsultaWs?: Array<Record<string, unknown>>;
  }>("intimacao/consulta", {
    tipoDataFiltroIntimacao: "DATA_DA_DISPONIBILIZACAO",
    dataPeriodoInicial: addDaysIso(hoje, -30),
    dataPeriodoFinal: hoje,
    dadosOrigemFiltro: true,
  });
  const codes = [
    ...new Set(
      (intResp.intimacaoConsultaWs ?? [])
        .map((x) => x.codigoProcesso)
        .filter((v): v is number => typeof v === "number"),
    ),
  ].slice(0, 4);

  let dumpedKeys = false;
  for (const cod of codes) {
    const proc = await client.projurisGet<Record<string, unknown>>(`processo/${cod}`);
    console.log(`\n===== processo ${cod} (${proc.identificador ?? "?"}) =====`);
    if (DUMP_ALL_KEYS && !dumpedKeys) {
      console.log(`  [TODAS AS CHAVES] ${Object.keys(proc).sort().join(", ")}`);
      dumpedKeys = true;
    }
    for (const c of CAMPOS) {
      const v = proc[c];
      const sv =
        v == null ? "(null)" : typeof v === "object" ? JSON.stringify(v).slice(0, 90) : String(v);
      console.log(`  ${c.padEnd(24)}: ${sv}`);
    }
  }
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
