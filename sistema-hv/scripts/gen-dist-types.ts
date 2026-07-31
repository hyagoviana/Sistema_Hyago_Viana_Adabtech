// Gera os blocos de tipo (Row/Insert/Update) do Supabase para as tabelas do motor
// de DISTRIBUIÇÃO que faltam em types.ts — introspecção via pg direto (a CLI do
// Supabase exige Docker, indisponível aqui). Saída: TS pronto p/ colar no
// Database["public"]["Tables"]. Uso: npx tsx scripts/gen-dist-types.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local", quiet: true } as never);

import pg from "pg";

const TABLES = [
  "system_distribution_simulations",
  "system_distribution_results",
  "system_distribution_calendar",
  "system_projuris_executor_mapping",
  "system_task_type_mapping",
  "system_theme_mapping",
  "system_distribution_config",
  "system_distribution_batch_logs",
  "system_distribution_exceptions",
  "system_distribution_manual_assignments",
  "system_distribution_queue_state",
  "system_distribution_writeback_log",
];

function baseTs(dt: string, udt: string): string {
  const d = (dt || "").toLowerCase();
  const u = (udt || "").toLowerCase();
  const strs = [
    "uuid",
    "text",
    "character varying",
    "varchar",
    "character",
    "char",
    "name",
    "citext",
    "bpchar",
    "inet",
    "cidr",
  ];
  const nums = [
    "integer",
    "int",
    "int4",
    "int2",
    "int8",
    "bigint",
    "smallint",
    "numeric",
    "decimal",
    "real",
    "double precision",
    "float",
    "float4",
    "float8",
    "money",
  ];
  if (strs.includes(d)) return "string";
  if (nums.includes(d)) return "number";
  if (d === "boolean" || d === "bool") return "boolean";
  if (d === "json" || d === "jsonb") return "Json";
  if (d.startsWith("timestamp") || d === "date" || d.startsWith("time")) return "string";
  if (d === "user-defined") return "string"; // enum → string (fallback seguro)
  // fallback por udt_name
  if (u === "uuid" || u === "text" || u === "varchar" || u === "bpchar") return "string";
  if (["int2", "int4", "int8", "numeric", "float4", "float8"].includes(u)) return "number";
  if (u === "bool") return "boolean";
  if (u === "jsonb" || u === "json") return "Json";
  if (u === "date" || u.startsWith("timestamp") || u.startsWith("time")) return "string";
  return "string";
}
function tsType(dataType: string, udtName: string): string {
  if ((dataType || "").toLowerCase() === "array") {
    const el = (udtName || "").replace(/^_/, "");
    return baseTs(el, el) + "[]";
  }
  return baseTs(dataType, udtName);
}

async function main() {
  const client = new pg.Client({
    host: `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const out: string[] = [];
  for (const table of TABLES) {
    const { rows } = await client.query(
      `select column_name, data_type, udt_name, is_nullable, column_default
       from information_schema.columns
       where table_schema='public' and table_name=$1
       order by ordinal_position`,
      [table],
    );
    if (rows.length === 0) {
      console.error(`  (aviso) tabela sem colunas / inexistente: ${table}`);
      continue;
    }
    const rowLines: string[] = [];
    const insLines: string[] = [];
    for (const c of rows) {
      const ts = tsType(c.data_type, c.udt_name);
      const nullable = c.is_nullable === "YES";
      const hasDefault = c.column_default !== null;
      const rowT = nullable ? `${ts} | null` : ts;
      rowLines.push(`          ${c.column_name}: ${rowT};`);
      const optional = nullable || hasDefault;
      insLines.push(`          ${c.column_name}${optional ? "?" : ""}: ${rowT};`);
    }
    out.push(
      `      ${table}: {\n` +
        `        Row: {\n${rowLines.join("\n")}\n        };\n` +
        `        Insert: {\n${insLines.join("\n")}\n        };\n` +
        `        Update: Partial<Database["public"]["Tables"]["${table}"]["Insert"]>;\n` +
        `        Relationships: [];\n` +
        `      };`,
    );
  }
  await client.end();
  console.log(out.join("\n"));
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
