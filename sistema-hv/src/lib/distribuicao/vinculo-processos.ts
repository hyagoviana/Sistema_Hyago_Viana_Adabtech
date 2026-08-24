// Vínculo entre o CASO do SHV e o PROCESSO do ProJuris.
//
// É o gargalo do espelho de tarefas: sem esse vínculo o sistema não sabe em que
// processo criar a tarefa lá, e a distribuição fica só dentro do SHV.
//
// Por que isto é uma TELA e não um script:
//
// Medimos os 233 casos sem vínculo em 24/08. O casamento automático por nome
// resolve pouco — 17 casos. O grosso (114) é cliente com VÁRIOS processos ativos,
// onde só quem conhece o caso sabe qual é o certo; e 84 são clientes que nem
// existem no ProJuris. Ou seja: adivinhar erra mais do que acerta, e um vínculo
// errado manda a tarefa para o processo de outra pessoa.
//
// Então o sistema faz o que sabe fazer — achar os candidatos e ordená-los — e a
// escolha fica com quem tem como saber.
//
// Sobre buscar os candidatos: nenhum dos filtros de pessoa do
// `v2/processo/consulta` funciona de fato (testados em 24/08:
// `codigoPessoaEnvolvido`, `codigosPessoaEnvolvido`, `nomeEnvolvido` e
// `filtroGeral` devolvem a lista inteira ou vazia). Por isso carregamos a
// listagem completa uma vez e cruzamos aqui — com cache, porque são ~6.700
// processos e a tela é usada em rajada.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildProjurisClientFromConfig, ORG_ID } from "@/lib/distribuicao/sync-core";
import { AuthError } from "@/lib/supabase/auth-guard";

export interface ProcessoCandidato {
  codigo: number;
  /** PRO.0005235 — é o que a pessoa reconhece na tela do ProJuris. */
  identificador: string | null;
  numeroCnj: string | null;
  assunto: string | null;
  nomeCliente: string;
  encerrado: boolean;
  /** O assunto do processo tem palavra em comum com o tema do caso. */
  combinaComTema?: boolean;
}

export interface CasoSemProcesso {
  id: string;
  caseCode: string | null;
  clienteNome: string;
  clienteCpf: string | null;
  temaNome: string | null;
  /** Processos do mesmo cliente, ativos primeiro. Vazio = cliente não está lá. */
  candidatos: ProcessoCandidato[];
}

/** Compara nomes ignorando acento, caixa e pontuação. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Palavras sem valor de comparação — aparecem em quase todo tema e assunto, e
 * fariam tudo "combinar" com tudo.
 */
const VAZIAS = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "A", "O", "EM", "HV", "POR"]);

/**
 * O assunto do processo fala do mesmo que o tema do caso?
 *
 * Comparação por palavra inteira, e de propósito frouxa: o objetivo não é decidir
 * — é subir os prováveis para o topo da lista. Foi o que a amostra de 24/08
 * mostrou valer a pena: tema "Indenização Mais Médicos" × assunto
 * "INDENIZAÇÃO PMMB" reduz quatro candidatos a um.
 */
function combina(tema: string, assunto: string | null): boolean {
  if (!tema || !assunto) return false;
  const palavras = (t: string) =>
    new Set(
      norm(t)
        .split(" ")
        .filter((w) => w.length > 2 && !VAZIAS.has(w)),
    );
  const a = palavras(tema);
  const b = palavras(assunto);
  for (const w of a) if (b.has(w)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Cache da listagem de processos.
//
// São ~6.700 processos em 34 páginas de 200 — uma carga pesada para a API, que
// responde 503 quando recebe várias seguidas (visto em 24/08). Por isso:
//
//   · 15 minutos de cache, com botão "Atualizar do ProJuris" para quem acabou de
//     cadastrar um processo lá e quer vê-lo agora;
//   · uma pausa curta entre páginas, para não parecer enxurrada;
//   · uma segunda tentativa quando a página falha, antes de desistir.
//
// E, se a carga falhar no meio, o cache anterior é devolvido em vez de um erro:
// uma lista de 15 minutos atrás é infinitamente mais útil que uma tela vermelha.
// ---------------------------------------------------------------------------
const CACHE_MS = 15 * 60 * 1000;
const PAUSA_ENTRE_PAGINAS_MS = 120;
let cache: { em: number; porCliente: Map<string, ProcessoCandidato[]> } | null = null;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function carregarProcessos(): Promise<Map<string, ProcessoCandidato[]>> {
  if (cache && Date.now() - cache.em < CACHE_MS) return cache.porCliente;

  const client = await buildProjurisClientFromConfig(getSupabaseAdmin());
  await client.authenticateTryingVariants();

  const buscaPagina = async (pagina: number) => {
    try {
      return await client.projurisPostConsulta<{
        processoConsultaResumoWs?: Array<Record<string, unknown>>;
      }>("v2/processo/consulta", {}, { pagina, "quan-registros": 200 });
    } catch {
      // Uma segunda chance com um respiro maior — 503 aqui costuma ser passageiro.
      await espera(1500);
      return client.projurisPostConsulta<{
        processoConsultaResumoWs?: Array<Record<string, unknown>>;
      }>("v2/processo/consulta", {}, { pagina, "quan-registros": 200 });
    }
  };

  const porCliente = new Map<string, ProcessoCandidato[]>();
  for (let pagina = 1; pagina <= 60; pagina++) {
    let r: { processoConsultaResumoWs?: Array<Record<string, unknown>> };
    try {
      r = await buscaPagina(pagina);
    } catch (err) {
      // Falhou de vez. Se temos algo guardado, vale mais que um erro na cara.
      if (cache) return cache.porCliente;
      throw new AuthError(
        `O ProJuris não respondeu: ${err instanceof Error ? err.message.slice(0, 160) : "erro"}`,
        424,
      );
    }
    const lote = r.processoConsultaResumoWs ?? [];
    if (!lote.length) break;

    for (const p of lote) {
      const nomeCliente = typeof p.nomeCliente === "string" ? p.nomeCliente.trim() : "";
      if (!nomeCliente) continue;
      const chave = norm(nomeCliente);
      const item: ProcessoCandidato = {
        codigo: Number(p.codigoProcesso),
        identificador: typeof p.identificador === "string" ? p.identificador : null,
        numeroCnj: typeof p.numeroProcesso === "string" ? p.numeroProcesso : null,
        assunto: typeof p.assunto === "string" ? p.assunto : null,
        nomeCliente,
        encerrado: p.flEncerrado === true,
      };
      porCliente.set(chave, [...(porCliente.get(chave) ?? []), item]);
    }
    if (lote.length < 200) break;
    await espera(PAUSA_ENTRE_PAGINAS_MS);
  }

  // Ativos primeiro: é o que a pessoa quase sempre procura.
  for (const lista of porCliente.values())
    lista.sort((a, b) => Number(a.encerrado) - Number(b.encerrado));

  cache = { em: Date.now(), porCliente };
  return porCliente;
}

/** Descarta o cache — usado pelo botão "Atualizar do ProJuris" da tela. */
export function esquecerProcessos(): void {
  cache = null;
}

/**
 * Casos ativos que ainda não apontam para um processo, com os candidatos de cada
 * um já ao lado.
 */
export async function listCasosSemProcesso(): Promise<CasoSemProcesso[]> {
  const sb = getSupabaseAdmin();

  const { data: casos } = await sb
    .from("system_cases")
    .select("id, case_code, client_id, tema_id, created_at")
    .eq("organization_id", ORG_ID)
    .is("deleted_at", null)
    .is("projuris_codigo_processo", null)
    .order("created_at", { ascending: false });

  if (!casos?.length) return [];

  const idsClientes = [...new Set(casos.map((c) => c.client_id).filter(Boolean))] as string[];
  const { data: clientes } = await sb
    .from("system_clients")
    .select("id, full_name, cpf_cnpj")
    .in("id", idsClientes);
  const cliente = new Map((clientes ?? []).map((c) => [c.id, c]));

  const { data: temas } = await sb.from("system_temas").select("id, name");
  const tema = new Map((temas ?? []).map((t) => [t.id, t.name ?? ""]));

  const porCliente = await carregarProcessos();

  return casos.map((c) => {
    const cli = c.client_id ? cliente.get(c.client_id) : null;
    const nome = cli?.full_name ?? "";
    const temaNome = c.tema_id ? (tema.get(c.tema_id) ?? null) : null;

    // Ordem de leitura da tela: o que combina com o tema primeiro, ativos antes
    // de encerrados. Quem confere quase sempre quer o primeiro da lista.
    const candidatos = (porCliente.get(norm(nome)) ?? [])
      .map((p) => ({ ...p, combinaComTema: combina(temaNome ?? "", p.assunto) }))
      .sort(
        (a, b) =>
          Number(b.combinaComTema) - Number(a.combinaComTema) ||
          Number(a.encerrado) - Number(b.encerrado),
      );

    return {
      id: c.id,
      caseCode: c.case_code,
      clienteNome: nome,
      clienteCpf: cli?.cpf_cnpj ?? null,
      temaNome,
      candidatos,
    };
  });
}

/**
 * Aponta um caso para um processo do ProJuris.
 *
 * O código é conferido contra a listagem antes de gravar: um número digitado
 * errado viraria uma tarefa criada no processo de outra pessoa.
 */
export async function vincularCasoAoProcesso(
  casoId: string,
  codigoProcesso: number,
): Promise<{ identificador: string | null; numeroCnj: string | null }> {
  const porCliente = await carregarProcessos();
  let achado: ProcessoCandidato | null = null;
  for (const lista of porCliente.values()) {
    const hit = lista.find((p) => p.codigo === codigoProcesso);
    if (hit) {
      achado = hit;
      break;
    }
  }
  if (!achado)
    throw new AuthError("Esse processo não foi encontrado no ProJuris. Atualize a lista.", 422);

  const { error } = await getSupabaseAdmin()
    .from("system_cases")
    .update({
      projuris_codigo_processo: achado.codigo,
      projuris_numero_processo: achado.numeroCnj,
    } as never)
    .eq("id", casoId)
    .eq("organization_id", ORG_ID);

  if (error) throw new AuthError(`Não foi possível salvar o vínculo: ${error.message}`, 500);

  return { identificador: achado.identificador, numeroCnj: achado.numeroCnj };
}

/** Desfaz o vínculo — para quando alguém apontar para o processo errado. */
export async function desvincularCaso(casoId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("system_cases")
    .update({ projuris_codigo_processo: null, projuris_numero_processo: null } as never)
    .eq("id", casoId)
    .eq("organization_id", ORG_ID);
  if (error) throw new AuthError(`Não foi possível desfazer o vínculo: ${error.message}`, 500);
}
