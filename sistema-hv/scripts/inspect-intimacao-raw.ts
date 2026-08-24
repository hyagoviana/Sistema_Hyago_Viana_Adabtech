// Diagnóstico: mostra as CHAVES reais que o ProJuris devolve numa intimação.
// Usa o `raw` que já foi salvo em system_distribution_movements — sem nova
// chamada à API. Serve para escolher os campos certos de descrição/cliente.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";

async function main() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_distribution_movements")
    .select("numero_cnj, raw")
    .eq("origem", "INTIMACAO")
    .not("raw", "is", null)
    .limit(3);

  for (const m of data ?? []) {
    console.log(`\n===== ${m.numero_cnj} =====`);
    const raw = m.raw as Record<string, unknown>;
    for (const [k, v] of Object.entries(raw)) {
      const txt = typeof v === "object" && v !== null ? JSON.stringify(v).slice(0, 120) : String(v);
      console.log(`  ${k.padEnd(32)} = ${txt.slice(0, 120)}`);
    }
  }

  // Quantos casos têm espelho judicial (é o que permite casar processo → caso).
  const { count: comJudicial } = await sb
    .from("system_case_judicial_processos")
    .select("*", { count: "exact", head: true });
  const { count: totalCasos } = await sb
    .from("system_cases")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);
  console.log(`\ncasos com espelho judicial: ${comJudicial} de ${totalCasos} casos`);

  const { count: comCodigo } = await sb
    .from("system_cases")
    .select("*", { count: "exact", head: true })
    .not("projuris_codigo_processo", "is", null)
    .is("deleted_at", null);
  console.log(`casos com projuris_codigo_processo preenchido: ${comCodigo}`);
}

main().then(() => process.exit(0));
