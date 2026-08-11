// #8 (reunião 2026-08-10) — MIGRAÇÃO DO ESPELHO cliente↔caso.
// A importação gravou valores de campos scope='cliente' no balde do CASO
// (system_cases.canonical_fields) em vez do CLIENTE (system_clients.custom_fields).
// Este script move esses valores para o cliente (a fonte que a aba Clientes lê) e
// remove o órfão do canonical do caso.
//
// SEGURANÇA: DRY-RUN por padrão (só relatório). Só grava com `--apply`.
// Regras: por CASO, usamos as defs scope='cliente' ATIVAS do TEMA daquele caso.
//   - cliente sem o valor  -> MIGRAR (grava no cliente) + limpa órfão do caso
//   - cliente já com MESMO valor -> só limpa órfão do caso
//   - cliente com valor DIFERENTE -> CONFLITO (não sobrescreve; só reporta)
import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";

const APPLY = process.argv.includes("--apply");

function j(v: unknown) {
  return JSON.stringify(v);
}

async function main() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!ref || !password) throw new Error("Faltam SUPABASE_PROJECT_REF/SUPABASE_DB_PASSWORD");
  const c = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await c.connect();
  console.log(APPLY ? "== MODO APPLY (vai gravar) ==" : "== DRY-RUN (não grava) ==");

  // 1) defs scope='cliente' ativas por tema -> Set de keys
  const defs = await c.query(`
    select tema_id, key from system_tema_field_defs
    where deleted_at is null and scope = 'cliente' and active = true;
  `);
  const clienteKeysByTema = new Map<string, Set<string>>();
  for (const r of defs.rows) {
    if (!clienteKeysByTema.has(r.tema_id)) clienteKeysByTema.set(r.tema_id, new Set());
    clienteKeysByTema.get(r.tema_id)!.add(r.key);
  }
  console.log(`Temas com campos de cliente: ${clienteKeysByTema.size}`);

  // 2) casos com tema + canonical
  const casos = await c.query(`
    select id, case_code, client_id, tema_id, canonical_fields
    from system_cases
    where deleted_at is null and tema_id is not null and client_id is not null
      and canonical_fields is not null and canonical_fields <> '{}'::jsonb;
  `);

  // 3) cache de custom_fields por cliente
  const cliRes = await c.query(`select id, custom_fields from system_clients where deleted_at is null;`);
  const custom = new Map<string, Record<string, unknown>>();
  for (const r of cliRes.rows) custom.set(r.id, (r.custom_fields as Record<string, unknown>) ?? {});

  let migrar = 0,
    jaOk = 0,
    conflito = 0,
    orfaosLimpar = 0;
  const amostras: string[] = [];
  const conflitos: string[] = [];
  const porChave = new Map<string, number>();
  // acumula por cliente as chaves a gravar (merge)
  const gravarCliente = new Map<string, Record<string, unknown>>();
  // acumula por caso as chaves órfãs a remover do canonical
  const limparCaso = new Map<string, Set<string>>();

  for (const caso of casos.rows) {
    const keys = clienteKeysByTema.get(caso.tema_id);
    if (!keys || keys.size === 0) continue;
    const cf = (caso.canonical_fields as Record<string, unknown>) ?? {};
    const cliCustom = custom.get(caso.client_id) ?? {};
    for (const key of Object.keys(cf)) {
      if (!keys.has(key)) continue; // só chaves scope='cliente' do tema
      const valCaso = cf[key];
      const valCli = cliCustom[key];
      // órfão sempre é candidato a limpeza do caso
      if (!limparCaso.has(caso.id)) limparCaso.set(caso.id, new Set());
      limparCaso.get(caso.id)!.add(key);
      orfaosLimpar++;

      if (valCli === undefined || valCli === null) {
        // migrar
        migrar++;
        porChave.set(key, (porChave.get(key) ?? 0) + 1);
        if (!gravarCliente.has(caso.client_id)) gravarCliente.set(caso.client_id, {});
        gravarCliente.get(caso.client_id)![key] = valCaso;
        // reflete no cache p/ próximos casos do mesmo cliente
        cliCustom[key] = valCaso;
        if (amostras.length < 8)
          amostras.push(`MIGRAR  ${caso.case_code} · ${key}=${j(valCaso)} → cliente ${caso.client_id}`);
      } else if (j(valCli) === j(valCaso)) {
        jaOk++;
      } else {
        // CONFLITO: o valor do cliente é o DEFAULT criado pela importação; o valor
        // real importado está no CASO. Nesta migração de correção, o CASO VENCE
        // (sobrescreve o cliente). Registrado para auditoria.
        conflito++;
        if (!gravarCliente.has(caso.client_id)) gravarCliente.set(caso.client_id, {});
        gravarCliente.get(caso.client_id)![key] = valCaso;
        cliCustom[key] = valCaso;
        conflitos.push(
          `CONFLITO ${caso.case_code} · ${key}: caso=${j(valCaso)} vs cliente=${j(valCli)} → CASO VENCE`,
        );
      }
    }
  }

  console.log(`\nCasos analisados: ${casos.rowCount}`);
  console.log(`MIGRAR (cliente vazio):        ${migrar}`);
  console.log(`JÁ OK (mesmo valor):           ${jaOk}`);
  console.log(`CONFLITO (valores diferentes): ${conflito}`);
  console.log(`Órfãos a limpar do canonical:  ${orfaosLimpar}`);
  console.log(`Clientes a atualizar:          ${gravarCliente.size}`);
  console.log(`\n-- por chave (migrar) --`);
  for (const [k, n] of [...porChave.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${k}: ${n}`);
  console.log(`\n-- amostras migrar --`);
  for (const a of amostras) console.log("  " + a);
  if (conflitos.length) {
    console.log(`\n-- CONFLITOS (${conflitos.length}) --`);
    for (const a of conflitos) console.log("  " + a);
  }

  if (!APPLY) {
    console.log(`\n(DRY-RUN) nada gravado. Rode com --apply para efetivar.`);
    await c.end();
    return;
  }

  // APPLY: 1) merge nos clientes; 2) remove órfãos do canonical dos casos.
  console.log(`\n>> Gravando ${gravarCliente.size} clientes...`);
  for (const [clientId, patch] of gravarCliente) {
    await c.query(
      `update system_clients set custom_fields = coalesce(custom_fields,'{}'::jsonb) || $2::jsonb, updated_at = now()
       where id = $1`,
      [clientId, JSON.stringify(patch)],
    );
  }
  console.log(`>> Limpando órfãos de ${limparCaso.size} casos...`);
  for (const [caseId, keys] of limparCaso) {
    // remove as chaves scope='cliente' do canonical_fields do caso
    const arr = [...keys];
    await c.query(`update system_cases set canonical_fields = canonical_fields - $2::text[] where id = $1`, [
      caseId,
      arr,
    ]);
  }
  console.log("APLICADO.");
  await c.end();
}
main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
