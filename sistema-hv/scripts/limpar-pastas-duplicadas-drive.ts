// Remove as pastas DUPLICADAS que o bug do espelho deixou no Drive.
//
// Causa (corrigida em `mirrorFolderIntoTema` e `createAndLinkFolder`): o Drive
// aceita nomes repetidos no mesmo nível, e as duas funções chamavam
// `createFolder` sem olhar antes se a pasta já existia. Desvincular e revincular
// a mesma pasta criava um segundo espelho; o primeiro ficava órfão para sempre.
// Prova no banco: tema "1% fies", vínculo de "01- Abatimento ESF DGM " criado às
// 21/07 17:44, apagado no mesmo minuto e recriado às 17:45 → duas pastas.
//
// REGRAS DE SEGURANÇA (uma sobrevivente por nome, nunca apaga conteúdo):
//   1. Só mexe em grupos de irmãs com o MESMO nome normalizado.
//   2. Uma duplicata só é candidata se estiver VAZIA (0 subpastas e 0 arquivos).
//   3. Nunca remove pasta cujo id esteja em `system_service_type_folders` (mesmo
//      soft-deletada) nem em `system_temas` — essas são referenciadas pelo app.
//   4. Sempre sobra pelo menos uma pasta do grupo.
//   5. `deleteFile` manda para a LIXEIRA (reversível ~30 dias), não apaga.
//
// Dry-run por padrão. Para aplicar:
//   npx tsx scripts/limpar-pastas-duplicadas-drive.ts --commit
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { deleteFile, listFilesInFolder, listFoldersInFolder } from "../src/lib/google/drive";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const COMMIT = process.argv.includes("--commit");

const TEMAS_ROOT =
  process.env.GOOGLE_DRIVE_TEMAS_ROOT_FOLDER_ID?.trim() || "1PtxXwOMn0ibNRXyzAQN-79mHUJc8w4Ro";
const MODELOS_ROOT =
  process.env.GOOGLE_DRIVE_MODELS_ROOT_FOLDER_ID?.trim() || "1su0XT7i2B7ziHGN1PTz5ZRhSWNFEZOsJ";
const PROCURACAO_ROOT =
  process.env.GOOGLE_DRIVE_PROCURACAO_FOLDER_ID?.trim() || "1ed5kBsyHalUuMoap_0i_KJQ_fFfbiPYd";

/** Ids de pasta que o banco referencia — intocáveis. */
async function idsReferenciados(): Promise<Set<string>> {
  const sb = getSupabaseAdmin();
  const ids = new Set<string>();

  // Inclui os soft-deletados de propósito: um vínculo desfeito pode ser refeito,
  // e aí a pasta precisa continuar lá.
  const { data: vinc } = await sb.from("system_service_type_folders").select("drive_folder_id");
  for (const v of (vinc ?? []) as Array<{ drive_folder_id: string | null }>) {
    if (v.drive_folder_id) ids.add(v.drive_folder_id);
  }

  const { data: temas } = await sb
    .from("system_temas")
    .select("drive_folder_id, drive_casos_folder_id, drive_contratacao_folder_id");
  for (const t of (temas ?? []) as Array<Record<string, string | null>>) {
    for (const k of ["drive_folder_id", "drive_casos_folder_id", "drive_contratacao_folder_id"]) {
      if (t[k]) ids.add(t[k] as string);
    }
  }

  return ids;
}

async function estaVazia(id: string): Promise<boolean> {
  const [subpastas, conteudo] = await Promise.all([listFoldersInFolder(id), listFilesInFolder(id)]);
  // `listFilesInFolder` devolve as pastas junto (pasta é arquivo no Drive), então
  // conta só o que NÃO é pasta para não somar duas vezes.
  const arquivos = (conteudo as Array<{ mimeType?: string }>).filter(
    (f) => f.mimeType !== "application/vnd.google-apps.folder",
  );
  return subpastas.length === 0 && arquivos.length === 0;
}

type Acao = { pai: string; nome: string; id: string; motivo: string; remover: boolean };

async function varrer(
  paiId: string,
  paiNome: string,
  protegidos: Set<string>,
  acoes: Acao[],
  nivel = 0,
): Promise<void> {
  let pastas: Array<{ id: string; name: string }>;
  try {
    pastas = await listFoldersInFolder(paiId);
  } catch (err) {
    console.error(
      `  ⚠ não consegui listar "${paiNome}":`,
      err instanceof Error ? err.message : err,
    );
    return;
  }

  const grupos = new Map<string, Array<{ id: string; name: string }>>();
  for (const p of pastas) {
    const k = p.name.trim().toLowerCase();
    const g = grupos.get(k);
    if (g) g.push(p);
    else grupos.set(k, [p]);
  }

  for (const [nome, irmas] of grupos) {
    if (irmas.length < 2) continue;

    // Descobre quais podem sair. Ordem de preferência para MANTER: a que o banco
    // referencia; senão a que tem conteúdo; senão a primeira.
    const analisadas = await Promise.all(
      irmas.map(async (f) => ({
        ...f,
        referenciada: protegidos.has(f.id),
        vazia: await estaVazia(f.id),
      })),
    );

    const manter =
      analisadas.find((f) => f.referenciada) ?? analisadas.find((f) => !f.vazia) ?? analisadas[0];

    console.log(`\n  📁 ${paiNome} → "${nome}" aparece ${irmas.length}x`);
    for (const f of analisadas) {
      const ehMantida = f.id === manter.id;
      const podeSair = !ehMantida && f.vazia && !f.referenciada;
      const motivo = ehMantida
        ? f.referenciada
          ? "MANTER (referenciada no banco)"
          : f.vazia
            ? "MANTER (sobrevivente do grupo)"
            : "MANTER (tem conteúdo)"
        : f.referenciada
          ? "manter — referenciada no banco"
          : !f.vazia
            ? "manter — NÃO está vazia"
            : "remover — duplicata vazia e sem referência";
      console.log(`     ${podeSair ? "🗑" : "✓"} ${f.id}  ${motivo}`);
      acoes.push({ pai: paiNome, nome, id: f.id, motivo, remover: podeSair });
    }
  }

  if (nivel < 2) {
    for (const p of pastas)
      await varrer(p.id, `${paiNome}/${p.name.trim()}`, protegidos, acoes, nivel + 1);
  }
}

async function main() {
  console.log(COMMIT ? "\nMODO COMMIT — vai mover duplicatas para a lixeira.\n" : "\nDRY-RUN.\n");

  const protegidos = await idsReferenciados();
  console.log(`${protegidos.size} pasta(s) referenciada(s) no banco — intocáveis.`);

  const acoes: Acao[] = [];
  for (const [id, nome] of [
    [TEMAS_ROOT, "temas"],
    [MODELOS_ROOT, "modelos"],
    [PROCURACAO_ROOT, "procurações"],
  ] as const) {
    await varrer(id, nome, protegidos, acoes);
  }

  const remover = acoes.filter((a) => a.remover);
  console.log(`\n${remover.length} pasta(s) a remover.`);
  if (!remover.length) return;

  if (!COMMIT) {
    console.log("Rode com --commit para aplicar.");
    return;
  }

  let ok = 0;
  for (const a of remover) {
    try {
      await deleteFile(a.id);
      console.log(`  ✓ lixeira: ${a.pai} → "${a.nome}" (${a.id})`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${a.id}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`\n${ok}/${remover.length} movida(s) para a lixeira.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
