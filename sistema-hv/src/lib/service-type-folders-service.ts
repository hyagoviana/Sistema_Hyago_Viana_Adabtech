// Server-only — Pastas do Drive vinculadas a cada TIPO de serviço (categoria).
// kind='caso' → documentos de caso; kind='procuracao' → procurações.
// Cada tipo pode ter VÁRIAS pastas de caso (ex.: FIES ESF) e de procuração.
// Fonte de verdade: system_service_type_folders (migration 20260709000030).

import {
  ensureFolderByName,
  getFileMeta,
  listFilesInFolder,
  listFoldersInFolder,
  moveFile,
} from "./google/drive";
import { getSupabaseAdmin } from "./supabase/server";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

// Pastas-raiz onde as pastas NOVAS são criadas (owner, 2026-07-09):
//   caso       → "07- Modelos"
//   procuracao → "08- Contratos e procurações"
const MODELS_ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_MODELS_ROOT_FOLDER_ID?.trim() || "1su0XT7i2B7ziHGN1PTz5ZRhSWNFEZOsJ";
const PROCURACAO_ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_PROCURACAO_FOLDER_ID?.trim() || "1ed5kBsyHalUuMoap_0i_KJQ_fFfbiPYd";

// Pastas que NUNCA devem aparecer no seletor de pasta de CASO (owner, 2026-07-21).
// São pastas que ficam na raiz "07- Modelos" mas não são modelos de caso: a pasta
// de procurações espelhada, testes, etc. Filtro por ID (robusto — independe do
// nome, ao contrário do filtro A11). Configurável via env (CSV) e SEMPRE inclui
// os defaults abaixo. As demais subpastas continuam aparecendo, inclusive novas.
const CASO_FOLDER_BLOCKLIST = new Set(
  [
    "1ed5kBsyHalUuMoap_0i_KJQ_fFfbiPYd", // pasta-mãe de procurações
    "19wAelW2KUeRsiXRmBFPlhKTptQAPjD7V", // "abatimento teste"
    "1A_z2nMxeMu9EMU2NTjy0uBsCBqLcMptC", // pasta pedida pelo owner
    ...(process.env.GOOGLE_DRIVE_CASO_BLOCKED_FOLDER_IDS?.split(",") ?? []),
  ]
    .map((s) => s.trim())
    .filter(Boolean),
);

export type FolderKind = "caso" | "procuracao";

export class ServiceTypeFoldersError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ServiceTypeFoldersError";
  }
}

export type ServiceTypeFolder = {
  id: string;
  service_type_id: string;
  kind: FolderKind;
  drive_folder_id: string;
  name: string;
  ordem: number;
  frente_slug: string | null;
  // S2-04 — estrutura MODELOS/{JUDICIAL,CONTRATO E PROCURAÇÃO,ADMINISTRATIVO}
  // dentro da pasta do TIPO. NULL = tipo ainda sem a estrutura nova.
  drive_modelos_folder_id: string | null;
  drive_judicial_folder_id: string | null;
  drive_contrato_folder_id: string | null;
  drive_administrativo_folder_id: string | null;
};

// S2-04 — as três categorias de modelo que o Thiago definiu. Fixas de propósito:
// são pastas com nome literal no Drive, não uma lista configurável.
export const CATEGORIAS_MODELO = [
  { id: "judicial", pasta: "JUDICIAL", rotulo: "Documento judicial" },
  { id: "contrato", pasta: "CONTRATO E PROCURAÇÃO", rotulo: "Contrato e procuração" },
  { id: "administrativo", pasta: "ADMINISTRATIVO", rotulo: "Documento administrativo" },
] as const;

// As categorias que ficam DENTRO do tipo. "Contrato e procuração" saiu daqui em
// 06/09: a procuração vale para o tema inteiro, não para um tipo — cada tema tem
// uma só, e empurrá-la para dentro de um tipo deixaria os outros sem nenhuma.
export const CATEGORIAS_DO_TIPO = CATEGORIAS_MODELO.filter((c) => c.id !== "contrato");

/** Nome da pasta de procuração, agora no nível do TEMA. */
export const PASTA_PROCURACAO_TEMA = "CONTRATO E PROCURAÇÃO";

export type CategoriaModelo = (typeof CATEGORIAS_MODELO)[number]["id"];

// Coluna onde o id de cada categoria é guardado.
const COLUNA_POR_CATEGORIA: Record<CategoriaModelo, string> = {
  judicial: "drive_judicial_folder_id",
  contrato: "drive_contrato_folder_id",
  administrativo: "drive_administrativo_folder_id",
};

export function pastaDaCategoria(
  folder: ServiceTypeFolder,
  categoria: CategoriaModelo,
): string | null {
  return (folder[COLUNA_POR_CATEGORIA[categoria] as keyof ServiceTypeFolder] as string) ?? null;
}

// S2-04 (2026-09-06) — MOVE a pasta vinculada para dentro da pasta do tema.
//
// Isto era um ESPELHO: criava uma pasta com o mesmo nome dentro do tema e
// deixava a original onde estava. Resultado medido em 06/09: as 11 pastas de
// tipo continuavam em "07- Modelos" (era de lá que o sistema lia) e o tema
// exibia cascas vazias. Duas árvores paralelas — a queixa do Thiago na reunião:
// "queria unificar essas duas (...) tá puxando daqui, não tá puxando de lá".
//
// Mover troca o `parents` e PRESERVA o id do Drive, então o vínculo (que aponta
// por id) e todo link já gerado continuam válidos.
//
// BEST-EFFORT: se o tema não tem pasta ou o Drive falha, NÃO derruba o vínculo —
// a fonte de verdade é o banco.
async function moverPastaParaTema(
  sb: ReturnType<typeof getSupabaseAdmin>,
  serviceTypeId: string,
  driveFolderId: string,
): Promise<void> {
  try {
    const { data: st } = await sb
      .from("system_service_types")
      .select("tema_id")
      .eq("id", serviceTypeId)
      .maybeSingle();
    const temaId = (st as { tema_id?: string | null } | null)?.tema_id;
    if (!temaId) return; // service_type legado (sem tema) — não há para onde mover.

    // Uma pasta pode estar vinculada a mais de um tema (o vínculo é N:N), e uma
    // pasta só tem um lugar no Drive. Mover neste caso tiraria a pasta do outro
    // tema sem ninguém pedir — então não move.
    const { data: outros } = await sb
      .from("system_service_type_folders")
      .select("service_type_id, system_service_types!inner(tema_id)")
      .eq("drive_folder_id", driveFolderId)
      .is("deleted_at", null);
    const temas = new Set(
      ((outros ?? []) as unknown as Array<{ system_service_types: { tema_id: string | null } }>)
        .map((o) => o.system_service_types?.tema_id)
        .filter(Boolean) as string[],
    );
    if (temas.size > 1) {
      console.warn(
        `service-type-folders: pasta ${driveFolderId} está vinculada a ${temas.size} temas — não movo (uma pasta só tem um lugar).`,
      );
      return;
    }

    const { data: tema } = await sb
      .from("system_temas")
      .select("drive_folder_id")
      .eq("id", temaId)
      .maybeSingle();
    const destino = (tema as { drive_folder_id?: string | null } | null)?.drive_folder_id;
    if (!destino) return; // tema ainda sem pasta no Drive.

    const meta = (await getFileMeta(driveFolderId)) as { parents?: string[] };
    const paiAtual = meta.parents?.[0];
    if (paiAtual === destino) return; // já está no lugar certo.

    await moveFile(driveFolderId, destino, paiAtual);
  } catch (err) {
    console.error(
      "service-type-folders: falha ao mover a pasta para dentro do tema:",
      err instanceof Error ? err.message : err,
    );
  }
}

// (R2-04) Lista as pastas de uma categoria (opcionalmente filtrando por kind).
// `frenteSlug` (opcional):
//   • undefined → gestão/admin: devolve TODAS as pastas (comuns + de todas as
//     frentes) — usado pelo editor de vínculo de pastas.
//   • string    → resolução por caso de uma frente: pastas dessa frente OU comuns
//     (frente_slug IS NULL). NUNCA esconde as pastas comuns do tema.
//   • null      → caso SEM frente: só as pastas comuns (frente_slug IS NULL). O
//     fallback por case_type (nos modelos) preserva os casos legados.
export async function listTypeFolders(
  serviceTypeId: string,
  kind?: FolderKind,
  frenteSlug?: string | null,
): Promise<ServiceTypeFolder[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("system_service_type_folders_active")
    .select(
      "id, service_type_id, kind, drive_folder_id, name, ordem, frente_slug, drive_modelos_folder_id, drive_judicial_folder_id, drive_contrato_folder_id, drive_administrativo_folder_id",
    )
    .eq("service_type_id", serviceTypeId)
    .order("kind", { ascending: true })
    .order("ordem", { ascending: true });
  if (kind) q = q.eq("kind", kind);
  // frenteSlug informado (mesmo null) → filtra por frente + comuns. undefined
  // (parâmetro omitido) → sem filtro de frente (gestão vê tudo).
  if (frenteSlug !== undefined) {
    q =
      frenteSlug === null
        ? q.is("frente_slug", null)
        : q.or(`frente_slug.eq.${frenteSlug},frente_slug.is.null`);
  }
  const { data, error } = await q;
  if (error) throw new ServiceTypeFoldersError(error.message, 500);
  // As colunas de S2-04 ainda não estão no types.ts gerado — cast via unknown
  // (mesmo padrão de `source_folder_id` em document-templates-service).
  return (data ?? []) as unknown as ServiceTypeFolder[];
}

// Retorna só os IDs de pasta do Drive de uma categoria+kind (para filtrar modelos).
export async function listTypeFolderIds(
  serviceTypeId: string,
  kind: FolderKind,
  frenteSlug?: string | null,
): Promise<string[]> {
  const rows = await listTypeFolders(serviceTypeId, kind, frenteSlug);
  return rows.map((r) => r.drive_folder_id);
}

// Vincula uma pasta EXISTENTE (id do Drive) à categoria. Idempotente por UNIQUE.
// `frenteSlug` (R2-04): NULL/omisso = vale para todo o tema; setado = só a frente.
// O UNIQUE (service_type_id, kind, drive_folder_id, COALESCE(frente_slug,'')) permite
// a MESMA pasta vinculada ao tema todo E a uma frente específica (linhas distintas).
export async function linkExistingFolder(input: {
  serviceTypeId: string;
  kind: FolderKind;
  driveFolderId: string;
  name: string;
  frenteSlug?: string | null;
}): Promise<ServiceTypeFolder> {
  const sb = getSupabaseAdmin();
  const frenteSlug = input.frenteSlug ?? null;
  const cols =
    "id, service_type_id, kind, drive_folder_id, name, ordem, frente_slug, drive_modelos_folder_id, drive_judicial_folder_id, drive_contrato_folder_id, drive_administrativo_folder_id";

  // Idempotência manual: o UNIQUE parcial usa COALESCE(frente_slug,''), uma
  // EXPRESSÃO — o ON CONFLICT do PostgREST (upsert) só casa lista de colunas
  // literais, não expressão. Então checamos o vínculo ativo do mesmo escopo
  // (service_type_id + kind + drive_folder_id + frente) e atualizamos o nome, ou
  // inserimos. Igual à semântica anterior do upsert (ignoreDuplicates:false).
  let dup = sb
    .from("system_service_type_folders")
    .select("id")
    .eq("service_type_id", input.serviceTypeId)
    .eq("kind", input.kind)
    .eq("drive_folder_id", input.driveFolderId)
    .is("deleted_at", null);
  dup = frenteSlug === null ? dup.is("frente_slug", null) : dup.eq("frente_slug", frenteSlug);
  const { data: existingLink } = await dup.maybeSingle();

  if (existingLink) {
    const { data, error } = await sb
      .from("system_service_type_folders")
      .update({ name: input.name })
      .eq("id", (existingLink as { id: string }).id)
      .select(cols)
      .single();
    if (error || !data)
      throw new ServiceTypeFoldersError(error?.message ?? "Falha ao vincular pasta", 500);
    return data as unknown as ServiceTypeFolder;
  }

  // ordem = nº de pastas já vinculadas ao MESMO escopo (kind + frente).
  const existing = await listTypeFolders(input.serviceTypeId, input.kind, frenteSlug);
  const ordem = existing.length;
  const { data, error } = await sb
    .from("system_service_type_folders")
    .insert({
      organization_id: DEFAULT_ORG,
      service_type_id: input.serviceTypeId,
      kind: input.kind,
      drive_folder_id: input.driveFolderId,
      name: input.name,
      ordem,
      frente_slug: frenteSlug,
    })
    .select(cols)
    .single();
  if (error || !data)
    throw new ServiceTypeFoldersError(error?.message ?? "Falha ao vincular pasta", 500);

  // S2-04 — vínculo NOVO criado: a pasta vai morar DENTRO do tema. Best-effort,
  // não derruba o vínculo.
  await moverPastaParaTema(sb, input.serviceTypeId, input.driveFolderId);

  // S2-04 — um vínculo de caso É um TIPO, e todo tipo nasce com a estrutura
  // MODELOS/{JUDICIAL, CONTRATO E PROCURAÇÃO, ADMINISTRATIVO}. Best-effort pela
  // mesma razão do espelho: o vínculo já está gravado, e a estrutura é
  // reconstruída na próxima abertura da configuração do tema.
  if (input.kind === "caso") {
    try {
      return await ensureTipoModelStructure((data as unknown as { id: string }).id);
    } catch (err) {
      console.error(
        "service-type-folders: falha ao criar a estrutura MODELOS do tipo novo:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return data as unknown as ServiceTypeFolder;
}

// Cria uma pasta NOVA no Drive (sob a raiz correta por kind) e a vincula à categoria.
export async function createAndLinkFolder(input: {
  serviceTypeId: string;
  kind: FolderKind;
  name: string;
  frenteSlug?: string | null;
}): Promise<ServiceTypeFolder> {
  const name = input.name.trim();
  if (!name) throw new ServiceTypeFoldersError("Informe o nome da pasta", 422);
  // S2-04 — a pasta nasce DENTRO do tema, que é onde ela vai morar. Antes nascia
  // na raiz legada de modelos e o vínculo a espelhava no tema, o que produzia as
  // duas árvores paralelas. As raízes legadas ficam só como destino de fallback,
  // para service_type sem tema.
  const sbTema = getSupabaseAdmin();
  const { data: st } = await sbTema
    .from("system_service_types")
    .select("tema_id")
    .eq("id", input.serviceTypeId)
    .maybeSingle();
  const temaId = (st as { tema_id?: string | null } | null)?.tema_id;
  let parent: string | null = null;
  if (temaId) {
    const { data: tema } = await sbTema
      .from("system_temas")
      .select("drive_folder_id")
      .eq("id", temaId)
      .maybeSingle();
    parent = (tema as { drive_folder_id?: string | null } | null)?.drive_folder_id ?? null;
  }
  parent ??= input.kind === "procuracao" ? PROCURACAO_ROOT_FOLDER_ID : MODELS_ROOT_FOLDER_ID;

  // Reusa a pasta existente em vez de criar cegamente: criar sem olhar deixava
  // duplicatas de mesmo nome lado a lado (é o caso de "TESTE6-TIPO1").
  const folder = await ensureFolderByName(name, parent);
  return linkExistingFolder({
    serviceTypeId: input.serviceTypeId,
    kind: input.kind,
    driveFolderId: folder.id,
    name: folder.name,
    frenteSlug: input.frenteSlug ?? null,
  });
}

/**
 * As pastas que o admin pode VINCULAR a um tema.
 *
 * Owner (06/09): "o vincular deve vir da aba tema — quando clicar em vincular, se
 * for em um caso deve aparecer todas as pastas de casos dentro dos outros temas
 * já criados, e a mesma coisa funciona para procuração".
 *
 * Antes isto lia a raiz legada "07- Modelos", que é justamente a que deixou de ser
 * usada: o dropdown oferecia "TESTE6-TIPO1", "Desenrola FIES - BB" e outros
 * resíduos, e nenhum dos tipos que o escritório usa de verdade.
 *
 * Agora vem dos TEMAS:
 *   kind='caso'       → as pastas de TIPO de todos os temas
 *   kind='procuracao' → a pasta "CONTRATO E PROCURAÇÃO" de cada tema
 *
 * As pastas legadas que AINDA têm arquivo continuam no fim da lista, marcadas.
 * Removê-las de uma vez esconderia modelos que estão em uso — "03- Abatimento ESF
 * Portaria" tem 4 deles. Some sozinho quando o escritório esvaziar as pastas.
 */
export async function listRootModelFolders(
  kind: FolderKind,
): Promise<{ id: string; name: string; url: string }[]> {
  const sb = getSupabaseAdmin();
  const saida: { id: string; name: string; url: string }[] = [];
  const vistos = new Set<string>();

  const { data: temasRaw } = await sb
    .from("system_temas")
    .select("name, drive_folder_id, drive_contratacao_folder_id")
    .not("drive_folder_id", "is", null)
    .is("deleted_at", null)
    .order("name");
  const temas = (temasRaw ?? []) as Array<{
    name: string;
    drive_folder_id: string;
    drive_contratacao_folder_id: string | null;
  }>;

  for (const tema of temas) {
    if (kind === "procuracao") {
      // Uma por tema. Se ainda não existe, é criada na hora — assim o dropdown
      // nunca fica vazio só porque o tema é novo.
      let id = tema.drive_contratacao_folder_id;
      if (!id) {
        try {
          id = (await ensureFolderByName(PASTA_PROCURACAO_TEMA, tema.drive_folder_id)).id;
        } catch {
          continue;
        }
      }
      if (id && !vistos.has(id)) {
        vistos.add(id);
        saida.push({
          id,
          name: `${tema.name} · ${PASTA_PROCURACAO_TEMA}`,
          url: `https://drive.google.com/drive/folders/${id}`,
        });
      }
      continue;
    }

    // kind='caso' — os TIPOS do tema são suas subpastas, menos a de procuração.
    let subs: Array<{ id: string; name: string; url: string }> = [];
    try {
      subs = await listFoldersInFolder(tema.drive_folder_id);
    } catch {
      continue;
    }
    for (const sub of subs) {
      if (sub.name.trim().toUpperCase() === PASTA_PROCURACAO_TEMA) continue;
      if (vistos.has(sub.id)) continue;
      vistos.add(sub.id);
      saida.push({ id: sub.id, name: `${tema.name} · ${sub.name.trim()}`, url: sub.url });
    }
  }

  // Legado: só o que ainda tem arquivo dentro. Vazio é resíduo e não precisa
  // aparecer; com conteúdo, esconder seria fazer sumir modelo em uso.
  const raizLegada = kind === "procuracao" ? PROCURACAO_ROOT_FOLDER_ID : MODELS_ROOT_FOLDER_ID;
  let legadas: Array<{ id: string; name: string; url: string }> = [];
  try {
    legadas = await listFoldersInFolder(raizLegada);
  } catch {
    legadas = [];
  }

  for (const f of legadas) {
    if (vistos.has(f.id)) continue;
    if (kind === "caso" && CASO_FOLDER_BLOCKLIST.has(f.id)) continue;
    if (!(await temConteudo(f.id))) continue;
    vistos.add(f.id);
    saida.push({ id: f.id, name: `(fora dos temas) ${f.name.trim()}`, url: f.url });
  }

  return saida;
}

/** `true` se a pasta tem algum arquivo, direto ou numa subpasta (1 nível). */
async function temConteudo(id: string): Promise<boolean> {
  const naoEhPasta = (f: { mimeType?: string | null }) =>
    f.mimeType !== "application/vnd.google-apps.folder";
  try {
    const itens = (await listFilesInFolder(id, 100)) as Array<{ mimeType?: string | null }>;
    if (itens.some(naoEhPasta)) return true;
    for (const sub of await listFoldersInFolder(id)) {
      const dentro = (await listFilesInFolder(sub.id, 100)) as Array<{ mimeType?: string | null }>;
      if (dentro.some(naoEhPasta)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

// ---------------------------------------------------------------------------
// S2-04 — estrutura MODELOS/{3 categorias} dentro da pasta do TIPO
// ---------------------------------------------------------------------------

// Garante `<TIPO>/MODELOS/{JUDICIAL, CONTRATO E PROCURAÇÃO, ADMINISTRATIVO}` no
// Drive e grava os ids no vínculo. Idempotente: reusa o que já existe (por nome)
// e só cria o que falta — pode rodar quantas vezes quiser.
//
// Resolve cada subpasta de forma INDEPENDENTE, como o `tema-service` já faz: se
// criar uma falhar, as outras não são perdidas. Devolve o vínculo atualizado.
export async function ensureTipoModelStructure(vinculoId: string): Promise<ServiceTypeFolder> {
  const sb = getSupabaseAdmin();
  const cols =
    "id, service_type_id, kind, drive_folder_id, name, ordem, frente_slug, drive_modelos_folder_id, drive_judicial_folder_id, drive_contrato_folder_id, drive_administrativo_folder_id";

  const { data: atual, error: errAtual } = await sb
    .from("system_service_type_folders")
    .select(cols)
    .eq("id", vinculoId)
    .is("deleted_at", null)
    .maybeSingle();
  if (errAtual) throw new ServiceTypeFoldersError(errAtual.message, 500);
  if (!atual) throw new ServiceTypeFoldersError("Pasta não encontrada", 404);
  const vinculo = atual as unknown as ServiceTypeFolder;

  // As 3 categorias ficam DIRETO dentro da pasta do TIPO.
  //
  // Havia uma pasta "MODELOS" no meio; o owner tirou (06/09): "não precisamos da
  // pasta modelos, pode cair direto para selecionar uma dessas 3 pastas". Era um
  // clique a mais para chegar em qualquer modelo, sem separar nada — dentro do
  // TIPO só existem as categorias mesmo.
  //
  // `drive_modelos_folder_id` passa a apontar para a PRÓPRIA pasta do tipo: é ela
  // que o sync varre (e o sync desce um nível, alcançando as 3 categorias).
  const patch: Record<string, string> = { drive_modelos_folder_id: vinculo.drive_folder_id };
  for (const cat of CATEGORIAS_DO_TIPO) {
    try {
      const sub = await ensureFolderByName(cat.pasta, vinculo.drive_folder_id);
      patch[COLUNA_POR_CATEGORIA[cat.id]] = sub.id;
    } catch (err) {
      // Falha numa categoria não derruba as outras — o que foi resolvido é
      // gravado, e a próxima execução completa o que faltou.
      console.error(
        `service-type-folders: falha ao criar a subpasta "${cat.pasta}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const { data, error } = await sb
    .from("system_service_type_folders")
    .update(patch as never)
    .eq("id", vinculoId)
    .select(cols)
    .single();
  if (error || !data)
    throw new ServiceTypeFoldersError(error?.message ?? "Falha ao gravar a estrutura", 500);
  return data as unknown as ServiceTypeFolder;
}

// Roda `ensureTipoModelStructure` para todos os TIPOS de um tema (os vínculos
// kind='caso'). Usado ao abrir a configuração do tema, para que um tema antigo
// ganhe a estrutura nova sem ninguém precisar clicar em nada.
//
// Best-effort por vínculo: um tipo que falhe no Drive não impede os outros.
export async function ensureTemaModelStructure(
  serviceTypeId: string,
): Promise<{ ok: number; falhas: number }> {
  const tipos = await listTypeFolders(serviceTypeId, "caso");
  let ok = 0;
  let falhas = 0;
  for (const t of tipos) {
    try {
      await ensureTipoModelStructure(t.id);
      ok++;
    } catch (err) {
      falhas++;
      console.error(
        `service-type-folders: falha na estrutura do tipo "${t.name}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { ok, falhas };
}

/**
 * Garante a pasta "CONTRATO E PROCURAÇÃO" DO TEMA e devolve o id.
 *
 * A procuração vale para o tema inteiro (owner, 06/09) — cada tema tem uma só, e
 * colocá-la dentro de um tipo deixaria os outros tipos sem nenhuma.
 *
 * Idempotente: reusa a pasta que já existir com esse nome.
 */
export async function ensureTemaProcuracaoFolder(temaId: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_temas")
    .select("drive_folder_id, drive_contratacao_folder_id")
    .eq("id", temaId)
    .maybeSingle();
  const t = data as {
    drive_folder_id?: string | null;
    drive_contratacao_folder_id?: string | null;
  } | null;
  if (!t?.drive_folder_id) return null; // tema sem pasta no Drive

  const pasta = await ensureFolderByName(PASTA_PROCURACAO_TEMA, t.drive_folder_id);
  if (t.drive_contratacao_folder_id !== pasta.id) {
    await sb
      .from("system_temas")
      .update({ drive_contratacao_folder_id: pasta.id } as never)
      .eq("id", temaId);
  }
  return pasta.id;
}

/** O tema por trás de um service_type. */
async function temaDoServiceType(serviceTypeId: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("system_service_types")
    .select("tema_id")
    .eq("id", serviceTypeId)
    .maybeSingle();
  return (data as { tema_id?: string | null } | null)?.tema_id ?? null;
}

// S2-04 — de onde vêm os modelos de CONTRATO E PROCURAÇÃO de um tema.
//
// Na estrutura nova, procuração deixou de ser uma pasta irmã e virou uma
// CATEGORIA dentro de cada TIPO ("CONTRATO E PROCURAÇÃO"). Mas os vínculos
// `kind='procuracao'` continuam válidos para os casos em andamento — então a
// resposta é a UNIÃO das duas fontes, e não a troca de uma pela outra. Trocar
// deixaria sem modelo de procuração qualquer caso cujo tema ainda não migrou.
export async function listPastasContratoProcuracao(serviceTypeId: string): Promise<string[]> {
  const [tipos, legado, temaId] = await Promise.all([
    listTypeFolders(serviceTypeId, "caso"),
    listTypeFolders(serviceTypeId, "procuracao"),
    temaDoServiceType(serviceTypeId),
  ]);

  const ids: string[] = [];

  // 1º — a pasta do TEMA. É onde a procuração mora desde 06/09.
  if (temaId) {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("system_temas")
      .select("drive_contratacao_folder_id")
      .eq("id", temaId)
      .maybeSingle();
    const daTema = (data as { drive_contratacao_folder_id?: string | null } | null)
      ?.drive_contratacao_folder_id;
    if (daTema) ids.push(daTema);
  }

  // 2º — as pastas dentro dos tipos e os vínculos `kind='procuracao'`. Continuam
  // valendo: tema ainda não migrado, ou tipo com contrato próprio. É união, não
  // troca — trocar deixaria sem procuração quem ainda não migrou.
  ids.push(...tipos.map((t) => t.drive_contrato_folder_id).filter((id): id is string => !!id));
  ids.push(...legado.map((f) => f.drive_folder_id));

  return [...new Set(ids)];
}

/**
 * De onde vêm os modelos de DOCUMENTO DE CASO de um tipo: JUDICIAL +
 * ADMINISTRATIVO, juntos.
 *
 * Owner (06/09): "por lógica eu já estou procurando por um documento de caso" —
 * a escolha entre procuração e documento de caso já foi feita na primeira tela, e
 * uma tela só para separar judicial de administrativo era um clique sem decisão.
 *
 * Juntar as duas (em vez de mostrar só a administrativa) evita que um modelo
 * colocado em JUDICIAL fique invisível no sistema.
 */
export function pastasDeDocumentoDeCaso(folder: ServiceTypeFolder | undefined): string[] {
  if (!folder) return [];
  const ids = [folder.drive_judicial_folder_id, folder.drive_administrativo_folder_id].filter(
    (id): id is string => !!id,
  );
  // Tipo antigo, ainda sem a estrutura: os modelos estão soltos na pasta dele.
  if (!ids.length) return [folder.drive_folder_id];
  return ids;
}

// S2-04 — as pastas de TIPO, que é o que o sync de modelos precisa varrer.
//
// Varrer o TIPO (e não cada categoria uma a uma) é de propósito: o
// `template-sync` desce um nível de subpasta e grava `source_folder_id` = id da
// subpasta, que é exatamente o id de JUDICIAL / CONTRATO E PROCURAÇÃO /
// ADMINISTRATIVO. Assim o seletor por categoria funciona sem tocar no sync.
//
// Varrer o TIPO tem um segundo efeito, desejado: arquivo solto na raiz do tipo
// (subido antes de o upload passar a exigir categoria) também é registrado, com
// `source_folder_id` = a própria pasta do tipo. Ele não some do sistema.
export async function listPastasModelos(): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("system_service_type_folders")
    .select("drive_folder_id")
    .eq("kind", "caso")
    .is("deleted_at", null);
  if (error) throw new ServiceTypeFoldersError(error.message, 500);
  const ids = ((data ?? []) as Array<{ drive_folder_id: string }>).map((r) => r.drive_folder_id);

  // As procurações moram no nível do TEMA desde 06/09. Sem varrer essas pastas,
  // o modelo de procuração subiria para o Drive e nunca apareceria no popup —
  // exatamente o defeito que a mudança de estrutura veio consertar.
  const { data: temas } = await sb
    .from("system_temas")
    .select("drive_contratacao_folder_id")
    .not("drive_contratacao_folder_id", "is", null)
    .is("deleted_at", null);
  for (const t of (temas ?? []) as Array<{ drive_contratacao_folder_id: string | null }>) {
    if (t.drive_contratacao_folder_id) ids.push(t.drive_contratacao_folder_id);
  }

  return [...new Set(ids)];
}

// Desvincula (soft-delete) uma pasta da categoria. NÃO apaga a pasta no Drive.
export async function unlinkFolder(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_service_type_folders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new ServiceTypeFoldersError(error.message, 500);
  return { ok: true as const, id };
}
