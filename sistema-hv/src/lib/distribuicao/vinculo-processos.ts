// Vínculo entre o CASO do SHV e os PROCESSOS do ProJuris.
//
// O modelo vem da explicação do Thiago (24/08): o ProJuris só registra processo
// JUDICIAL; o caso é nosso e nem sempre vira processo (há os administrativos).
// Quando vira, pode virar MAIS DE UM — o principal, os relacionados e os
// incidentais, que são os recursos, cada um com número e andamento próprios.
//
// E a amarração é MANUAL, por decisão dele:
//
//   "a gente vai selecionar quais os processos do ProJuris a gente quer vincular
//    naquele caso (…) porque aí evita do sistema ter que ir e fazer essa
//    identificação (…) A gente vai resolver na mão."
//
// Então o sistema não decide nada aqui. Ele ajuda a achar: lista os processos do
// mesmo cliente, sobe ao topo os cujo assunto conversa com o tema do caso, e
// aceita busca direta pelo número quando quem confere já sabe qual quer.
//
// Sobre buscar os candidatos: nenhum dos filtros de pessoa do
// `v2/processo/consulta` funciona de fato (testados em 24/08:
// `codigoPessoaEnvolvido`, `codigosPessoaEnvolvido`, `nomeEnvolvido` e
// `filtroGeral` devolvem a lista inteira ou vazia). Por isso carregamos a
// listagem completa uma vez e cruzamos aqui.

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

/** Processo já vinculado a um caso. */
export interface ProcessoVinculado {
  codigo: number;
  identificador: string | null;
  numeroCnj: string | null;
  assunto: string | null;
  principal: boolean;
}

export interface CasoComProcessos {
  id: string;
  caseCode: string | null;
  clienteNome: string;
  clienteCpf: string | null;
  temaNome: string | null;
  /** O que já foi vinculado. Vazio = caso ainda sem processo. */
  vinculados: ProcessoVinculado[];
  /** Processos do mesmo cliente ainda não vinculados, prováveis primeiro. */
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

/** Só os dígitos — é como se compara número de processo sem depender da máscara. */
function digitos(s: string): string {
  return s.replace(/\D/g, "");
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
let cache: { em: number; todos: ProcessoCandidato[] } | null = null;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function carregarProcessos(): Promise<ProcessoCandidato[]> {
  if (cache && Date.now() - cache.em < CACHE_MS) return cache.todos;

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

  const todos: ProcessoCandidato[] = [];
  for (let pagina = 1; pagina <= 60; pagina++) {
    let r: { processoConsultaResumoWs?: Array<Record<string, unknown>> };
    try {
      r = await buscaPagina(pagina);
    } catch (err) {
      // Falhou de vez. Se temos algo guardado, vale mais que um erro na cara.
      if (cache) return cache.todos;
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
      todos.push({
        codigo: Number(p.codigoProcesso),
        identificador: typeof p.identificador === "string" ? p.identificador : null,
        numeroCnj: typeof p.numeroProcesso === "string" ? p.numeroProcesso : null,
        assunto: typeof p.assunto === "string" ? p.assunto : null,
        nomeCliente,
        encerrado: p.flEncerrado === true,
      });
    }
    if (lote.length < 200) break;
    await espera(PAUSA_ENTRE_PAGINAS_MS);
  }

  cache = { em: Date.now(), todos };
  return todos;
}

/** Descarta o cache — usado pelo botão "Atualizar do ProJuris" da tela. */
export function esquecerProcessos(): void {
  cache = null;
}

/** Agrupa a listagem por nome de cliente, com os ativos na frente. */
function agrupaPorCliente(todos: ProcessoCandidato[]): Map<string, ProcessoCandidato[]> {
  const m = new Map<string, ProcessoCandidato[]>();
  for (const p of todos) {
    const k = norm(p.nomeCliente);
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  for (const lista of m.values()) lista.sort((a, b) => Number(a.encerrado) - Number(b.encerrado));
  return m;
}

/**
 * Casos com seus processos: os já vinculados e os candidatos que sobram.
 *
 * `somentePendentes` deixa de fora quem já tem pelo menos um processo — é a
 * visão de trabalho da controladoria. Desligado, serve para revisar o que já foi
 * feito e acrescentar um recurso que apareceu depois.
 */
export async function listCasosComProcessos(somentePendentes = true): Promise<CasoComProcessos[]> {
  const sb = getSupabaseAdmin();

  const { data: casos } = await sb
    .from("system_cases")
    .select("id, case_code, client_id, tema_id, created_at")
    .eq("organization_id", ORG_ID)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (!casos?.length) return [];

  const { data: vinculos } = await sb
    .from("system_case_projuris_processos")
    .select("case_id, codigo_processo, identificador, numero_cnj, assunto, principal")
    .eq("organization_id", ORG_ID);

  const porCaso = new Map<string, ProcessoVinculado[]>();
  for (const v of vinculos ?? []) {
    const item: ProcessoVinculado = {
      codigo: Number(v.codigo_processo),
      identificador: v.identificador,
      numeroCnj: v.numero_cnj,
      assunto: v.assunto,
      principal: v.principal === true,
    };
    porCaso.set(v.case_id, [...(porCaso.get(v.case_id) ?? []), item]);
  }
  // Principal primeiro — é o que responde por "o processo do caso".
  for (const lista of porCaso.values())
    lista.sort((a, b) => Number(b.principal) - Number(a.principal));

  const alvo = somentePendentes ? casos.filter((c) => !porCaso.has(c.id)) : casos;
  if (!alvo.length) return [];

  const idsClientes = [...new Set(alvo.map((c) => c.client_id).filter(Boolean))] as string[];
  const { data: clientes } = await sb
    .from("system_clients")
    .select("id, full_name, cpf_cnpj")
    .in("id", idsClientes);
  const cliente = new Map((clientes ?? []).map((c) => [c.id, c]));

  const { data: temas } = await sb.from("system_temas").select("id, name");
  const tema = new Map((temas ?? []).map((t) => [t.id, t.name ?? ""]));

  const porCliente = agrupaPorCliente(await carregarProcessos());

  return alvo.map((c) => {
    const cli = c.client_id ? cliente.get(c.client_id) : null;
    const nome = cli?.full_name ?? "";
    const temaNome = c.tema_id ? (tema.get(c.tema_id) ?? null) : null;
    const jaVinculados = porCaso.get(c.id) ?? [];
    const jaTem = new Set(jaVinculados.map((v) => v.codigo));

    // Ordem de leitura: o que combina com o tema primeiro, ativos antes de
    // encerrados. Quem confere quase sempre quer o primeiro da lista.
    const candidatos = (porCliente.get(norm(nome)) ?? [])
      .filter((p) => !jaTem.has(p.codigo))
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
      vinculados: jaVinculados,
      candidatos,
    };
  });
}

/**
 * Procura um processo pelo número (CNJ ou identificador PRO.xxxx) ou pelo nome.
 *
 * É o caminho de quem já sabe qual processo quer — o Thiago pediu explicitamente:
 * "pode ser um botão aí a gente digita ali o número do processo judicial".
 * Também é a única saída quando o nome do cliente está grafado diferente dos dois
 * lados, que é o caso de boa parte da carteira.
 */
export async function buscarProcessoPorNumero(termo: string): Promise<ProcessoCandidato[]> {
  const alvo = termo.trim();
  if (alvo.length < 4) return [];

  const todos = await carregarProcessos();
  const soDigitos = digitos(alvo);
  const alvoUpper = alvo.toUpperCase();

  return todos
    .filter((p) => {
      if (soDigitos.length >= 4 && p.numeroCnj && digitos(p.numeroCnj).includes(soDigitos))
        return true;
      if (p.identificador && p.identificador.toUpperCase().includes(alvoUpper)) return true;
      // Ainda vale procurar por nome — quem digita "SILVA" espera achar.
      return norm(p.nomeCliente).includes(norm(alvo));
    })
    .slice(0, 30);
}

/**
 * Mantém `system_cases.projuris_codigo_processo` apontando para o principal.
 *
 * Essa coluna é o que motor, fila e espelho de tarefas leem. Ela não some — passa
 * a significar "o processo principal do caso", e esta função é o único lugar que
 * a escreve, para não haver duas verdades.
 */
async function sincronizarPrincipal(casoId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data: lista } = await sb
    .from("system_case_projuris_processos")
    .select("codigo_processo, numero_cnj, principal, created_at")
    .eq("case_id", casoId)
    .eq("organization_id", ORG_ID)
    .order("created_at", { ascending: true });

  // Sem principal marcado, o mais antigo assume — é o que foi vinculado primeiro,
  // e portanto o que a controladoria tratou como "o" processo do caso.
  const principal = (lista ?? []).find((l) => l.principal) ?? (lista ?? [])[0] ?? null;

  await sb
    .from("system_cases")
    .update({
      projuris_codigo_processo: principal ? Number(principal.codigo_processo) : null,
      projuris_numero_processo: principal?.numero_cnj ?? null,
    } as never)
    .eq("id", casoId)
    .eq("organization_id", ORG_ID);
}

/**
 * Vincula um processo ao caso. Pode ser chamado várias vezes — é assim que um
 * caso ganha o principal e depois os recursos.
 *
 * O código é conferido contra a listagem do ProJuris antes de gravar: um número
 * errado viraria uma tarefa criada no processo de outra pessoa.
 */
export async function vincularProcesso(
  casoId: string,
  codigoProcesso: number,
  opts?: { principal?: boolean; relacao?: string; userId?: string },
): Promise<ProcessoVinculado> {
  const todos = await carregarProcessos();
  const achado = todos.find((p) => p.codigo === codigoProcesso);
  if (!achado)
    throw new AuthError("Esse processo não foi encontrado no ProJuris. Atualize a lista.", 422);

  const sb = getSupabaseAdmin();

  // Primeiro processo do caso nasce principal — sem isso o caso ficaria com
  // processos mas sem nenhum respondendo por ele no motor.
  const { count } = await sb
    .from("system_case_projuris_processos")
    .select("*", { count: "exact", head: true })
    .eq("case_id", casoId)
    .eq("organization_id", ORG_ID);
  const principal = opts?.principal ?? (count ?? 0) === 0;

  if (principal) {
    // Só um principal por caso (o índice único garante; aqui abrimos espaço).
    await sb
      .from("system_case_projuris_processos")
      .update({ principal: false } as never)
      .eq("case_id", casoId)
      .eq("organization_id", ORG_ID);
  }

  const { error } = await sb.from("system_case_projuris_processos").insert({
    organization_id: ORG_ID,
    case_id: casoId,
    codigo_processo: achado.codigo,
    identificador: achado.identificador,
    numero_cnj: achado.numeroCnj,
    assunto: achado.assunto,
    principal,
    relacao: opts?.relacao ?? null,
    vinculado_por: opts?.userId ?? null,
  } as never);

  if (error) {
    if (error.code === "23505")
      throw new AuthError("Esse processo já está vinculado a este caso.", 409);
    throw new AuthError(`Não foi possível salvar o vínculo: ${error.message}`, 500);
  }

  await sincronizarPrincipal(casoId);

  return {
    codigo: achado.codigo,
    identificador: achado.identificador,
    numeroCnj: achado.numeroCnj,
    assunto: achado.assunto,
    principal,
  };
}

/** Tira um processo do caso — para quando alguém vincular o errado. */
export async function desvincularProcesso(casoId: string, codigoProcesso: number): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("system_case_projuris_processos")
    .delete()
    .eq("case_id", casoId)
    .eq("codigo_processo", codigoProcesso)
    .eq("organization_id", ORG_ID);
  if (error) throw new AuthError(`Não foi possível desfazer o vínculo: ${error.message}`, 500);
  await sincronizarPrincipal(casoId);
}

/** Elege qual dos processos do caso responde por ele no motor. */
export async function definirPrincipal(casoId: string, codigoProcesso: number): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb
    .from("system_case_projuris_processos")
    .update({ principal: false } as never)
    .eq("case_id", casoId)
    .eq("organization_id", ORG_ID);

  const { error } = await sb
    .from("system_case_projuris_processos")
    .update({ principal: true } as never)
    .eq("case_id", casoId)
    .eq("codigo_processo", codigoProcesso)
    .eq("organization_id", ORG_ID);
  if (error) throw new AuthError(`Não foi possível definir o principal: ${error.message}`, 500);

  await sincronizarPrincipal(casoId);
}
