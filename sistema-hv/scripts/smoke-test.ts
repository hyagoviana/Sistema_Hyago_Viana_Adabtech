// Smoke test end-to-end do Sistema HV.
// Valida: env vars + conexão Supabase + Drive (create folder, upload, download, delete).
//
// Uso:
//   npm run smoke
//
// Falha rápido se qualquer variável crítica estiver ausente.

import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { assertEnvOrExit } from "../src/lib/validate-env";
import { getSupabaseAdmin } from "../src/lib/supabase/server";
import {
  createFolder,
  deleteFile,
  downloadFile,
  DriveError,
  getRootFolderId,
  uploadFile,
} from "../src/lib/google/drive";

async function main() {
  console.log("🧪 Smoke test — Sistema HV MVP-Drive\n");

  // ─── 0. Validar env vars antes de qualquer chamada externa ───────────────
  console.log("0) Validando variáveis de ambiente...");
  assertEnvOrExit();
  console.log("   ✓ env vars OK\n");

  // ─── 1. Supabase: ler system_organizations ───────────────────────────────
  console.log("1) Supabase: lendo system_organizations...");
  const sb = getSupabaseAdmin();
  const { data: orgs, error } = await sb.from("system_organizations").select("id, name");
  if (error) {
    throw new Error(
      `Supabase: ${error.message} — a migration 0001_init.sql foi aplicada? (npm run db:push)`,
    );
  }
  console.log(`   ✓ ${orgs?.length ?? 0} organização(ões) encontrada(s)`);
  if (orgs && orgs.length > 0) {
    console.log(`     → ${orgs.map((o) => o.name).join(", ")}`);
  }
  console.log();

  // ─── 2. Drive: criar pasta de teste ──────────────────────────────────────
  console.log("2) Drive: criando pasta de teste na raiz...");
  const folder = await createFolder(`SMOKE_TEST_${Date.now()}`, getRootFolderId());
  console.log(`   ✓ Pasta criada: ${folder.name}`);
  console.log(`     id: ${folder.id}`);
  console.log(`     url: ${folder.url}\n`);

  // ─── 3. Drive: upload de arquivo ─────────────────────────────────────────
  console.log("3) Drive: upload de arquivo de teste...");
  const payload = `Hello from Sistema HV — ${new Date().toISOString()}`;
  const file = await uploadFile({
    parentId: folder.id,
    name: "hello.txt",
    mimeType: "text/plain",
    body: Buffer.from(payload, "utf-8"),
  });
  console.log(`   ✓ Arquivo subido: ${file.name} (${file.size} bytes)`);
  console.log(`     url: ${file.url}\n`);

  // ─── 4. Drive: download e comparação ─────────────────────────────────────
  console.log("4) Drive: download e validação do conteúdo...");
  const stream = await downloadFile(file.id);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const downloaded = Buffer.concat(chunks).toString("utf-8");
  if (downloaded !== payload) {
    throw new Error(`Conteúdo divergente!\n  esperado: ${payload}\n  recebido: ${downloaded}`);
  }
  console.log(`   ✓ Conteúdo confere (${downloaded.length} bytes)\n`);

  // ─── 5. Cleanup ──────────────────────────────────────────────────────────
  console.log("5) Cleanup...");
  await deleteFile(file.id);
  await deleteFile(folder.id);
  console.log("   ✓ Pasta e arquivo de teste removidos\n");

  console.log("━".repeat(60));
  console.log("🎉 Todos os smoke tests passaram (5/5).");
}

main().catch((err: unknown) => {
  console.error("\n❌ Smoke test falhou:");
  if (err instanceof DriveError) {
    console.error(JSON.stringify(err.toJSON(), null, 2));
  } else if (err instanceof Error) {
    console.error(`   ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
  } else {
    console.error(err);
  }
  process.exit(1);
});
