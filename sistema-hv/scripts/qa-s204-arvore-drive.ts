// QA da S2-04 — árvore de modelos unificada no Drive.
//
// Roda contra o banco e o Drive REAIS (dev=prod neste projeto). É quase todo de
// leitura; a única escrita é o `ensureTipoModelStructure` do teste B, que é
// idempotente por construção — e provar isso é justamente o que o teste faz.
//
// Rodar: npx tsx scripts/qa-s204-arvore-drive.ts
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import { getFileMeta, listFilesInFolder, listFoldersInFolder } from "../src/lib/google/drive";
import {
  CATEGORIAS_MODELO,
  ensureTipoModelStructure,
  listPastasModelos,
  listTypeFolders,
  pastaDaCategoria,
} from "../src/lib/service-type-folders-service";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const FOLDER_MIME = "application/vnd.google-apps.folder";
let falhou = 0;

function check(label: string, cond: boolean, detalhe?: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}${detalhe ? ` — ${detalhe}` : ""}`);
    falhou++;
  }
}

async function main() {
  const sb = getSupabaseAdmin();

  // ======================================================== estrutura no Drive
  console.log("\n  A — a árvore no Drive bate com o desenho aprovado\n");

  const { data: temas } = await sb
    .from("system_temas")
    .select("id, name, drive_folder_id, system_service_types!inner(id)")
    .is("deleted_at", null);
  const linhas = (temas ?? []) as unknown as Array<{
    id: string;
    name: string;
    drive_folder_id: string | null;
    system_service_types: Array<{ id: string }>;
  }>;

  let tiposConferidos = 0;
  for (const tema of linhas) {
    if (!tema.drive_folder_id) continue;
    for (const st of tema.system_service_types) {
      for (const tipo of await listTypeFolders(st.id, "caso")) {
        tiposConferidos++;

        // 1. A pasta do tipo mora DENTRO da pasta do tema (o move funcionou e o
        //    id foi preservado — se tivesse copiado, o vínculo apontaria para a
        //    cópia antiga e este teste falharia).
        const meta = (await getFileMeta(tipo.drive_folder_id)) as { parents?: string[] };
        check(
          `${tema.name} / ${tipo.name.trim()} — está dentro da pasta do tema`,
          meta.parents?.[0] === tema.drive_folder_id,
          `pai = ${meta.parents?.[0]}`,
        );

        // 2. MODELOS existe e é filha do tipo.
        check(
          `${tipo.name.trim()} — tem MODELOS registrada`,
          !!tipo.drive_modelos_folder_id,
          "coluna vazia",
        );
        if (!tipo.drive_modelos_folder_id) continue;
        const metaMod = (await getFileMeta(tipo.drive_modelos_folder_id)) as {
          name?: string;
          parents?: string[];
        };
        check(
          `${tipo.name.trim()} — MODELOS é filha do tipo`,
          metaMod.parents?.[0] === tipo.drive_folder_id,
        );

        // 3. As três categorias existem, com o nome literal, dentro de MODELOS.
        const subs = await listFoldersInFolder(tipo.drive_modelos_folder_id);
        for (const cat of CATEGORIAS_MODELO) {
          const id = pastaDaCategoria(tipo, cat.id);
          check(`${tipo.name.trim()} — "${cat.pasta}" registrada`, !!id);
          if (!id) continue;
          const achada = subs.find((f) => f.id === id);
          check(
            `${tipo.name.trim()} — "${cat.pasta}" existe no Drive com o nome certo`,
            achada?.name.trim().toUpperCase() === cat.pasta,
            achada ? achada.name : "não está dentro de MODELOS",
          );
        }
      }
    }
  }
  check("há tipos para conferir", tiposConferidos > 0, String(tiposConferidos));

  // ======================================================== idempotência
  console.log("\n  B — rodar de novo não duplica nada\n");

  const { data: umTipo } = await sb
    .from("system_service_type_folders")
    .select("id, drive_folder_id, drive_modelos_folder_id")
    .eq("kind", "caso")
    .not("drive_modelos_folder_id", "is", null)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  const alvo = umTipo as {
    id: string;
    drive_folder_id: string;
    drive_modelos_folder_id: string;
  } | null;

  if (alvo) {
    const antes = await listFoldersInFolder(alvo.drive_folder_id);
    const antesModelos = await listFoldersInFolder(alvo.drive_modelos_folder_id);

    const depoisVinculo = await ensureTipoModelStructure(alvo.id);

    const depois = await listFoldersInFolder(alvo.drive_folder_id);
    const depoisModelos = await listFoldersInFolder(alvo.drive_modelos_folder_id);

    check(
      "reexecutar não cria uma segunda MODELOS",
      antes.length === depois.length,
      `${antes.length} → ${depois.length}`,
    );
    check(
      "reexecutar não cria categoria repetida",
      antesModelos.length === depoisModelos.length,
      `${antesModelos.length} → ${depoisModelos.length}`,
    );
    check(
      "reexecutar devolve os MESMOS ids",
      depoisVinculo.drive_modelos_folder_id === alvo.drive_modelos_folder_id,
    );
  } else {
    check("há um tipo com estrutura para testar idempotência", false);
  }

  // ======================================================== arquivamento
  console.log("\n  C — o que saiu de circulação está guardado e recuperável\n");

  const { data: inv } = await sb
    .from("system_drive_archive_log")
    .select("drive_file_id, nome, origem_caminho, destino_parent_id")
    .eq("lote", "s204-modelos-legados-2026-09-06");
  const linhasInv = (inv ?? []) as Array<{
    drive_file_id: string;
    nome: string;
    origem_caminho: string | null;
    destino_parent_id: string;
  }>;

  check("o inventário tem registros", linhasInv.length > 0, String(linhasInv.length));
  check(
    "todo registro guarda o caminho de origem (sem ele não dá para restaurar)",
    linhasInv.every((l) => !!l.origem_caminho),
  );

  // Amostra: os arquivos existem mesmo e estão na pasta de arquivo.
  const amostra = linhasInv.slice(0, 5);
  for (const a of amostra) {
    try {
      const m = (await getFileMeta(a.drive_file_id)) as {
        name?: string;
        parents?: string[];
        trashed?: boolean;
      };
      check(
        `"${a.nome}" continua existindo no Drive`,
        !!m.name,
        "arquivo sumiu — o arquivamento deveria MOVER, nunca apagar",
      );
      check(
        `"${a.nome}" está na pasta de arquivo`,
        m.parents?.[0] === a.destino_parent_id,
        `pai = ${m.parents?.[0]}`,
      );
    } catch (err) {
      check(`"${a.nome}" acessível`, false, err instanceof Error ? err.message : String(err));
    }
  }

  // Nenhum modelo ativo pode apontar para arquivo arquivado — seria um modelo
  // oferecido no popup cujo arquivo saiu de circulação.
  const { data: fantasmas } = await sb
    .from("system_document_templates")
    .select("id, name, google_doc_id")
    .is("deleted_at", null);
  const idsArquivados = new Set(linhasInv.map((l) => l.drive_file_id));
  const orfaos = ((fantasmas ?? []) as Array<{ name: string; google_doc_id: string | null }>)
    .filter((t) => t.google_doc_id && idsArquivados.has(t.google_doc_id))
    .map((t) => t.name);
  check(
    "nenhum modelo ATIVO aponta para arquivo arquivado",
    orfaos.length === 0,
    orfaos.join(", "),
  );

  // ======================================================== sync
  console.log("\n  D — o sync alcança as pastas novas\n");

  const pastas = await listPastasModelos();
  check("listPastasModelos devolve as pastas MODELOS", pastas.length > 0, String(pastas.length));

  // O sync desce UM nível: varrer MODELOS precisa expor as 3 categorias como
  // subpastas dele. Se algum dia a estrutura ganhar um nível a mais, este teste
  // avisa antes de o modelo sumir do popup.
  if (pastas.length) {
    const subs = await listFoldersInFolder(pastas[0]);
    check(
      "as categorias são subpastas DIRETAS de MODELOS (o sync só desce 1 nível)",
      subs.length === CATEGORIAS_MODELO.length,
      `${subs.length} subpasta(s): ${subs.map((x) => x.name).join(", ")}`,
    );
  }

  // ======================================================== raízes legadas
  console.log("\n  E — as raízes legadas ficaram sem modelo solto\n");

  const MODELOS_ROOT =
    process.env.GOOGLE_DRIVE_MODELS_ROOT_FOLDER_ID?.trim() || "1su0XT7i2B7ziHGN1PTz5ZRhSWNFEZOsJ";
  async function contaArquivos(id: string, nivel = 0): Promise<number> {
    const itens = (await listFilesInFolder(id, 200)) as Array<{ mimeType?: string }>;
    let n = itens.filter((f) => f.mimeType !== FOLDER_MIME).length;
    if (nivel < 3) {
      for (const sub of await listFoldersInFolder(id)) n += await contaArquivos(sub.id, nivel + 1);
    }
    return n;
  }
  const sobraram = await contaArquivos(MODELOS_ROOT);
  check(
    "nenhum arquivo sobrou na raiz legada de modelos",
    sobraram === 0,
    `${sobraram} arquivo(s)`,
  );

  if (falhou) {
    console.error(`\nS2-04: ${falhou} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nS2-04: todas as verificações passaram.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
