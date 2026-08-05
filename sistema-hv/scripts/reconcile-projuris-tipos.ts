// Reconciliação IDEMPOTENTE dos tipos de tarefa: aplica os CÓDIGOS reais do
// ProJuris em system_task_type_mapping (story A9, T1 / de-para).
//
// O QUE FAZ:
//   1) Autentica no ProJuris (só leitura) e puxa os 52 tipos de tarefa
//      (GET /tipo?chave-tipo=tarefa-tipo → consultaTipoRetorno[0].simpleDto[{chave,valor}]).
//   2) Casa cada linha do system_task_type_mapping por NOME normalizado
//      (sem acento/caixa). O "nome lógico" de cada linha é resolvido de forma
//      ESTÁVEL para permitir re-execução:
//        - se projuris_tipo_descricao já está preenchido (nome ProJuris de uma
//          rodada anterior), usa ele;
//        - senão usa projuris_tipo_codigo SE ainda for um placeholder de nome
//          (não-numérico);
//        - senão (já é código numérico e sem descrição) deriva do motor_task_type_id.
//   3) Para os que casam, faz UPDATE ... WHERE motor_task_type_id = <id>
//      (a CHAVE ESTÁVEL — nunca sobrescrita) setando:
//        projuris_tipo_codigo   = <chave real do ProJuris>  (string numérica)
//        projuris_tipo_descricao= <valor/nome do ProJuris>
//      Idempotente: rodar 2× não duplica nem desfaz (só reescreve os mesmos valores).
//   4) Os near-miss (Fallback, Diligências/Balcão, Emenda, Manifestação, Réplica)
//      FICAM como estão (aguardam decisão do owner) — apenas reportados.
//
// SÓ LEITURA no ProJuris. A ÚNICA escrita é o UPDATE dos códigos (config, prod).
//
// Rodar (de dentro de sistema-hv/):
//   npx tsx --env-file=.env.local scripts/reconcile-projuris-tipos.ts          (aplica)
//   npx tsx --env-file=.env.local scripts/reconcile-projuris-tipos.ts --dry    (só relatório)

import pg from "pg";
import { createProjurisClientFromEnv } from "../src/lib/projuris/client.js";

const DRY = process.argv.includes("--dry") || process.argv.includes("--dry-run");
const ORG = "00000000-0000-0000-0000-000000000001";

// ----------------------------------------------------------------------------
function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
}

/** Desempacota GET /tipo?chave-tipo=tarefa-tipo → simpleDto[{chave,valor}]. */
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

/** Nome lógico ESTÁVEL de uma linha do mapping (p/ casar por nome, re-executável). */
function logicalName(row: {
  projuris_tipo_codigo: string | null;
  projuris_tipo_descricao: string | null;
  motor_task_type_id: string | null;
}): string {
  const desc = (row.projuris_tipo_descricao ?? "").trim();
  if (desc) return desc; // rodada anterior já gravou o nome ProJuris
  const cod = (row.projuris_tipo_codigo ?? "").trim();
  if (cod && !/^\d+$/.test(cod)) return cod; // placeholder de NOME (ainda não é código)
  // fallback: deriva do motor_task_type_id (SNAKE → espaços)
  return (row.motor_task_type_id ?? "").replace(/_/g, " ");
}

interface Row {
  projuris_tipo_codigo: string | null;
  projuris_tipo_descricao: string | null;
  motor_task_type_id: string | null;
  points: string | null;
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

// ----------------------------------------------------------------------------
async function main() {
  console.log(
    `=== Reconciliação de TIPOS ProJuris → system_task_type_mapping ${DRY ? "(DRY-RUN)" : "(APLICANDO)"} ===\n`,
  );

  // 1) ProJuris (leitura). Autentica tentando as variantes de username (a
  // vencedora é o e-mail cru); isso cacheia o token no client antes do GET.
  const pj = createProjurisClientFromEnv();
  const { username } = await pj.authenticateTryingVariants();
  console.log(`Auth OK (username="${username}").`);
  const rawTipo = await pj.projurisGet<unknown>("tipo", { "chave-tipo": "tarefa-tipo" });
  const tipos = unwrapTipoSimpleDto(rawTipo);
  console.log(`ProJuris: ${tipos.length} tipos de tarefa lidos.`);

  // Mapa NOME normalizado → { codigo, nome }. Se houver colisão de nome (ex. 2
  // variantes iguais), a 1ª ganha e as demais são marcadas como ambíguas.
  const byName = new Map<string, { codigo: string; nome: string }>();
  const ambiguousNames = new Set<string>();
  for (const t of tipos) {
    const codigo = t.chave != null ? String(t.chave) : "";
    const nome = typeof t.valor === "string" ? t.valor : String(t.valor ?? "");
    if (!codigo || !nome) continue;
    const key = normalizeName(nome);
    if (byName.has(key)) ambiguousNames.add(key);
    else byName.set(key, { codigo, nome });
  }

  // 2) SHV mapping
  const db = await openPg();
  let matched = 0;
  const nearMiss: string[] = [];
  const applied: Array<{ motor: string; from: string; codigo: string; nome: string }> = [];
  try {
    const res = await db.query<Row>(
      "select projuris_tipo_codigo, projuris_tipo_descricao, motor_task_type_id, points from system_task_type_mapping where organization_id = $1 order by motor_task_type_id",
      [ORG],
    );
    console.log(`SHV: ${res.rows.length} linhas em system_task_type_mapping (org default).\n`);

    // Guarda os códigos já aplicados nesta rodada. O UNIQUE
    // (projuris_tipo_codigo, organization_id) NÃO deixa 2 linhas SHV apontarem
    // p/ o MESMO código ProJuris — quando 2 linhas casam no mesmo código (ex.
    // AUDIENCIA + audiencia_trabalhista → 6476501), a 1ª leva o código e a 2ª
    // é reportada como COLISÃO (aguarda owner: fundir/remover a linha extra).
    const usedCodes = new Set<string>();
    const collisions: string[] = [];

    for (const row of res.rows) {
      const name = logicalName(row);
      const key = normalizeName(name);
      const hit = byName.get(key);
      const motor = row.motor_task_type_id ?? "(sem motor_id)";
      if (hit && !ambiguousNames.has(key)) {
        if (usedCodes.has(hit.codigo)) {
          collisions.push(
            `${motor} (nome lógico="${name}") → código ${hit.codigo} JÁ usado por outra linha SHV (UNIQUE) — não aplicado`,
          );
          continue;
        }
        usedCodes.add(hit.codigo);
        matched++;
        applied.push({ motor, from: name, codigo: hit.codigo, nome: hit.nome });
        if (!DRY) {
          await db.query(
            "update system_task_type_mapping set projuris_tipo_codigo = $1, projuris_tipo_descricao = $2, updated_at = now() where motor_task_type_id = $3 and organization_id = $4",
            [hit.codigo, hit.nome, row.motor_task_type_id, ORG],
          );
        }
      } else {
        const why = ambiguousNames.has(key)
          ? "AMBÍGUO (múltiplas variantes ProJuris com esse nome)"
          : "sem correspondência por nome";
        nearMiss.push(`${motor} (nome lógico="${name}") → ${why}`);
      }
    }

    console.log(`--- MATCHES (${matched}) ${DRY ? "que SERIAM aplicados" : "aplicados"} ---`);
    for (const a of applied) {
      console.log(
        `  ✔ ${a.motor.padEnd(34)} → projuris_tipo_codigo=${a.codigo.padEnd(8)} | "${a.nome}"`,
      );
    }

    console.log(`\n--- NÃO CASADOS (${nearMiss.length}) — FICAM como estão (aguardam owner) ---`);
    for (const n of nearMiss) console.log(`  ✘ ${n}`);

    if (collisions.length) {
      console.log(
        `\n--- COLISÕES DE CÓDIGO (${collisions.length}) — 2 linhas SHV p/ o mesmo código ProJuris (aguardam owner) ---`,
      );
      for (const c of collisions) console.log(`  ⚠ ${c}`);
    }

    // 3) Verificação pós-escrita: quantos ficaram com código NUMÉRICO real.
    const check = await db.query<{ n: string }>(
      "select count(*)::text as n from system_task_type_mapping where organization_id = $1 and projuris_tipo_codigo ~ '^[0-9]+$'",
      [ORG],
    );
    const total = await db.query<{ n: string }>(
      "select count(*)::text as n from system_task_type_mapping where organization_id = $1",
      [ORG],
    );
    const numericos = Number(check.rows[0].n);
    const totalN = Number(total.rows[0].n);
    console.log(
      `\n=== CONFIRMAÇÃO NO BANCO (${DRY ? "estado ANTES — dry-run não escreveu" : "estado APÓS o update"}) ===`,
    );
    console.log(`  projuris_tipo_codigo NUMÉRICO (código real): ${numericos}/${totalN}`);
    console.log(`  ainda PLACEHOLDER (nome/sentinela):          ${totalN - numericos}/${totalN}`);
  } finally {
    await db.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
