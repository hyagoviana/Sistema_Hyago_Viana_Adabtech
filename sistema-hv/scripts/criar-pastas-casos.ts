// #4 (reunião 2026-08-10) — cria a PASTA do CASO no Drive para casos importados
// que não têm pasta vinculada (a pasta do CLIENTE já existe). Nome humanizado
// "{Tema} — {Cliente}" (#5). DRY-RUN por padrão; só cria com `--apply`.
import { config } from "dotenv";
config({ path: ".env.local" });
import { getSupabaseAdmin } from "../src/lib/supabase/server.js";
import { createFolder } from "../src/lib/google/drive.js";

const APPLY = process.argv.includes("--apply");
const LIMIT = Number(process.env.LIMIT ?? "0") || 0; // 0 = todos

async function main() {
  console.log(APPLY ? "== MODO APPLY (cria pastas) ==" : "== DRY-RUN (não cria) ==");
  const sb = getSupabaseAdmin();

  // Casos SEM pasta, cujo CLIENTE tem pasta. Traz nome do cliente + tema.
  const { data: casos, error } = await sb
    .from("system_cases")
    .select(
      "id, case_code, drive_folder_id, tema_id, service_type_id, client_id, system_clients!inner(full_name, drive_folder_id)",
    )
    .is("deleted_at", null)
    .is("drive_folder_id", null);
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    case_code: string;
    tema_id: string | null;
    service_type_id: string | null;
    system_clients: { full_name: string | null; drive_folder_id: string | null } | null;
  };
  const rows = (casos ?? []) as unknown as Row[];
  const comPastaCliente = rows.filter((r) => r.system_clients?.drive_folder_id);
  const semPastaCliente = rows.filter((r) => !r.system_clients?.drive_folder_id);

  // Resolve nome do tema (service_type) de uma vez.
  const temaIds = [...new Set(comPastaCliente.map((r) => r.tema_id).filter(Boolean))] as string[];
  const stIds = [...new Set(comPastaCliente.map((r) => r.service_type_id).filter(Boolean))] as string[];
  const nomeByTema = new Map<string, string>();
  const nomeBySt = new Map<string, string>();
  if (temaIds.length) {
    const { data } = await sb
      .from("system_service_types")
      .select("tema_id, name")
      .in("tema_id", temaIds)
      .is("deleted_at", null);
    for (const r of data ?? []) if (r.tema_id) nomeByTema.set(r.tema_id, r.name);
  }
  if (stIds.length) {
    const { data } = await sb.from("system_service_types").select("id, name").in("id", stIds);
    for (const r of data ?? []) nomeBySt.set(r.id, r.name);
  }
  const temaNome = (r: Row) =>
    (r.tema_id && nomeByTema.get(r.tema_id)) ||
    (r.service_type_id && nomeBySt.get(r.service_type_id)) ||
    null;

  console.log(`Casos sem pasta: ${rows.length}`);
  console.log(`  · com pasta do cliente (dá p/ criar): ${comPastaCliente.length}`);
  console.log(`  · SEM pasta do cliente (pular):        ${semPastaCliente.length}`);
  console.log(`\n-- amostras (até 10) --`);
  for (const r of comPastaCliente.slice(0, 10)) {
    const nome = [temaNome(r), r.system_clients?.full_name].filter(Boolean).join(" — ") || `Caso ${r.case_code}`;
    console.log(`  ${r.case_code} → "${nome}"`);
  }

  if (!APPLY) {
    console.log(`\n(DRY-RUN) nada criado. Rode com --apply para criar as pastas.`);
    return;
  }

  const alvo = LIMIT ? comPastaCliente.slice(0, LIMIT) : comPastaCliente;
  console.log(`\n>> Criando ${alvo.length} pastas...`);
  let ok = 0,
    fail = 0;
  for (const r of alvo) {
    const parent = r.system_clients!.drive_folder_id!;
    const nome =
      [temaNome(r), r.system_clients?.full_name].filter(Boolean).join(" — ") || `Caso ${r.case_code}`;
    try {
      const folder = await createFolder(nome, parent);
      await sb
        .from("system_cases")
        .update({
          drive_folder_id: folder.id,
          drive_folder_url: folder.url,
          drive_sync_failed: false,
          drive_sync_error: null,
        })
        .eq("id", r.id);
      ok++;
      if (ok % 25 === 0) console.log(`  ...${ok} criadas`);
    } catch (e) {
      fail++;
      console.log(`  FALHA ${r.case_code}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\nFEITO. Criadas: ${ok} · Falhas: ${fail}`);
}
main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
