// Ajuste pedido pelo owner em 06/09, depois de ver a estrutura no Drive.
//
// Três coisas, nesta ordem:
//
//   --achatar    tira a camada "MODELOS": as 3 categorias sobem para dentro da
//                pasta do TIPO e a MODELOS vazia vai para a lixeira.
//                Owner: "não precisamos da pasta modelos, pode cair direto para
//                selecionar uma dessas 3 pastas".
//
//   --restaurar  devolve os 73 Word arquivados no lote da S2-04. Eles foram
//                tirados de circulação porque o Thiago disse que eram todos de
//                teste; o owner reviu e quer todos de volta. O inventário
//                (`system_drive_archive_log`) guarda a origem de cada um, que é
//                exatamente para isto que ele existe.
//
//   --recolher   move para dentro de uma categoria os arquivos que ficaram
//                SOLTOS na raiz de uma pasta de tipo (subidos antes de o upload
//                passar a exigir categoria — foi o caso do tipo "teste").
//
// Para onde cada arquivo restaurado vai:
//   • origem era pasta de PROCURAÇÃO  → CONTRATO E PROCURAÇÃO
//   • origem era pasta de TIPO (caso) → ADMINISTRATIVO
//   • origem era pasta legada em "07- Modelos", sem vínculo com tema nenhum →
//     volta para onde estava. Não está em uso pelo sistema; devolver ao lugar de
//     origem é o que preserva o que o escritório organizou lá.
//
// Por que ADMINISTRATIVO e não JUDICIAL: os modelos de caso do escritório são
// requerimentos e declarações ("Requerimento CENSO 5", "Declaração Militar",
// "Requerimento ADM COVID") — peça administrativa, não judicial. Quem quiser
// mover para JUDICIAL faz pelo Drive; o sync acompanha.
//
// Dry-run por padrão em todas as fases.
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
  CATEGORIAS_MODELO,
  ensureTipoModelStructure,
  listTypeFolders,
  pastaDaCategoria,
  type CategoriaModelo,
  type ServiceTypeFolder,
} from "../src/lib/service-type-folders-service";
import { getSupabaseAdmin } from "../src/lib/supabase/server";

const COMMIT = process.argv.includes("--commit");
const F_ACHATAR = process.argv.includes("--achatar");
const F_RESTAURAR = process.argv.includes("--restaurar");
const F_RECOLHER = process.argv.includes("--recolher");

const LOTE = "s204-modelos-legados-2026-09-06";
const FOLDER_MIME = "application/vnd.google-apps.folder";

async function arquivosDe(id: string) {
  const todos = (await listFilesInFolder(id, 200)) as Array<{
    id?: string | null;
    name?: string | null;
    mimeType?: string | null;
  }>;
  return todos.filter((f) => f.mimeType !== FOLDER_MIME && f.id && f.name);
}

/** Todos os vínculos de tipo, com as colunas das categorias. */
async function tiposComEstrutura(): Promise<ServiceTypeFolder[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("system_service_types").select("id").is("deleted_at", null);
  const out: ServiceTypeFolder[] = [];
  for (const st of (data ?? []) as Array<{ id: string }>) {
    out.push(...(await listTypeFolders(st.id, "caso")));
  }
  return out;
}

// ---------------------------------------------------------------------------
// FASE 1 — tirar a camada MODELOS
// ---------------------------------------------------------------------------
async function achatar() {
  console.log(COMMIT ? "\nACHATAR — MODO COMMIT.\n" : "\nACHATAR — DRY-RUN.\n");
  const tipos = await tiposComEstrutura();
  let movidas = 0;
  let removidas = 0;

  for (const tipo of tipos) {
    const subs = await listFoldersInFolder(tipo.drive_folder_id);
    const modelos = subs.find((f) => f.name.trim().toUpperCase() === "MODELOS");
    if (!modelos) {
      console.log(`✓ ${tipo.name.trim()} — já está sem a camada MODELOS`);
      continue;
    }

    console.log(`\n📁 ${tipo.name.trim()}`);
    for (const cat of await listFoldersInFolder(modelos.id)) {
      console.log(`   → sobe "${cat.name}" para dentro do tipo`);
      if (COMMIT) {
        await moveFile(cat.id, tipo.drive_folder_id, modelos.id);
        movidas++;
      }
    }

    if (!COMMIT) {
      console.log(`   → removeria a pasta MODELOS`);
      continue;
    }

    // Só some se ficou vazia — se alguém deixou arquivo solto lá dentro, ele
    // ainda não foi tratado e apagar a pasta o levaria junto.
    const [sobrouPasta, sobrouArq] = await Promise.all([
      listFoldersInFolder(modelos.id),
      arquivosDe(modelos.id),
    ]);
    if (sobrouPasta.length || sobrouArq.length) {
      console.log(`   ⚠ MODELOS ainda tem ${sobrouArq.length} arquivo(s) — deixando por enquanto`);
    } else {
      await deleteFile(modelos.id);
      removidas++;
      console.log(`   🗑 MODELOS → lixeira`);
    }

    // Regrava os ids (agora as categorias são filhas diretas do tipo).
    await ensureTipoModelStructure(tipo.id);
  }

  if (COMMIT) console.log(`\n${movidas} categoria(s) movida(s), ${removidas} MODELOS removida(s).`);
  else console.log("\nRode com --commit para aplicar.");
}

// ---------------------------------------------------------------------------
// FASE 2 — restaurar os Word arquivados
// ---------------------------------------------------------------------------
async function restaurar() {
  console.log(COMMIT ? "\nRESTAURAR — MODO COMMIT.\n" : "\nRESTAURAR — DRY-RUN.\n");
  const sb = getSupabaseAdmin();

  const { data, error } = await sb
    .from("system_drive_archive_log")
    .select("drive_file_id, nome, origem_parent_id, origem_caminho, destino_parent_id")
    .eq("lote", LOTE);
  if (error) throw new Error(error.message);
  const itens = (data ?? []) as Array<{
    drive_file_id: string;
    nome: string;
    origem_parent_id: string;
    origem_caminho: string | null;
    destino_parent_id: string;
  }>;

  // Mapa: pasta de origem → para onde o arquivo vai agora.
  const tipos = await tiposComEstrutura();
  const porPastaDeTipo = new Map(tipos.map((t) => [t.drive_folder_id, t]));

  // As pastas de PROCURAÇÃO (kind='procuracao') e as subpastas da raiz legada de
  // procurações mandam o arquivo para CONTRATO E PROCURAÇÃO do tipo correspondente
  // — quando existe. Senão, volta para a origem.
  function categoriaDaOrigem(caminho: string | null): CategoriaModelo {
    if (caminho && /procura|contrato/i.test(caminho)) return "contrato";
    return "administrativo";
  }

  // Origem que foi para a LIXEIRA não serve de destino: a pasta ainda responde
  // por id e o move funciona sem erro nenhum — só que o arquivo vai parar dentro
  // da lixeira junto com ela. É o caso das camadas "Casos"/"Procurações", que a
  // própria S2-04 removeu.
  const origensVivas = new Map<string, boolean>();
  async function origemUtilizavel(id: string): Promise<boolean> {
    const memo = origensVivas.get(id);
    if (memo !== undefined) return memo;
    let ok = false;
    try {
      const m = (await getFileMeta(id)) as { trashed?: boolean };
      ok = !m.trashed;
    } catch {
      ok = false;
    }
    origensVivas.set(id, ok);
    return ok;
  }

  // Nome do tema → seus tipos. Serve para achar destino vivo quando a pasta de
  // origem já não existe: o caminho guardado tem o nome do tema.
  const { data: temasRaw } = await sb
    .from("system_temas")
    .select("name, system_service_types(id)")
    .is("deleted_at", null);
  const tiposPorNomeDoTema = new Map<string, ServiceTypeFolder[]>();
  for (const t of (temasRaw ?? []) as unknown as Array<{
    name: string;
    system_service_types: Array<{ id: string }>;
  }>) {
    const ids = new Set(t.system_service_types.map((x) => x.id));
    tiposPorNomeDoTema.set(
      t.name.trim().toLowerCase(),
      tipos.filter((tp) => ids.has(tp.service_type_id)),
    );
  }

  const planos: Array<{ id: string; nome: string; destino: string; onde: string }> = [];
  const semDestino: string[] = [];

  for (const it of itens) {
    const tipo = porPastaDeTipo.get(it.origem_parent_id);
    if (tipo) {
      const cat = categoriaDaOrigem(it.origem_caminho);
      let destino = pastaDaCategoria(tipo, cat);
      if (!destino && COMMIT) {
        destino = pastaDaCategoria(await ensureTipoModelStructure(tipo.id), cat);
      }
      if (destino) {
        planos.push({
          id: it.drive_file_id,
          nome: it.nome,
          destino,
          onde: `${tipo.name.trim()} / ${CATEGORIAS_MODELO.find((c) => c.id === cat)!.pasta}`,
        });
        continue;
      }
    }

    // Sem vínculo com tema: volta exatamente para onde estava — desde que o
    // lugar ainda exista fora da lixeira.
    if (it.origem_parent_id && (await origemUtilizavel(it.origem_parent_id))) {
      planos.push({
        id: it.drive_file_id,
        nome: it.nome,
        destino: it.origem_parent_id,
        onde: it.origem_caminho ?? "(origem)",
      });
      continue;
    }

    // A origem sumiu. Se dá para descobrir o TEMA pelo caminho, o arquivo vai
    // para a categoria certa do primeiro tipo dele; senão fica sem destino e é
    // reportado, nunca movido às cegas.
    const cat = categoriaDaOrigem(it.origem_caminho);
    // "Drive / 08- Temas / <TEMA> / <pasta>" — o nome do tema é o 3º pedaço.
    const temaNoCaminho = (it.origem_caminho ?? "").split("/")[2]?.trim().toLowerCase();
    const candidato = temaNoCaminho ? (tiposPorNomeDoTema.get(temaNoCaminho) ?? [])[0] : undefined;
    if (candidato) {
      let destino = pastaDaCategoria(candidato, cat);
      if (!destino && COMMIT) {
        destino = pastaDaCategoria(await ensureTipoModelStructure(candidato.id), cat);
      }
      if (destino) {
        planos.push({
          id: it.drive_file_id,
          nome: it.nome,
          destino,
          onde: `${candidato.name.trim()} / ${CATEGORIAS_MODELO.find((c) => c.id === cat)!.pasta}  (origem removida)`,
        });
        continue;
      }
    }
    semDestino.push(`${it.nome}  (origem "${it.origem_caminho}" não existe mais)`);
  }

  const porOnde = new Map<string, string[]>();
  for (const p of planos) {
    const l = porOnde.get(p.onde) ?? [];
    l.push(p.nome);
    porOnde.set(p.onde, l);
  }
  for (const [onde, nomes] of [...porOnde].sort()) {
    console.log(`\n  ${onde}  (${nomes.length})`);
    for (const n of nomes) console.log(`     · ${n}`);
  }
  if (semDestino.length) {
    console.log(`\n⚠ ${semDestino.length} sem destino conhecido: ${semDestino.join(", ")}`);
  }

  console.log(`\n${planos.length} arquivo(s) a restaurar.`);
  if (!COMMIT) {
    console.log("Rode com --commit para aplicar.");
    return;
  }

  let ok = 0;
  const restaurados: string[] = [];
  for (const p of planos) {
    try {
      // De onde o arquivo está AGORA (a pasta de arquivo), não de onde ele veio.
      const meta = (await getFileMeta(p.id)) as { parents?: string[] };
      const paiAtual = meta.parents?.[0];
      if (paiAtual === p.destino) {
        ok++;
        restaurados.push(p.id);
        continue; // já está no lugar — rodar de novo não faz nada
      }
      await moveFile(p.id, p.destino, paiAtual);
      restaurados.push(p.id);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${p.nome}:`, err instanceof Error ? err.message : err);
    }
  }

  // O inventário registra o que SAIU de circulação. O que voltou não pertence
  // mais a ele — deixar a linha faria o próximo QA acusar "modelo ativo apontando
  // para arquivo arquivado", que é justamente o alarme de inconsistência.
  if (restaurados.length) {
    const { error: errDel } = await sb
      .from("system_drive_archive_log")
      .delete()
      .in("drive_file_id", restaurados)
      .eq("lote", LOTE);
    if (errDel) console.error("  ✗ limpar inventário:", errDel.message);
  }

  // Os modelos voltam a existir para o sistema.
  const { count } = await sb
    .from("system_document_templates")
    .update({ deleted_at: null } as never, { count: "exact" })
    .in("google_doc_id", restaurados)
    .not("deleted_at", "is", null);

  console.log(`\n${ok}/${planos.length} restaurado(s).`);
  console.log(`${count ?? 0} modelo(s) reativado(s) no sistema.`);
  console.log("Rode o sync de modelos para reler as variáveis de cada um.");
}

// ---------------------------------------------------------------------------
// FASE 3 — recolher arquivos soltos na raiz de um tipo
// ---------------------------------------------------------------------------
async function recolher() {
  console.log(COMMIT ? "\nRECOLHER — MODO COMMIT.\n" : "\nRECOLHER — DRY-RUN.\n");
  const tipos = await tiposComEstrutura();
  let movidos = 0;

  for (const tipo of tipos) {
    const soltos = await arquivosDe(tipo.drive_folder_id);
    if (!soltos.length) continue;

    let destino = pastaDaCategoria(tipo, "administrativo");
    if (!destino && COMMIT) {
      destino = pastaDaCategoria(await ensureTipoModelStructure(tipo.id), "administrativo");
    }

    console.log(`\n📁 ${tipo.name.trim()} — ${soltos.length} arquivo(s) solto(s) na raiz`);
    for (const f of soltos) {
      console.log(`   → ${f.name} para ADMINISTRATIVO`);
      if (COMMIT && destino) {
        await moveFile(f.id as string, destino, tipo.drive_folder_id);
        movidos++;
      }
    }
  }

  if (!movidos && !COMMIT) console.log("\n(nada solto encontrado, ou dry-run)");
  if (COMMIT) console.log(`\n${movidos} arquivo(s) recolhido(s).`);
  else console.log("\nRode com --commit para aplicar.");
}

async function main() {
  if (!F_ACHATAR && !F_RESTAURAR && !F_RECOLHER) {
    console.log("Escolha: --achatar, --restaurar, --recolher (some --commit para aplicar).");
    return;
  }
  if (F_ACHATAR) await achatar();
  if (F_RESTAURAR) await restaurar();
  if (F_RECOLHER) await recolher();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
