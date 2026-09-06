// Esvazia a raiz legada "07- Modelos" — só onde dá para ter certeza.
//
// Owner (06/09): "só migre os arquivos que você tiver certeza, o que é teste
// pode excluir do sistema e do drive".
//
// Três destinos, e a régua de cada um é explícita:
//
//   MIGRAR   pastas cujo nome identifica o tema sem ambiguidade. O arquivo vai
//            para a pasta certa dentro do tema e passa a aparecer no sistema.
//
//   EXCLUIR  pastas de teste. Vão para a LIXEIRA do Drive (reversível ~30 dias,
//            porque a Service Account não apaga em definitivo em Shared Drive) e
//            os modelos saem de circulação no banco.
//
//   DEIXAR   o resto. "OUTROS", "Termos Acertos Financeiros" e "Emails de
//            cobrança" não dizem a que tema pertencem, e chutar colocaria o
//            modelo no lugar errado — pior do que deixar onde está. Ficam
//            listados no fim para o escritório decidir; o dropdown "Vincular"
//            continua oferecendo essas pastas.
//
// Dry-run por padrão:
//   npx tsx scripts/migrar-legado-07-modelos.ts
//   npx tsx scripts/migrar-legado-07-modelos.ts --commit
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });

import {
  deleteFile,
  getFileMeta,
  listFilesInFolder,
  listFoldersInFolder,
  moveFile,
} from "../src/lib/google/drive";
import {
  ensureTemaProcuracaoFolder,
  ensureTipoModelStructure,
  linkExistingFolder,
  listTypeFolders,
  pastaDaCategoria,
} from "../src/lib/service-type-folders-service";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const COMMIT = process.argv.includes("--commit");
const FOLDER_MIME = "application/vnd.google-apps.folder";

const MODELOS_ROOT =
  process.env.GOOGLE_DRIVE_MODELS_ROOT_FOLDER_ID?.trim() || "1su0XT7i2B7ziHGN1PTz5ZRhSWNFEZOsJ";

/**
 * O de-para de que tenho certeza. A chave é o nome da pasta legada; o valor diz
 * para qual TEMA vai e como.
 *
 *   tipo       → a pasta VIRA um tipo do tema (vinculada e movida para dentro).
 *                Usado quando a pasta é uma modalidade de atendimento.
 *   procuracao → os arquivos vão para a pasta de procuração do tema. Usado
 *                quando a pasta só guarda contrato/procuração.
 */
const CERTEZAS: Record<string, { tema: string; como: "tipo" | "procuracao" }> = {
  // Modalidade do FIES, irmã de "01- Abatimento ESF DGM" e "02- ESF Censo 05",
  // que já são tipos do tema.
  "03- abatimento esf portaria": { tema: "1% fies", como: "tipo" },

  // O nome é o próprio nome do tema.
  "desenrola fies": { tema: "Desenrola FIES", como: "tipo" },
  "desenrola fies - bb": { tema: "Desenrola FIES", como: "tipo" },

  // Subpastas de "08- Contratos e procurações": são procurações, e o nome diz o tema.
  residência: { tema: "Transferência de Residência Médica", como: "procuracao" },
  residencia: { tema: "Transferência de Residência Médica", como: "procuracao" },
  "fies esf": { tema: "1% fies", como: "procuracao" },
  "fies abatimento militar": { tema: "1% fies", como: "procuracao" },
  "fies abatimento covid": { tema: "1% fies", como: "procuracao" },
  "mais médicos": { tema: "Indenização Mais Médicos", como: "procuracao" },
  "mais medicos": { tema: "Indenização Mais Médicos", como: "procuracao" },
  "cobrança hv": { tema: "Inadimplência HV", como: "procuracao" },
  "cobranca hv": { tema: "Inadimplência HV", como: "procuracao" },
};

/** Pastas de teste — vão para a lixeira com o que tiver dentro. */
const EH_TESTE = /^(teste|abatimento teste|smoke_test)/i;

async function arquivosDe(id: string) {
  const todos = (await listFilesInFolder(id, 200)) as Array<{
    id?: string | null;
    name?: string | null;
    mimeType?: string | null;
  }>;
  return todos.filter((f) => f.mimeType !== FOLDER_MIME && f.id && f.name);
}

function chave(nome: string): string {
  return nome.trim().toLowerCase();
}

/**
 * Quantos arquivos a pasta tem, contando um nível de subpasta.
 *
 * Precisa contar fundo: uma pasta legada que já ganhou a estrutura de categorias
 * tem ZERO arquivos diretos e todos dentro de ADMINISTRATIVO. Contando só a
 * superfície, "03- Abatimento ESF Portaria" parecia vazia e ficava de fora da
 * migração com 4 modelos dentro.
 */
async function contaFundo(id: string): Promise<number> {
  let n = (await arquivosDe(id)).length;
  for (const sub of await listFoldersInFolder(id)) {
    n += (await arquivosDe(sub.id)).length;
  }
  return n;
}

async function main() {
  console.log(COMMIT ? "\nMODO COMMIT.\n" : "\nDRY-RUN.\n");
  const sb = getSupabaseAdmin();

  const { data: temasRaw } = await sb
    .from("system_temas")
    .select("id, name, drive_folder_id, system_service_types(id)")
    .is("deleted_at", null);
  const temas = (temasRaw ?? []) as unknown as Array<{
    id: string;
    name: string;
    drive_folder_id: string | null;
    system_service_types: Array<{ id: string }>;
  }>;
  const temaPorNome = new Map(temas.map((t) => [t.name.trim().toLowerCase(), t]));

  // Todas as pastas da raiz legada, incluindo as de dentro de "08- Contratos".
  type Pasta = { id: string; name: string; dentroDeContratos: boolean };
  const pastas: Pasta[] = [];
  for (const f of await listFoldersInFolder(MODELOS_ROOT)) {
    const ehContratos = /contratos e procura/i.test(f.name);
    pastas.push({ id: f.id, name: f.name, dentroDeContratos: false });
    if (ehContratos) {
      for (const sub of await listFoldersInFolder(f.id)) {
        pastas.push({ id: sub.id, name: sub.name, dentroDeContratos: true });
      }
    }
  }

  const migrados: string[] = [];
  const excluidos: string[] = [];
  const deixados: Array<{ nome: string; arquivos: number }> = [];

  for (const pasta of pastas) {
    // "08- Contratos e procurações" é pasta-MÃE das de procuração, não um
    // destino. Sem esta linha ela aparecia como "sem tema" com 25 arquivos —
    // que são, na verdade, os das subpastas tratadas logo abaixo.
    if (/contratos e procura/i.test(pasta.name) && !pasta.dentroDeContratos) continue;

    const k = chave(pasta.name);
    const arqs = await arquivosDe(pasta.id);
    const total = await contaFundo(pasta.id);

    // ---------------------------------------------------------------- TESTE
    if (EH_TESTE.test(pasta.name.trim())) {
      console.log(`\n🗑 ${pasta.name} — teste (${total} arquivo(s)) → lixeira`);
      if (COMMIT) {
        // Tira os modelos de circulação antes de a pasta sumir; senão sobra
        // registro no banco apontando para arquivo que ninguém mais acha.
        const ids = arqs.map((a) => a.id as string);
        if (ids.length) {
          await sb
            .from("system_document_templates")
            .update({ deleted_at: new Date().toISOString() } as never)
            .in("google_doc_id", ids)
            .is("deleted_at", null);
        }
        await deleteFile(pasta.id);
        excluidos.push(pasta.name);
      }
      continue;
    }

    if (!total) continue; // pasta legada vazia: ignorada

    // --------------------------------------------------------------- CERTEZA
    const regra = CERTEZAS[k];
    const tema = regra ? temaPorNome.get(regra.tema.trim().toLowerCase()) : undefined;

    if (!regra || !tema?.drive_folder_id) {
      deixados.push({ nome: pasta.name.trim(), arquivos: total });
      continue;
    }

    console.log(`\n📁 ${pasta.name.trim()} → ${tema.name} (${regra.como})`);

    if (regra.como === "tipo") {
      // A pasta INTEIRA vira um tipo do tema: vincula (o que já move a pasta
      // para dentro do tema e monta as categorias) e recolhe os soltos.
      console.log(`   → vira um tipo do tema, com ${total} modelo(s)`);
      if (!COMMIT) continue;

      const stId = tema.system_service_types[0]?.id;
      if (!stId) {
        console.log(`   ⚠ o tema não tem service_type — pulando`);
        continue;
      }
      const vinculo = await linkExistingFolder({
        serviceTypeId: stId,
        kind: "caso",
        driveFolderId: pasta.id,
        name: pasta.name.trim(),
      });
      const comEstrutura = await ensureTipoModelStructure(vinculo.id);
      // Só os que estiverem SOLTOS na raiz do tipo. O que já está dentro de uma
      // categoria fica onde está — mover tudo para ADMINISTRATIVO apagaria a
      // classificação que alguém já fez.
      const destino = pastaDaCategoria(comEstrutura, "administrativo");
      if (destino) {
        for (const a of await arquivosDe(pasta.id)) {
          await moveFile(a.id as string, destino, pasta.id);
        }
      }
      migrados.push(`${pasta.name.trim()} → ${tema.name}`);
      continue;
    }

    // procuracao — só os ARQUIVOS vão; a pasta legada fica (e esvazia).
    console.log(`   → ${arqs.length} arquivo(s) para a procuração do tema`);
    for (const a of arqs) console.log(`      · ${a.name}`);
    if (!COMMIT) continue;

    const destino = await ensureTemaProcuracaoFolder(tema.id);
    if (!destino) {
      console.log(`   ⚠ não consegui resolver a pasta de procuração — pulando`);
      continue;
    }
    for (const a of arqs) {
      const meta = (await getFileMeta(a.id as string)) as { parents?: string[] };
      await moveFile(a.id as string, destino, meta.parents?.[0]);
    }
    migrados.push(`${arqs.length} de ${pasta.name.trim()} → ${tema.name}`);
  }

  console.log("\n" + "─".repeat(60));
  if (COMMIT) {
    console.log(`\n${migrados.length} migração(ões):`);
    for (const m of migrados) console.log(`   ✓ ${m}`);
    console.log(`\n${excluidos.length} pasta(s) de teste na lixeira:`);
    for (const e of excluidos) console.log(`   🗑 ${e}`);
  }

  if (deixados.length) {
    console.log(`\n${deixados.length} pasta(s) SEM tema identificável — ficam como estão:`);
    for (const d of deixados) console.log(`   ? ${d.nome}  (${d.arquivos} arquivo(s))`);
    console.log(
      "\n   Chutar o tema colocaria o modelo no lugar errado. Use o dropdown\n" +
        '   "Vincular pasta de outro tema" na configuração do tema para resolver\n' +
        "   cada uma quando souber a que tema pertence.",
    );
  }

  if (!COMMIT) console.log("\nRode com --commit para aplicar.");
  else console.log("\nRode o sync de modelos em seguida.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
