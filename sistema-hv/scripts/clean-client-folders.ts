// Limpa as pastas ÓRFÃS na pasta de clientes do Drive (GOOGLE_DRIVE_CLIENTS_FOLDER_ID)
// — subpastas que NÃO correspondem a nenhum cliente ativo (drive_folder_id). Move
// para a lixeira do Drive. Útil após zerar clientes (ficam pastas órfãs).
//
// Uso:
//   npx tsx scripts/clean-client-folders.ts        → DRY-RUN (só lista)
//   npx tsx scripts/clean-client-folders.ts --yes  → move as órfãs para a lixeira
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

async function main() {
  const apply = process.argv.includes("--yes");
  const parent = process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID;
  if (!parent) {
    console.error("Falta GOOGLE_DRIVE_CLIENTS_FOLDER_ID no .env.local");
    process.exit(1);
  }

  const { listFoldersInFolder, deleteFile } = await import("../src/lib/google/drive");
  const { getSupabaseAdmin } = await import("../src/lib/supabase/server");
  const sb = getSupabaseAdmin();

  const folders = await listFoldersInFolder(parent);
  const { data: clients } = await sb
    .from("system_clients")
    .select("drive_folder_id")
    .is("deleted_at", null)
    .not("drive_folder_id", "is", null);
  const keep = new Set((clients ?? []).map((c) => c.drive_folder_id as string));

  const orphans = folders.filter((f) => !keep.has(f.id));
  console.log(`Pastas na raiz de clientes: ${folders.length}`);
  console.log(`Clientes ativos com pasta: ${keep.size}`);
  console.log(`Pastas ÓRFÃS (a remover): ${orphans.length}`);
  for (const o of orphans) console.log(`  · ${o.name} (${o.id})`);

  if (!apply) {
    console.log("\n[DRY-RUN] Nada removido. Rode com --yes para mover à lixeira.");
    return;
  }

  let ok = 0;
  for (const o of orphans) {
    try {
      await deleteFile(o.id);
      ok++;
    } catch (e) {
      console.error(`  falhou ${o.name}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`\nOK: ${ok}/${orphans.length} pastas movidas para a lixeira.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
