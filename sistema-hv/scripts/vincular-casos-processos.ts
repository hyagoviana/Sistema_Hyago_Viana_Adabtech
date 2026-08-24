// Vincula os CASOS do SHV aos PROCESSOS do ProJuris.
//
// É o gargalo da tela 2 do motor: sem esse vínculo o sistema não sabe o TEMA do
// caso, e sem tema não há multiplicador de pontuação. Hoje, dos 411 casos,
// NENHUM tem processo vinculado — o campo existe, mas nunca foi preenchido.
//
// Como casa (em ordem de confiança):
//   1. CNJ já gravado no caso (se algum dia for preenchido) — vínculo direto
//   2. Nome do cliente + o cliente tem UM único processo no ProJuris
//   3. Nome do cliente com VÁRIOS processos: só casa se o caso também for único
//      do cliente E houver um processo cujo assunto bata com o tema do caso
//
// O que NÃO faz: adivinhar. Ambiguidade sobra para revisão humana.
//
// Uso:
//   npx tsx scripts/vincular-casos-processos.ts              (diagnóstico)
//   npx tsx scripts/vincular-casos-processos.ts --executar   (grava os vínculos)

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig, ORG_ID } from "@/lib/distribuicao/sync-core";

const EXECUTAR = process.argv.includes("--executar");

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

interface ProcessoPJ {
  codigo: string;
  cnj: string | null;
  cliente: string;
  assunto: string | null;
  identificador: string | null;
  encerrado: boolean;
}

async function carregarProcessos(): Promise<ProcessoPJ[]> {
  const client = await buildProjurisClientFromConfig(getSupabaseAdmin());
  await client.authenticateTryingVariants();
  const todos: ProcessoPJ[] = [];
  for (let pagina = 1; pagina <= 60; pagina++) {
    const r = await client.projurisPostConsulta<{
      processoConsultaResumoWs?: Array<Record<string, unknown>>;
    }>("v2/processo/consulta", {}, { pagina, "quan-registros": 200 });
    const lote = r.processoConsultaResumoWs ?? [];
    if (!lote.length) break;
    for (const p of lote) {
      const cliente = typeof p.nomeCliente === "string" ? p.nomeCliente.trim() : "";
      if (!cliente) continue;
      todos.push({
        codigo: String(p.codigoProcesso ?? ""),
        cnj: typeof p.numeroProcesso === "string" ? p.numeroProcesso : null,
        cliente,
        assunto: typeof p.assunto === "string" ? p.assunto : null,
        identificador: typeof p.identificador === "string" ? p.identificador : null,
        encerrado: p.flEncerrado === true,
      });
    }
    if (lote.length < 200) break;
  }
  return todos;
}

async function main() {
  console.log(EXECUTAR ? "MODO: EXECUTAR\n" : "MODO: diagnóstico (use --executar para gravar)\n");
  const sb = getSupabaseAdmin();

  const processos = await carregarProcessos();
  console.log(`ProJuris: ${processos.length} processos com cliente`);

  // Processos agrupados por nome de cliente.
  const porCliente = new Map<string, ProcessoPJ[]>();
  for (const p of processos) {
    const k = norm(p.cliente);
    porCliente.set(k, [...(porCliente.get(k) ?? []), p]);
  }

  const { data: casos } = await sb
    .from("system_cases")
    .select("id, case_code, client_id, tema_id, projuris_codigo_processo, projuris_numero_processo")
    .is("deleted_at", null);

  const { data: clientes } = await sb
    .from("system_clients")
    .select("id, full_name")
    .is("deleted_at", null);
  const nomeDoCliente = new Map((clientes ?? []).map((c) => [c.id, c.full_name ?? ""]));

  const { data: temas } = await sb.from("system_temas").select("id, name");
  const nomeDoTema = new Map((temas ?? []).map((t) => [t.id, t.name ?? ""]));

  // Quantos casos cada cliente tem (para saber quando o vínculo é seguro).
  const casosPorCliente = new Map<string, number>();
  for (const c of casos ?? []) {
    if (c.client_id) casosPorCliente.set(c.client_id, (casosPorCliente.get(c.client_id) ?? 0) + 1);
  }

  let jaVinculado = 0;
  let semCliente = 0;
  let clienteSemProcesso = 0;
  const diretos: Array<{ caso: string; id: string; proc: ProcessoPJ }> = [];
  const porTema: Array<{ caso: string; id: string; proc: ProcessoPJ; tema: string }> = [];
  const ambiguos: Array<{ caso: string; cliente: string; qtd: number }> = [];

  for (const caso of casos ?? []) {
    if (caso.projuris_codigo_processo != null) {
      jaVinculado++;
      continue;
    }
    if (!caso.client_id) {
      semCliente++;
      continue;
    }
    const nome = nomeDoCliente.get(caso.client_id) ?? "";
    const doCliente = (porCliente.get(norm(nome)) ?? []).filter((p) => !p.encerrado);

    if (doCliente.length === 0) {
      clienteSemProcesso++;
      continue;
    }
    if (doCliente.length === 1) {
      diretos.push({ caso: caso.case_code ?? caso.id, id: caso.id, proc: doCliente[0] });
      continue;
    }

    // Vários processos do mesmo cliente: só casa se o caso for único do cliente
    // E houver exatamente um processo cujo assunto lembre o tema.
    const tema = caso.tema_id ? (nomeDoTema.get(caso.tema_id) ?? "") : "";
    const unicoCaso = (casosPorCliente.get(caso.client_id) ?? 0) === 1;
    const combinam = tema
      ? doCliente.filter((p) => {
          const a = norm(p.assunto ?? "");
          const t = norm(tema);
          return a && t && (a.includes(t) || t.includes(a));
        })
      : [];
    if (unicoCaso && combinam.length === 1) {
      porTema.push({ caso: caso.case_code ?? caso.id, id: caso.id, proc: combinam[0], tema });
    } else {
      ambiguos.push({ caso: caso.case_code ?? caso.id, cliente: nome, qtd: doCliente.length });
    }
  }

  const total = (casos ?? []).length;
  console.log(`SHV: ${total} casos ativos\n`);
  console.log(`  já vinculados            : ${jaVinculado}`);
  console.log(`  ✅ casam direto (1 proc) : ${diretos.length}`);
  console.log(`  ✅ casam por tema        : ${porTema.length}`);
  console.log(`  ⚠️  ambíguos (vários)     : ${ambiguos.length}`);
  console.log(`  ·  cliente sem processo  : ${clienteSemProcesso}`);
  console.log(`  ·  caso sem cliente      : ${semCliente}`);
  console.log(
    `\n  → vinculáveis agora: ${diretos.length + porTema.length} de ${total} (${Math.round(((diretos.length + porTema.length) / total) * 100)}%)`,
  );

  console.log(`\namostra dos diretos:`);
  for (const d of diretos.slice(0, 5))
    console.log(
      `  ${d.caso.padEnd(26)} → ${d.proc.identificador} · ${d.proc.cliente.slice(0, 34)}`,
    );
  if (porTema.length) {
    console.log(`\namostra dos casados por tema:`);
    for (const d of porTema.slice(0, 5))
      console.log(
        `  ${d.caso.padEnd(26)} → ${d.proc.identificador} · tema "${d.tema}" ≈ "${d.proc.assunto}"`,
      );
  }
  if (ambiguos.length) {
    console.log(`\namostra dos ambíguos (ficam para revisão humana):`);
    for (const a of ambiguos.slice(0, 5))
      console.log(`  ${a.caso.padEnd(26)} · ${a.cliente.slice(0, 32)} tem ${a.qtd} processos`);
  }

  if (!EXECUTAR) {
    console.log("\n(nada foi gravado — rode com --executar)");
    return;
  }

  console.log(`\ngravando ${diretos.length + porTema.length} vínculos…`);
  let ok = 0;
  for (const d of [...diretos, ...porTema]) {
    const { error } = await sb
      .from("system_cases")
      .update({
        projuris_codigo_processo: Number(d.proc.codigo),
        projuris_numero_processo: d.proc.cnj,
      } as never)
      .eq("id", d.id);
    if (error) {
      console.log(`  ✗ ${d.caso}: ${error.message}`);
      continue;
    }
    ok++;
  }
  console.log(`✔ ${ok} vínculos gravados`);
  void ORG_ID;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
