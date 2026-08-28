// "Fazer lançamento" — leva de verdade para o ContaAzul a receita registrada no
// caso (FN2, 2026-08-28).
//
// O CONTEXTO. O Thiago: "o ContaAzul representa um ERP financeiro onde
// administramos o grosso dos recebíveis e a pagar do escritório. Teoricamente
// todos os nossos registros que envolvam valores vão obrigatoriamente passar pelo
// sistema." A FN1 fez o registro nascer no caso; aqui ele vira lançamento lá.
//
// TRÊS REGRAS QUE NÃO SE NEGOCIAM:
//
//  1. NADA VAI SEM ALGUÉM MANDAR. Esta função só roda quando a pessoa clica.
//     Não há gatilho automático.
//
//  2. NADA VAI DUAS VEZES. `contaazul_registro_id` preenchido = já foi; a função
//     devolve o que já existe em vez de criar outro. É a mesma trava do
//     `projuris_codigo_tarefa` no motor.
//
//  3. RESPOSTA NÃO É CONFIRMAÇÃO — LEITURA É. O endpoint responde **202 com um
//     protocolo**, não com o registro criado: o processamento é assíncrono. Somar
//     isso à lição de 27/08 com o ProJuris (que respondia 204 sem fazer nada) dá
//     uma regra só: depois de escrever, procurar o registro do outro lado. Só
//     então o lançamento vira "Lançado".
//
// O que NÃO fazemos aqui, por decisão do Thiago (28/08): escolher conta ou forma
// de pagamento por conta própria. "Depende do que o cliente tenha optado
// (pix/cartão/boleto), é algo negociado um a um" — então as duas coisas vêm
// preenchidas no lançamento, e a falta delas é impedimento, não palpite nosso.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  buscarContasAReceber,
  criarContaAReceber,
  type CAContaReceberInput,
} from "@/lib/contaazul/client";
import { syncClientToContaAzul } from "@/lib/contaazul/service";

export type ResultadoLancamento =
  | { lancado: true; registroId: string; jaEstava?: boolean }
  | { lancado: false; motivo: string };

const ORG = "00000000-0000-0000-0000-000000000001";

/** Centavos → reais, que é como o ContaAzul recebe valor. */
function reais(centavos: number): number {
  return Math.round(centavos) / 100;
}

/** `Date`/ISO → YYYY-MM-DD. */
function dia(v: string | Date): string {
  const d = typeof v === "string" ? new Date(v) : v;
  return d.toISOString().slice(0, 10);
}

export async function fazerLancamento(entryId: string): Promise<ResultadoLancamento> {
  const sb = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: e } = await (sb as any)
    .from("system_case_fin_entries")
    .select(
      "id, case_id, kind, descricao, valor_centavos, forma_pagamento, conta_financeira, data_vencimento, categoria_id, contaazul_registro_id",
    )
    .eq("id", entryId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!e) return { lancado: false, motivo: "lançamento não encontrado" };

  // Regra 2 — já foi.
  if (e.contaazul_registro_id) {
    return { lancado: true, registroId: e.contaazul_registro_id, jaEstava: true };
  }

  // Só receita por enquanto: contas a PAGAR usam outro endpoint e ainda não
  // foram desenhadas com o Thiago.
  if (e.kind !== "RECEITA") {
    return { lancado: false, motivo: "por enquanto só receita vai para o ContaAzul" };
  }

  // ── o que precisa estar preenchido ────────────────────────────────────────
  if (!e.conta_financeira) {
    return { lancado: false, motivo: "escolha a conta que vai receber antes de lançar" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cat } = await (sb as any)
    .from("system_fin_categorias")
    .select("codigo, nome, contaazul_id")
    .eq("id", e.categoria_id)
    .maybeSingle();

  if (!cat?.contaazul_id) {
    return {
      lancado: false,
      motivo: `a categoria ${cat?.codigo ?? "?"} ainda não existe no ContaAzul — cadastre lá e sincronize`,
    };
  }

  // ── o cliente precisa existir lá ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: caso } = await (sb as any)
    .from("system_cases")
    .select("id, client_id, tema_id")
    .eq("id", e.case_id)
    .maybeSingle();
  if (!caso?.client_id) return { lancado: false, motivo: "o caso não tem cliente" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cli } = await (sb as any)
    .from("system_clients")
    .select("id, full_name, contaazul_customer_id")
    .eq("id", caso.client_id)
    .maybeSingle();

  let contatoId = cli?.contaazul_customer_id as string | null;
  if (!contatoId) {
    // Cria o cliente lá na hora — é pré-requisito da conta a receber, e o
    // serviço de sync já existia desde a integração de cobrança.
    const r = await syncClientToContaAzul(caso.client_id).catch((err) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    }));
    if (!("contaazul_customer_id" in r) || !r.contaazul_customer_id) {
      return {
        lancado: false,
        motivo: `não consegui cadastrar o cliente no ContaAzul: ${"error" in r ? r.error : "motivo desconhecido"}`,
      };
    }
    contatoId = r.contaazul_customer_id as string;
  }

  // ── centro de custo vem do TEMA (config da FN1) ───────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tema } = await (sb as any)
    .from("system_temas")
    .select("contaazul_centro_custo_id")
    .eq("id", caso.tema_id)
    .maybeSingle();

  // ── parcelas ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parcelas } = await (sb as any)
    .from("system_case_fin_installments")
    .select("numero, data_vencimento, valor_centavos")
    .eq("entry_id", entryId)
    .order("numero");

  const lista = (parcelas ?? []) as Array<{
    numero: number;
    data_vencimento: string;
    valor_centavos: number;
  }>;

  const descricao = (e.descricao ?? "").trim() || `Honorários — ${cli?.full_name ?? "cliente"}`;

  // Sem parcelas cadastradas, o próprio lançamento é a parcela única.
  //
  // `valor_liquido` vai junto do `valor_bruto` de propósito: a API recusa a
  // parcela sem ele (aprendizado de 10/07, quando o sync quebrava com 400).
  // Como não há multa/juros/desconto no lançamento, os dois são iguais.
  const cru = lista.length
    ? lista.map((p) => ({
        venc: dia(p.data_vencimento),
        valor: reais(p.valor_centavos),
        n: p.numero,
      }))
    : [{ venc: dia(e.data_vencimento), valor: reais(e.valor_centavos), n: 1 }];

  const parcelasCA = cru.map((p) => ({
    descricao: cru.length > 1 ? `${descricao} (${p.n}/${cru.length})` : descricao,
    data_vencimento: p.venc,
    conta_financeira: e.conta_financeira as string,
    detalhe_valor: { valor_bruto: p.valor, valor_liquido: p.valor },
  }));

  const valorTotal = cru.reduce((s, p) => s + p.valor, 0);

  const payload: CAContaReceberInput = {
    // Competência = a primeira parcela. O regime do escritório é o do vencimento,
    // e sem este campo a API recusa.
    data_competencia: cru.map((p) => p.venc).sort()[0],
    valor: valorTotal,
    // A forma de pagamento é "negociada um a um" (Thiago, 28/08) e não tem campo
    // próprio na conta a receber — então viaja como observação, que é onde o
    // pessoal do financeiro lê.
    observacao: e.forma_pagamento ? `Forma de pagamento: ${e.forma_pagamento}` : "",
    descricao,
    contato: contatoId,
    conta_financeira: e.conta_financeira,
    rateio: [
      {
        id_categoria: cat.contaazul_id,
        valor: valorTotal,
        ...(tema?.contaazul_centro_custo_id
          ? {
              rateio_centro_custo: [
                { id_centro_custo: tema.contaazul_centro_custo_id, valor: valorTotal },
              ],
            }
          : {}),
      },
    ],
    condicao_pagamento: { parcelas: parcelasCA },
  };

  // ── ANTES de escrever: já existe? ─────────────────────────────────────────
  //
  // Esta busca é a trava que impede DUPLICAR honorário — e ela precisa vir antes
  // do POST, não depois. Três caminhos levam o mesmo lançamento a ser enviado
  // duas vezes: (a) o ContaAzul processa de forma ASSÍNCRONA, então a confirmação
  // logo após o envio pode não achar nada e a pessoa clica de novo; (b) a
  // gravação do id aqui pode falhar; (c) timeout com o registro já criado lá.
  // Em qualquer um deles, sem esta checagem nasceria um segundo registro — que
  // a API do ContaAzul não deixa apagar.
  const venc = cru.map((p) => p.venc).sort();
  const usados = await idsJaVinculados(entryId);
  const jaExiste = await procurarRegistro(
    descricao,
    venc[0],
    venc[venc.length - 1],
    valorTotal,
    usados,
  );
  if (jaExiste) {
    await marcar(entryId, jaExiste, null);
    return { lancado: true, registroId: jaExiste, jaEstava: true };
  }

  // ── escreve ───────────────────────────────────────────────────────────────
  let protocolo: string;
  try {
    const r = await criarContaAReceber(payload);
    protocolo = r.protocolo;
  } catch (err) {
    const motivo = (err instanceof Error ? err.message : String(err))
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 250);
    await marcar(entryId, null, motivo);
    return { lancado: false, motivo };
  }

  // ── Regra 3: confere lendo de volta ───────────────────────────────────────
  //
  // O 202 só diz "recebi", não "gravei". Procura o registro pela janela de
  // vencimento e pela descrição. Como o processamento é assíncrono, dá uma
  // segunda olhada depois de um instante antes de desistir.
  let achado = await procurarRegistro(
    descricao,
    venc[0],
    venc[venc.length - 1],
    valorTotal,
    usados,
  );
  if (!achado) {
    await new Promise((r) => setTimeout(r, 2500));
    achado = await procurarRegistro(descricao, venc[0], venc[venc.length - 1], valorTotal, usados);
  }

  if (!achado) {
    // Enviado mas ainda não visível. NÃO é erro de envio, e tentar de novo é
    // seguro: a busca no topo da função encontra o registro quando ele aparecer
    // e adota, em vez de criar outro.
    const motivo = `enviado (protocolo ${protocolo}), mas ainda não apareceu no ContaAzul — aguarde um instante e clique de novo para confirmar`;
    await marcar(entryId, null, motivo);
    return { lancado: false, motivo };
  }

  await marcar(entryId, achado, null);
  return { lancado: true, registroId: achado };
}

/**
 * Procura no ContaAzul o registro correspondente a este lançamento.
 *
 * Casa por descrição + valor dentro da janela de vencimento. O VALOR entra na
 * comparação de propósito: só a descrição colidiria entre dois lançamentos
 * legítimos do mesmo caso — dois "Entrada" para o mesmo cliente, vencendo no
 * mesmo dia, é situação real — e o segundo adotaria o registro do primeiro,
 * ficando eternamente sem ir ao ContaAzul.
 *
 * A segunda trava é o `excluirIds`: um registro que JÁ pertence a outro
 * lançamento do SHV nunca é adotado. Com as duas, ou achamos o registro certo,
 * ou não achamos nada — nunca o registro de outro.
 */
async function procurarRegistro(
  descricao: string,
  de: string,
  ate: string,
  valor: number,
  excluirIds: Set<string>,
): Promise<string | null> {
  try {
    const r = await buscarContasAReceber({
      data_vencimento_de: de,
      data_vencimento_ate: ate,
      tamanho_pagina: 200,
    });
    const itens = (r as { itens?: Array<Record<string, unknown>> }).itens ?? [];
    const alvo = itens.find((i) => {
      if (excluirIds.has(String(i.id))) return false;
      if (String(i.descricao ?? "").trim() !== descricao.trim()) return false;
      const v = Number(i.valor ?? 0);
      // tolerância de 1 centavo: arredondamento de ida e volta
      return !v || Math.abs(v - valor) < 0.011;
    });
    return alvo ? String(alvo.id) : null;
  } catch {
    return null;
  }
}

/** Ids do ContaAzul já usados por OUTROS lançamentos — não podem ser adotados. */
async function idsJaVinculados(exceto: string): Promise<Set<string>> {
  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("system_case_fin_entries")
    .select("contaazul_registro_id")
    .not("contaazul_registro_id", "is", null)
    .neq("id", exceto);
  return new Set(
    ((data ?? []) as Array<{ contaazul_registro_id: string }>).map((d) => d.contaazul_registro_id),
  );
}

async function marcar(entryId: string, registroId: string | null, erro: string | null) {
  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb as any)
    .from("system_case_fin_entries")
    .update({
      ...(registroId ? { contaazul_registro_id: registroId, status: "LANCADO" } : {}),
      contaazul_sync_at: erro ? null : new Date().toISOString(),
      contaazul_sync_error: erro,
    })
    .eq("id", entryId)
    .eq("organization_id", ORG)
    .then(
      () => {},
      () => {},
    );
}
