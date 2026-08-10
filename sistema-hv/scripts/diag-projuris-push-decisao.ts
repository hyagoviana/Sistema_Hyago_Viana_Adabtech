// Sonda campos de MONITORAMENTO (push) e ÚLTIMA DECISÃO no /processo. SO LEITURA.
import { config } from "dotenv";
config({ path: ".env.local" });

import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

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
  ].slice(0, 5);

  for (const cod of codes) {
    const proc = await client.projurisGet<Record<string, unknown>>(`processo/${cod}`);
    console.log(`\n===== processo ${cod} (${proc.identificador ?? "?"}) =====`);
    console.log(`  capturaHabilitada           : ${JSON.stringify(proc.capturaHabilitada)}`);
    console.log(
      `  processoJudicialCapturado   : ${JSON.stringify(proc.processoJudicialCapturado)}`,
    );
    console.log(
      `  quantidadeAndamentosCapturados: ${JSON.stringify(proc.quantidadeAndamentosCapturados)}`,
    );
    console.log(`  dataUltimaModificacao       : ${JSON.stringify(proc.dataUltimaModificacao)}`);
    const andWs = proc.andamentoWs;
    if (Array.isArray(andWs) && andWs.length) {
      console.log(
        `  andamentoWs (${andWs.length} itens) — chaves do 1o: ${Object.keys(andWs[0] as object)
          .sort()
          .join(", ")}`,
      );
      // mostra os 2 primeiros (assumindo ordem desc? checar datas)
      for (const a of andWs.slice(0, 3)) {
        const o = a as Record<string, unknown>;
        console.log(
          `    · data=${JSON.stringify(o.dataAndamento ?? o.data)} tipo=${JSON.stringify(o.tipoAndamento ?? o.tipo)} desc=${String(o.descricao ?? o.descricaoAndamento ?? "").slice(0, 70)}`,
        );
      }
    } else {
      console.log(`  andamentoWs                 : ${JSON.stringify(andWs)}`);
    }
  }
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
