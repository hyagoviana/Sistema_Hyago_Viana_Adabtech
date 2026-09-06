// Diagnóstico da árvore de MODELOS no Drive — antes de reorganizar (S2-04).
//
// Thiago: "Não precisa se preocupar com os arquivos modelos que já existem no
// SHV, podem apagar tudo, todos que estão ai são de testes e temos as cópias."
// E o owner: "está salvando duplicado lá".
//
// SOMENTE LEITURA. Mostra o que existe hoje e aponta as duplicatas.
//
// Rodar: npx tsx scripts/diag-drive-temas.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { listFoldersInFolder, listFilesInFolder } from "../src/lib/google/drive";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const TEMAS_ROOT =
  process.env.GOOGLE_DRIVE_TEMAS_ROOT_FOLDER_ID?.trim() || "1PtxXwOMn0ibNRXyzAQN-79mHUJc8w4Ro";
const MODELOS_ROOT =
  process.env.GOOGLE_DRIVE_MODELS_ROOT_FOLDER_ID?.trim() || "1su0XT7i2B7ziHGN1PTz5ZRhSWNFEZOsJ";
const PROCURACAO_ROOT =
  process.env.GOOGLE_DRIVE_PROCURACAO_FOLDER_ID?.trim() || "1ed5kBsyHalUuMoap_0i_KJQ_fFfbiPYd";

async function arvore(id: string, nome: string, nivel = 0, max = 3): Promise<number> {
  const ident = "  ".repeat(nivel + 1);
  let total = 0;
  let pastas: Array<{ id: string; name: string }> = [];
  try {
    pastas = await listFoldersInFolder(id);
  } catch (err) {
    console.log(
      `${ident}⚠ não consegui listar "${nome}": ${err instanceof Error ? err.message : err}`,
    );
    return 0;
  }
  let arquivos: Array<{ id: string; name: string }> = [];
  try {
    // `listFilesInFolder` devolve TUDO — e pasta é arquivo no Drive. Sem filtrar
    // o mimeType, cada subpasta era contada duas vezes e aparecia como
    // "arquivo duplicado" que não existe.
    const todos = (await listFilesInFolder(id)) as Array<{
      id: string;
      name: string;
      mimeType?: string;
    }>;
    arquivos = todos.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");
  } catch {
    /* sem arquivos legíveis */
  }

  console.log(`${ident}📁 ${nome} — ${pastas.length} subpasta(s), ${arquivos.length} arquivo(s)`);
  total += arquivos.length;

  // Duplicatas de NOME entre as subpastas deste nível.
  const contagem = new Map<string, number>();
  for (const p of pastas) {
    const k = p.name.trim().toLowerCase();
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  for (const [nomeDup, n] of contagem) {
    if (n > 1) console.log(`${ident}  🔴 DUPLICADA ${n}x: "${nomeDup}"`);
  }

  // Duplicatas de arquivo neste nível.
  const arqCont = new Map<string, number>();
  for (const a of arquivos) {
    const k = a.name.trim().toLowerCase();
    arqCont.set(k, (arqCont.get(k) ?? 0) + 1);
  }
  for (const [nomeDup, n] of arqCont) {
    if (n > 1) console.log(`${ident}  🔴 ARQUIVO DUPLICADO ${n}x: "${nomeDup}"`);
  }

  if (nivel < max) {
    for (const p of pastas) total += await arvore(p.id, p.name, nivel + 1, max);
  }
  return total;
}

async function main() {
  console.log("\n=== RAIZ DE TEMAS ===");
  const nTemas = await arvore(TEMAS_ROOT, "(raiz de temas)");

  console.log("\n=== RAIZ DE MODELOS (legado) ===");
  const nModelos = await arvore(MODELOS_ROOT, "(raiz de modelos)");

  console.log("\n=== RAIZ DE PROCURAÇÕES (legado) ===");
  const nProc = await arvore(PROCURACAO_ROOT, "(raiz de procurações)");

  console.log(
    `\nArquivos: ${nTemas} em temas · ${nModelos} em modelos · ${nProc} em procurações\n`,
  );

  // O que o BANCO acha que está vinculado.
  const sb = getSupabaseAdmin();
  const { data: vinculos, error: errVinc } = await sb
    .from("system_service_type_folders")
    .select("service_type_id, kind, drive_folder_id, name")
    .is("deleted_at", null);
  if (errVinc) {
    // Consulta que falha em silêncio engana o diagnóstico — na primeira versão
    // deste script os nomes das colunas estavam errados e o resultado vazio
    // parecia "os vínculos sumiram".
    console.error("  ⚠ falha ao ler os vínculos:", errVinc.message);
  }

  console.log("=== VÍNCULOS NO BANCO ===");
  const porNome = new Map<string, number>();
  for (const v of (vinculos ?? []) as Array<{ kind: string; name: string | null }>) {
    const k = `${v.kind}|${(v.name ?? "?").trim().toLowerCase()}`;
    porNome.set(k, (porNome.get(k) ?? 0) + 1);
  }
  console.log(`  ${(vinculos ?? []).length} vínculo(s)`);
  for (const [k, n] of porNome) {
    if (n > 1) console.log(`  🔴 vínculo repetido ${n}x: ${k}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
