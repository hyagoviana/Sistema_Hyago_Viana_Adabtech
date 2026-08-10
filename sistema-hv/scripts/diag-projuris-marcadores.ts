// Descobre os NOMES REAIS dos marcadores dos processos no ProJuris (para preencher
// marcadores.ts com os nomes certos de COMPLEXO/COLETIVO). SO LEITURA.
//
// Varre os processos das intimacoes recentes + (opcional) processos passados por
// argumento (ex.: PRO codes), e agrega todos os marcadores encontrados.
//
// Uso: npx tsx --env-file=.env.local scripts/diag-projuris-marcadores.ts [janelaDias] [cod1 cod2 ...]
import { config } from "dotenv";
config({ path: ".env.local" });

import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";
import { marcadorNames } from "../src/lib/projuris/normalizer.js";

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

async function main() {
  const janela = Number(process.argv[2] ?? "30") || 30;
  const codsExtra = process.argv.slice(3).filter((s) => /^\d+$/.test(s));

  const client = createProjurisClientFromEnv();
  await client.authenticateTryingVariants();

  // 1) Intimacoes recentes -> processos candidatos.
  const hoje = new Date().toISOString().slice(0, 10);
  const start = addDaysIso(hoje, -janela);
  const intResp = await client.projurisPostConsulta<{
    intimacaoConsultaWs?: Array<Record<string, unknown>>;
  }>("intimacao/consulta", {
    tipoDataFiltroIntimacao: "DATA_DA_DISPONIBILIZACAO",
    dataPeriodoInicial: start,
    dataPeriodoFinal: hoje,
    dadosOrigemFiltro: true,
  });
  const procCodes = [
    ...new Set(
      (intResp.intimacaoConsultaWs ?? [])
        .map((x) => x.codigoProcesso)
        .filter((v): v is number => typeof v === "number")
        .map(String),
    ),
    ...codsExtra,
  ].slice(0, 80);

  console.log(
    `Inspecionando ${procCodes.length} processos (janela ${janela}d + ${codsExtra.length} extras)...\n`,
  );

  const contagem = new Map<string, number>();
  let comMarcador = 0;
  for (const cod of procCodes) {
    try {
      const proc = await client.projurisGet<Record<string, unknown>>(`processo/${cod}`);
      const marc = marcadorNames(proc.marcadorWs);
      if (marc.length) {
        comMarcador++;
        for (const m of marc) contagem.set(m, (contagem.get(m) ?? 0) + 1);
      }
    } catch {
      /* ignora processo ilegivel */
    }
  }

  console.log(`Processos com algum marcador: ${comMarcador}/${procCodes.length}\n`);
  if (contagem.size === 0) {
    console.log("NENHUM marcador encontrado em marcadorWs. Talvez o campo tenha outro nome");
    console.log("no /processo. Vou dumpar o 1o processo cru para inspecao:");
    const proc = await client.projurisGet<Record<string, unknown>>(`processo/${procCodes[0]}`);
    for (const k of Object.keys(proc)) {
      if (/marc|tag|etiquet|classif/i.test(k)) {
        console.log(`   campo suspeito "${k}": ${JSON.stringify(proc[k]).slice(0, 200)}`);
      }
    }
    console.log("   TODAS as chaves do processo:", Object.keys(proc).join(", "));
    return;
  }

  console.log("MARCADORES ENCONTRADOS (nome | qtd processos):");
  [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([nome, n]) => console.log(`   "${nome}"  |  ${n}`));
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
