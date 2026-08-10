// Monta o de-para PES (identificador do /pessoa) <-> codigo de usuario (chave do
// /usuario) casando por NOME normalizado, e PUXA telefone/email do /pessoa para
// preencher system_users.phone dos executores.
//
// SO LEITURA no ProJuris. Escrita: UPDATE system_users.phone (com --apply).
// Gera artefato scripts/depara-pes-codigo.json.
//
// Uso:  npx tsx --env-file=.env.local scripts/build-depara-pes.ts [--apply]
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync } from "node:fs";
import pg from "pg";
import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";

const APPLY = process.argv.includes("--apply");
const ORG = "00000000-0000-0000-0000-000000000001";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

const onlyDigits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

function firstArrayDeep(obj: unknown): unknown[] {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") {
        const inner = firstArrayDeep(v);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

async function main() {
  const client = createProjurisClientFromEnv();
  await client.authenticateTryingVariants();

  // 1) usuarios (chave=codigo, valor=nome).
  const us = firstArrayDeep(await client.projurisGet<unknown>("usuario")) as Array<
    Record<string, unknown>
  >;
  const usuarios = us.map((u) => ({ codigo: String(u.chave ?? ""), nome: String(u.valor ?? "") }));
  const usuarioByNome = new Map(usuarios.map((u) => [norm(u.nome), u.codigo]));

  // 2) pessoas — pagina até cobrir totalRegistros (200/pagina).
  const env0 = (await client.projurisGet<Record<string, unknown>>("pessoa/consulta")) ?? {};
  const total = Number(env0.totalRegistros ?? 0);
  const pessoas: Record<string, unknown>[] = [];
  const maxPag = Math.min(30, Math.ceil((total || 200) / 200));
  for (let p = 1; p <= maxPag; p++) {
    const env =
      p === 1
        ? env0
        : ((await client.projurisGet<Record<string, unknown>>("pessoa/consulta", { pagina: p })) ??
          {});
    const arr = (env.pessoaConsulta as Record<string, unknown>[]) ?? [];
    if (!arr.length) break;
    pessoas.push(...arr);
  }
  console.log(`usuarios: ${usuarios.length} | pessoas coletadas: ${pessoas.length}/${total}`);

  // 3) de-para: para cada pessoa que casa com um usuario, guarda PES + contato.
  const depara: Array<{
    usuario_codigo: string;
    pes: string;
    codigo_pessoa: string;
    nome: string;
    email: string | null;
    telefone: string | null;
  }> = [];
  const vistos = new Set<string>();
  for (const p of pessoas) {
    const nome = String(p.nome ?? "");
    const cod = usuarioByNome.get(norm(nome));
    if (!cod || vistos.has(cod)) continue;
    vistos.add(cod);
    depara.push({
      usuario_codigo: cod,
      pes: String(p.identificador ?? ""),
      codigo_pessoa: String(p.codigoPessoa ?? ""),
      nome,
      email: (p.emailPrincipal as string) || null,
      telefone: onlyDigits(p.telefonePrincipal) || null,
    });
  }

  writeFileSync("scripts/depara-pes-codigo.json", JSON.stringify({ depara }, null, 2), "utf-8");
  console.log(`\nDE-PARA PES <-> codigo de usuario (${depara.length}/${usuarios.length} casaram):`);
  for (const d of depara) {
    console.log(
      `  ${d.pes.padEnd(13)} -> usuario ${d.usuario_codigo.padEnd(8)} | ${d.nome.slice(0, 26).padEnd(26)} | tel=${d.telefone ?? "-"}`,
    );
  }
  const semCasar = usuarios.filter((u) => !vistos.has(u.codigo));
  if (semCasar.length)
    console.log(`\nNAO casaram (${semCasar.length}): ${semCasar.map((u) => u.nome).join(", ")}`);

  // 4) (--apply) preenche system_users.phone dos executores casados.
  if (!APPLY) {
    console.log("\n(DRY-RUN) Use --apply para gravar os telefones em system_users.phone.");
    return;
  }
  const c = new pg.Client({
    host: `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  let n = 0;
  for (const d of depara) {
    if (!d.telefone) continue;
    const r = await c.query(
      `update system_users u set phone = $3, updated_at = now()
         from system_projuris_executor_mapping m
        where m.executor_id = u.id and m.organization_id = $1
          and m.projuris_responsavel_id = $2 and (u.phone is null or u.phone = '')`,
      [ORG, d.usuario_codigo, d.telefone],
    );
    n += r.rowCount ?? 0;
  }
  console.log(`\nOK — ${n} telefone(s) preenchido(s) em system_users.phone.`);
  await c.end();
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
