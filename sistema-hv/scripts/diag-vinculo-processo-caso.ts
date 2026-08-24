// Diagnóstico: dá para casar as intimações do ProJuris com os casos do SHV?
//
// A tela 2 do motor só sabe o TEMA (e portanto o multiplicador/pontuação) se o
// processo da intimação casar com um caso. Este script mede por quais caminhos
// esse casamento é possível hoje.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { getSupabaseAdmin } from "@/lib/supabase/server";

const so = (s: string) => s.replace(/\D/g, "");

async function main() {
  const sb = getSupabaseAdmin();

  const { count: total } = await sb
    .from("system_cases")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  const { count: comNumero } = await sb
    .from("system_cases")
    .select("*", { count: "exact", head: true })
    .not("projuris_numero_processo", "is", null)
    .is("deleted_at", null);

  const { count: comCodigo } = await sb
    .from("system_cases")
    .select("*", { count: "exact", head: true })
    .not("projuris_codigo_processo", "is", null)
    .is("deleted_at", null);

  console.log(`casos ativos: ${total}`);
  console.log(`  · com projuris_numero_processo (CNJ): ${comNumero}`);
  console.log(`  · com projuris_codigo_processo:       ${comCodigo}`);

  // Cruza o que veio do ProJuris com o que o SHV tem.
  const { data: movs } = await sb
    .from("system_distribution_movements")
    .select("numero_cnj, projuris_processo_codigo, raw")
    .eq("origem", "INTIMACAO")
    .limit(500);

  const { data: casos } = await sb
    .from("system_cases")
    .select("id, projuris_numero_processo, projuris_codigo_processo, client_id, tema_id")
    .is("deleted_at", null);

  const porCnj = new Map<string, string>();
  const porCodigo = new Map<string, string>();
  for (const c of casos ?? []) {
    if (c.projuris_numero_processo) porCnj.set(so(c.projuris_numero_processo), c.id);
    if (c.projuris_codigo_processo != null) porCodigo.set(String(c.projuris_codigo_processo), c.id);
  }

  let porCnjOk = 0;
  let porCodigoOk = 0;
  let porNomeOk = 0;

  // Nome do cliente: no payload vem como array em `nomeCliente`.
  const { data: clientes } = await sb
    .from("system_clients")
    .select("id, full_name")
    .is("deleted_at", null);
  const porNome = new Map<string, string>();
  for (const c of clientes ?? []) {
    if (c.full_name) porNome.set(c.full_name.trim().toUpperCase(), c.id);
  }

  for (const m of movs ?? []) {
    if (m.numero_cnj && porCnj.has(so(m.numero_cnj))) porCnjOk++;
    if (m.projuris_processo_codigo && porCodigo.has(m.projuris_processo_codigo)) porCodigoOk++;
    const raw = m.raw as Record<string, unknown> | null;
    const nomes = Array.isArray(raw?.nomeCliente) ? (raw!.nomeCliente as unknown[]) : [];
    if (nomes.some((n) => typeof n === "string" && porNome.has(n.trim().toUpperCase())))
      porNomeOk++;
  }

  console.log(`\nintimações analisadas: ${movs?.length ?? 0}`);
  console.log(`  · casariam por CNJ do caso:        ${porCnjOk}`);
  console.log(`  · casariam por código do processo: ${porCodigoOk}`);
  console.log(`  · casariam por NOME do cliente:    ${porNomeOk}`);

  // Situação das intimações no ProJuris (o doc pede só as não arquivadas).
  const situacoes = new Map<string, number>();
  for (const m of movs ?? []) {
    const raw = m.raw as Record<string, unknown> | null;
    const s = String(raw?.tipoSituacao ?? "—");
    situacoes.set(s, (situacoes.get(s) ?? 0) + 1);
  }
  console.log(`\nsituação das intimações no ProJuris:`);
  for (const [s, n] of situacoes) console.log(`  · ${s}: ${n}`);
}

main().then(() => process.exit(0));
