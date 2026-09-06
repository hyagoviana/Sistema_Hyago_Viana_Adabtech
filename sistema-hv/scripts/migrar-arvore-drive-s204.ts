// S2-04 — unifica as DUAS árvores de modelo do Drive numa só.
//
// O problema, medido em 06/09: o Drive mostra uma árvore e o sistema usa outra.
// Todos os 11 vínculos de tipo apontam para `07- Modelos/<TIPO>`; as pastas com
// o mesmo nome dentro do tema são cascas vazias criadas pelo espelho decorativo
// (`mirrorFolderIntoTema`). É exatamente a queixa do Thiago na reunião:
// "queria unificar essas duas (...) tá puxando daqui, não tá puxando de lá".
//
// A jogada que evita risco: MOVER a pasta do tipo para dentro do tema. Mover no
// Drive troca o `parents` e PRESERVA o id — então os vínculos em
// `system_service_type_folders`, que apontam por id, continuam válidos sem
// re-apontamento. Nenhum arquivo é copiado; nenhum link já gerado quebra.
//
// Árvore final (desenho do Thiago, aprovada pelo owner em 06/09):
//
//   PASTA DO TEMA
//   └── TIPO
//       └── MODELOS
//           ├── JUDICIAL
//           ├── CONTRATO E PROCURAÇÃO
//           └── ADMINISTRATIVO
//
// FASES (rodar em ordem; cada uma é idempotente e tem dry-run):
//   --mover     move as pastas de TIPO para dentro do tema, remove a casca vazia
//               que sobrou e cria MODELOS/{3 categorias}
//   --arquivar  tira os modelos legados de circulação: MOVE os arquivos para a
//               pasta de arquivo morto e grava o inventário em
//               `system_drive_archive_log` (o owner pediu para guardar)
//
// Dry-run é o padrão em ambas. Para aplicar, some `--commit`.
//
//   npx tsx scripts/migrar-arvore-drive-s204.ts --mover
//   npx tsx scripts/migrar-arvore-drive-s204.ts --mover --commit
//   npx tsx scripts/migrar-arvore-drive-s204.ts --arquivar
//   npx tsx scripts/migrar-arvore-drive-s204.ts --arquivar --commit
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import {
  createFolder,
  deleteFile,
  getFileMeta,
  listFilesInFolder,
  listFoldersInFolder,
  moveFile,
} from "../src/lib/google/drive";
import { ensureTipoModelStructure, listTypeFolders } from "../src/lib/service-type-folders-service";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const COMMIT = process.argv.includes("--commit");
const FASE_MOVER = process.argv.includes("--mover");
const FASE_ARQUIVAR = process.argv.includes("--arquivar");

const MODELOS_ROOT =
  process.env.GOOGLE_DRIVE_MODELS_ROOT_FOLDER_ID?.trim() || "1su0XT7i2B7ziHGN1PTz5ZRhSWNFEZOsJ";
const PROCURACAO_ROOT =
  process.env.GOOGLE_DRIVE_PROCURACAO_FOLDER_ID?.trim() || "1ed5kBsyHalUuMoap_0i_KJQ_fFfbiPYd";
const RAIZ_DRIVE = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() || "";

const LOTE = "s204-modelos-legados-2026-09-06";
const PASTA_ARQUIVO = "_ARQUIVO - modelos legados (2026-09-06)";
const FOLDER_MIME = "application/vnd.google-apps.folder";

const caminhos = new Map<string, string>();
async function caminho(id: string): Promise<string> {
  const memo = caminhos.get(id);
  if (memo) return memo;
  const partes: string[] = [];
  let cur: string | undefined = id;
  for (let i = 0; i < 6 && cur; i++) {
    const m = (await getFileMeta(cur)) as { name?: string; parents?: string[] };
    partes.unshift(m.name ?? cur);
    cur = m.parents?.[0];
  }
  const r = partes.join(" / ");
  caminhos.set(id, r);
  return r;
}

/** Só os itens que NÃO são pasta (pasta é arquivo no Drive). */
async function arquivosDe(id: string) {
  const todos = (await listFilesInFolder(id, 200)) as Array<{
    id?: string | null;
    name?: string | null;
    mimeType?: string | null;
  }>;
  return todos.filter((f) => f.mimeType !== FOLDER_MIME && f.id && f.name);
}

// ---------------------------------------------------------------------------
// FASE 1 — mover os TIPOS para dentro do tema
// ---------------------------------------------------------------------------
async function fase1() {
  console.log(COMMIT ? "\nFASE MOVER — MODO COMMIT.\n" : "\nFASE MOVER — DRY-RUN.\n");
  const sb = getSupabaseAdmin();

  const { data: temas, error } = await sb
    .from("system_temas")
    .select("id, name, drive_folder_id, drive_casos_folder_id, system_service_types!inner(id)")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(error.message);

  const linhas = (temas ?? []) as unknown as Array<{
    id: string;
    name: string;
    drive_folder_id: string | null;
    drive_casos_folder_id: string | null;
    system_service_types: Array<{ id: string }>;
  }>;

  // Uma pasta do Drive pode estar vinculada a mais de um tema (é N:N). Mover
  // resolveria para UM pai só — então detecta e recusa em vez de escolher sozinho.
  const donoDaPasta = new Map<string, string[]>();
  for (const tema of linhas) {
    if (!tema.drive_folder_id) continue;
    for (const st of tema.system_service_types) {
      for (const t of await listTypeFolders(st.id, "caso")) {
        const l = donoDaPasta.get(t.drive_folder_id) ?? [];
        if (!l.includes(tema.name)) l.push(tema.name);
        donoDaPasta.set(t.drive_folder_id, l);
      }
    }
  }

  let movidas = 0;
  let cascasRemovidas = 0;
  let estruturas = 0;

  for (const tema of linhas) {
    if (!tema.drive_folder_id) {
      console.log(`\n📁 ${tema.name} — sem pasta no Drive, pulando.`);
      continue;
    }
    console.log(`\n📁 ${tema.name}`);

    for (const st of tema.system_service_types) {
      for (const tipo of await listTypeFolders(st.id, "caso")) {
        const donos = donoDaPasta.get(tipo.drive_folder_id) ?? [];
        if (donos.length > 1) {
          console.log(
            `   ⚠ ${tipo.name} — a MESMA pasta está vinculada a ${donos.length} temas (${donos.join(", ")}). Não movo: uma pasta só tem um lugar. Resolva o vínculo duplicado antes.`,
          );
          continue;
        }

        const meta = (await getFileMeta(tipo.drive_folder_id)) as { parents?: string[] };
        const paiAtual = meta.parents?.[0];

        if (paiAtual === tema.drive_folder_id) {
          console.log(`   ✓ ${tipo.name} — já está dentro do tema`);
        } else {
          console.log(
            `   → ${tipo.name}\n       de:    ${await caminho(tipo.drive_folder_id)}\n       para:  ${tema.name}/`,
          );
          if (COMMIT) {
            await moveFile(tipo.drive_folder_id, tema.drive_folder_id, paiAtual);
            caminhos.delete(tipo.drive_folder_id);
            movidas++;
          }
        }

        // A casca vazia que o espelho decorativo deixou em `Casos` — mesmo nome,
        // id diferente, zero conteúdo. Depois do move ela é ruído puro.
        if (tema.drive_casos_folder_id) {
          for (const casca of await listFoldersInFolder(tema.drive_casos_folder_id)) {
            if (casca.id === tipo.drive_folder_id) continue;
            if (casca.name.trim().toLowerCase() !== tipo.name.trim().toLowerCase()) continue;
            const [subs, arqs] = await Promise.all([
              listFoldersInFolder(casca.id),
              arquivosDe(casca.id),
            ]);
            if (subs.length || arqs.length) {
              console.log(`       ⚠ casca "${casca.name}" NÃO está vazia — deixando como está`);
              continue;
            }
            console.log(`       🗑 casca vazia em Casos/ → lixeira (${casca.id})`);
            if (COMMIT) {
              await deleteFile(casca.id);
              cascasRemovidas++;
            }
          }
        }

        if (COMMIT) {
          const at = await ensureTipoModelStructure(tipo.id);
          if (at.drive_modelos_folder_id) estruturas++;
          console.log(`       ✓ MODELOS/{JUDICIAL, CONTRATO E PROCURAÇÃO, ADMINISTRATIVO}`);
        } else {
          console.log(`       → criaria MODELOS/{3 categorias}`);
        }
      }
    }
  }

  if (COMMIT) {
    console.log(
      `\n${movidas} pasta(s) movida(s), ${cascasRemovidas} casca(s) removida(s), ${estruturas} estrutura(s) MODELOS.`,
    );
  } else {
    console.log("\nRode com --commit para aplicar.");
  }
}

// ---------------------------------------------------------------------------
// FASE 2 — arquivar os modelos legados
// ---------------------------------------------------------------------------
async function fase2() {
  console.log(COMMIT ? "\nFASE ARQUIVAR — MODO COMMIT.\n" : "\nFASE ARQUIVAR — DRY-RUN.\n");
  const sb = getSupabaseAdmin();

  // Tudo que ainda está nas duas raízes legadas, em qualquer nível.
  type Alvo = { id: string; name: string; mimeType: string; parentId: string };
  const alvos: Alvo[] = [];

  // Dedup por id do Drive. Precisa existir: a raiz de procurações
  // ("08- Contratos e procurações") é SUBPASTA da raiz de modelos, então varrer
  // as duas sem dedup listava os mesmos arquivos duas vezes — o inventário
  // ganharia linhas repetidas e o segundo move falharia, já que o arquivo não
  // estaria mais no pai antigo.
  const jaVisto = new Set<string>();
  const pastasVisitadas = new Set<string>();

  async function varrer(pastaId: string, nivel = 0) {
    if (pastasVisitadas.has(pastaId)) return;
    pastasVisitadas.add(pastaId);
    for (const f of await arquivosDe(pastaId)) {
      const id = f.id as string;
      if (jaVisto.has(id)) continue;
      jaVisto.add(id);
      alvos.push({
        id,
        name: f.name as string,
        mimeType: f.mimeType ?? "",
        parentId: pastaId,
      });
    }
    if (nivel < 3) {
      for (const sub of await listFoldersInFolder(pastaId)) await varrer(sub.id, nivel + 1);
    }
  }

  for (const raiz of [MODELOS_ROOT, PROCURACAO_ROOT]) await varrer(raiz);

  // Depois da fase --mover, os modelos de teste não estão mais só nas raízes
  // legadas: a maior parte veio junto com a pasta do tipo para dentro do tema.
  // O Thiago autorizou apagar TODOS ("todos que estão ai são de testes e temos as
  // cópias"), então a varredura precisa alcançá-los onde estiverem.
  //
  // As pastas MODELOS/{...} recém-criadas são o destino do que o escritório vai
  // subir daqui para frente — se algum arquivo já estiver lá, é conteúdo novo e
  // NÃO deve ser arquivado.
  const sbTipos = getSupabaseAdmin();
  const { data: vincs } = await sbTipos
    .from("system_service_type_folders")
    .select("drive_folder_id, drive_modelos_folder_id")
    .eq("kind", "caso")
    .is("deleted_at", null);
  for (const v of (vincs ?? []) as Array<{
    drive_folder_id: string;
    drive_modelos_folder_id: string | null;
  }>) {
    for (const f of await arquivosDe(v.drive_folder_id)) {
      if (jaVisto.has(f.id as string)) continue;
      jaVisto.add(f.id as string);
      alvos.push({
        id: f.id as string,
        name: f.name as string,
        mimeType: f.mimeType ?? "",
        parentId: v.drive_folder_id,
      });
    }
  }

  console.log(`${alvos.length} arquivo(s) a arquivar.\n`);
  if (!alvos.length) return;

  // Agrupado por pasta, para a saída ser conferível pelo Thiago.
  const porPasta = new Map<string, Alvo[]>();
  for (const a of alvos) {
    const l = porPasta.get(a.parentId) ?? [];
    l.push(a);
    porPasta.set(a.parentId, l);
  }
  for (const [pid, itens] of porPasta) {
    console.log(`  ${await caminho(pid)}  (${itens.length})`);
    for (const i of itens) console.log(`     · ${i.name}`);
  }

  if (!COMMIT) {
    console.log("\nRode com --commit para arquivar.");
    return;
  }

  // Pasta de arquivo morto: fora das raízes legadas, para não ser varrida de novo.
  const destinoPai = RAIZ_DRIVE || MODELOS_ROOT;
  const jaExiste = (await listFoldersInFolder(destinoPai)).find(
    (f) => f.name.trim().toLowerCase() === PASTA_ARQUIVO.toLowerCase(),
  );
  const destino = jaExiste ?? (await createFolder(PASTA_ARQUIVO, destinoPai));
  console.log(`\nDestino: ${await caminho(destino.id)}`);

  // O que o sistema conhecia de cada arquivo — para o inventário poder ligar o
  // arquivo ao modelo que ele era.
  const { data: tpl } = await sb
    .from("system_document_templates")
    .select("id, google_doc_id")
    .is("deleted_at", null);
  const templatePorDoc = new Map(
    ((tpl ?? []) as Array<{ id: string; google_doc_id: string | null }>)
      .filter((t) => t.google_doc_id)
      .map((t) => [t.google_doc_id as string, t.id]),
  );

  let ok = 0;
  let falhas = 0;
  const movidos: string[] = [];
  for (const a of alvos) {
    try {
      const origem = await caminho(a.parentId);
      // O inventário é gravado ANTES do move: se o move falhar, sobra uma linha a
      // mais no log — inofensivo. Se fosse depois, um move seguido de falha na
      // escrita deixaria arquivo sem rastro, que é o único erro que não dá para
      // desfazer.
      const { error: errLog } = await sb.from("system_drive_archive_log").insert({
        lote: LOTE,
        motivo:
          "S2-04: modelos legados das raízes 07- Modelos e 08- Contratos e procurações. Thiago (04/09): todos de teste, com cópias. Owner (06/09): apagar do sistema, mantendo guardado.",
        drive_file_id: a.id,
        nome: a.name,
        mime_type: a.mimeType,
        origem_caminho: origem,
        origem_parent_id: a.parentId,
        destino_parent_id: destino.id,
        template_id: templatePorDoc.get(a.id) ?? null,
      } as never);
      if (errLog) throw new Error(`inventário: ${errLog.message}`);

      await moveFile(a.id, destino.id, a.parentId);
      movidos.push(a.id);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${a.name}:`, err instanceof Error ? err.message : err);
      falhas++;
    }
  }

  // Os modelos arquivados somem do sistema: soft-delete, para o popup de geração
  // não oferecer modelo que saiu de circulação. O arquivo continua no Drive.
  //
  // Só os que REALMENTE foram movidos. Na primeira execução isto usava a lista
  // inteira de alvos e rodava fora do try: o inventário falhou nos 71, nada foi
  // movido, e mesmo assim 58 modelos sumiram do sistema — some do app um modelo
  // que continua exatamente onde estava.
  let count = 0;
  if (movidos.length) {
    const { error: errTpl, count: n } = await sb
      .from("system_document_templates")
      .update({ deleted_at: new Date().toISOString() } as never, { count: "exact" })
      .in("google_doc_id", movidos)
      .is("deleted_at", null);
    if (errTpl) console.error("  ✗ soft-delete dos modelos:", errTpl.message);
    count = n ?? 0;
  }

  console.log(`\n${ok}/${alvos.length} arquivado(s), ${falhas} falha(s).`);
  console.log(`${count} modelo(s) tirado(s) de circulação no sistema.`);
  console.log(`Inventário: system_drive_archive_log, lote "${LOTE}".`);
}

async function main() {
  if (!FASE_MOVER && !FASE_ARQUIVAR) {
    console.log("Escolha a fase: --mover ou --arquivar (some --commit para aplicar).");
    return;
  }
  if (FASE_MOVER) await fase1();
  if (FASE_ARQUIVAR) await fase2();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
