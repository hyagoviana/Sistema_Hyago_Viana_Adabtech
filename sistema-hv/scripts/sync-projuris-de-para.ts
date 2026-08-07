// Sincroniza o DE-PARA (cache local) código ProJuris → nome, para o motor de
// distribuição exibir NOME (não número) — story H1.
//
// O QUE FAZ (SÓ LEITURA no ProJuris; a única escrita é UPDATE de cache no banco):
//   1) Autentica no ProJuris e lê:
//        GET /usuario                      → 15 usuários  { chave: código, valor: nome }
//        GET /tipo?chave-tipo=tarefa-tipo  → 52 tipos     { chave: código, valor: nome }
//   2) TIPOS: atualiza system_task_type_mapping.projuris_tipo_descricao pelo
//      código real (projuris_tipo_codigo), quando este já for numérico. Não
//      remapeia código (isso é papel do reconcile-projuris-tipos.ts); aqui só
//      preenche/atualiza a DESCRIÇÃO (nome) para exibição. Idempotente.
//   3) EXECUTORES: para cada código presente em system_projuris_executor_mapping,
//      atualiza o full_name do system_users vinculado com o nome do ProJuris
//      (mantém o de-para código→nome fresco). NÃO cria usuários novos aqui (o
//      seed 20260805000001 já criou os sintéticos); só refresca nomes.
//
// O motor/telas leem o de-para do BANCO (não do ProJuris a cada rodada) — H6/I2.
//
// Rodar (de dentro de sistema-hv/):
//   npx tsx --env-file=.env.local scripts/sync-projuris-de-para.ts          (aplica)
//   npx tsx --env-file=.env.local scripts/sync-projuris-de-para.ts --dry    (só relatório)

import pg from "pg";
import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";

const DRY = process.argv.includes("--dry") || process.argv.includes("--dry-run");
const ORG = "00000000-0000-0000-0000-000000000001";

/** Desempacota GET /usuario → simpleDto[{chave,valor}]. */
function unwrapUsuarioSimpleDto(raw: unknown): Array<{ chave: unknown; valor: unknown }> {
  if (!raw || typeof raw !== "object") return [];
  const sd = (raw as Record<string, unknown>).simpleDto;
  if (Array.isArray(sd)) return sd as Array<{ chave: unknown; valor: unknown }>;
  // fallback: alguns envelopes vêm aninhados
  for (const v of Object.values(raw as Record<string, unknown>)) {
    if (Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] && "chave" in v[0]) {
      return v as Array<{ chave: unknown; valor: unknown }>;
    }
  }
  return [];
}

/** Desempacota GET /tipo?chave-tipo=tarefa-tipo → consultaTipoRetorno[0].simpleDto[]. */
function unwrapTipoSimpleDto(raw: unknown): Array<{ chave: unknown; valor: unknown }> {
  if (!raw || typeof raw !== "object") return [];
  const cont = (raw as Record<string, unknown>).consultaTipoRetorno;
  const bloco = Array.isArray(cont) ? cont[0] : cont;
  if (bloco && typeof bloco === "object") {
    const sd = (bloco as Record<string, unknown>).simpleDto;
    if (Array.isArray(sd)) return sd as Array<{ chave: unknown; valor: unknown }>;
  }
  return [];
}

async function openPg(): Promise<pg.Client> {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!ref || !password) {
    throw new Error("Faltam SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD no .env.local");
  }
  const client = new pg.Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
}

async function main() {
  console.log(
    `=== Sync DE-PARA ProJuris (nomes p/ exibição) ${DRY ? "(DRY-RUN)" : "(APLICANDO)"} ===\n`,
  );

  // 1) ProJuris (leitura)
  const pj = createProjurisClientFromEnv();
  const { username } = await pj.authenticateTryingVariants();
  console.log(`Auth OK (username="${username}").`);

  const rawUsuarios = await pj.projurisGet<unknown>("usuario");
  const usuarios = unwrapUsuarioSimpleDto(rawUsuarios);
  const usuarioByCode = new Map<string, string>();
  for (const u of usuarios) {
    const cod = u.chave != null ? String(u.chave) : "";
    const nome = typeof u.valor === "string" ? u.valor : String(u.valor ?? "");
    if (cod && nome) usuarioByCode.set(cod, nome);
  }
  console.log(`ProJuris: ${usuarioByCode.size} usuários lidos.`);

  const rawTipos = await pj.projurisGet<unknown>("tipo", { "chave-tipo": "tarefa-tipo" });
  const tipos = unwrapTipoSimpleDto(rawTipos);
  const tipoByCode = new Map<string, string>();
  for (const t of tipos) {
    const cod = t.chave != null ? String(t.chave) : "";
    const nome = typeof t.valor === "string" ? t.valor : String(t.valor ?? "");
    if (cod && nome) tipoByCode.set(cod, nome);
  }
  console.log(`ProJuris: ${tipoByCode.size} tipos de tarefa lidos.\n`);

  const db = await openPg();
  try {
    // 2) TIPOS: preenche/atualiza a descrição (nome) pelo código real numérico.
    const tt = await db.query<{
      projuris_tipo_codigo: string;
      projuris_tipo_descricao: string | null;
    }>(
      "select projuris_tipo_codigo, projuris_tipo_descricao from system_task_type_mapping where organization_id = $1",
      [ORG],
    );
    let tiposUpdated = 0;
    const tiposSemNome: string[] = [];
    for (const row of tt.rows) {
      const cod = (row.projuris_tipo_codigo ?? "").trim();
      if (!/^\d+$/.test(cod)) continue; // ainda placeholder de nome → pula (reconcile resolve o código)
      const nome = tipoByCode.get(cod);
      if (!nome) {
        tiposSemNome.push(cod);
        continue;
      }
      if ((row.projuris_tipo_descricao ?? "") !== nome) {
        tiposUpdated++;
        if (!DRY) {
          await db.query(
            "update system_task_type_mapping set projuris_tipo_descricao = $1, updated_at = now() where projuris_tipo_codigo = $2 and organization_id = $3",
            [nome, cod, ORG],
          );
        }
      }
    }
    console.log(
      `TIPOS: ${tiposUpdated} descrições ${DRY ? "seriam atualizadas" : "atualizadas"}; ${tiposSemNome.length} códigos sem nome no ProJuris.`,
    );
    if (tiposSemNome.length) console.log(`  sem nome: ${tiposSemNome.join(", ")}`);

    // 3) EXECUTORES: refresca full_name dos system_users vinculados por código.
    const ex = await db.query<{ projuris_responsavel_id: string; executor_id: string }>(
      "select projuris_responsavel_id, executor_id from system_projuris_executor_mapping where organization_id = $1",
      [ORG],
    );
    let execUpdated = 0;
    const execSemNome: string[] = [];
    for (const row of ex.rows) {
      const cod = (row.projuris_responsavel_id ?? "").trim();
      const nome = usuarioByCode.get(cod);
      if (!nome) {
        execSemNome.push(cod);
        continue;
      }
      // Só atualiza usuários SINTÉTICOS (@projuris.local) para não sobrescrever
      // o nome de um usuário de login real que o admin tenha associado (D-merge).
      const upd = await db.query(
        "update system_users set full_name = $1 where id = $2 and organization_id = $3 and email like 'projuris-%@projuris.local' and coalesce(full_name,'') <> $1",
        [nome, row.executor_id, ORG],
      );
      if (!DRY && (upd.rowCount ?? 0) > 0) execUpdated++;
      else if (DRY) execUpdated++; // estimativa em dry-run
    }
    console.log(
      `EXECUTORES: ${execUpdated} nomes ${DRY ? "seriam refrescados" : "refrescados"} (sintéticos); ${execSemNome.length} códigos sem nome no ProJuris.`,
    );
    if (execSemNome.length) console.log(`  sem nome: ${execSemNome.join(", ")}`);

    console.log(`\n=== ${DRY ? "DRY-RUN — nada escrito" : "OK — de-para atualizado"} ===`);
  } finally {
    await db.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
