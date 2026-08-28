// De-para entre o catálogo do SHV e o do ContaAzul (2026-08-28).
//
// O QUE ISTO RESOLVE. A FN1 criou 30 categorias financeiras no SHV com o código
// do doc do Thiago (`4.02.01.01`, `10.01.02`…). Do outro lado, o ContaAzul tem as
// mesmas categorias com o código NO NOME: "4.02.01.01 - Entrada". Sem amarrar uma
// coisa na outra, o lançamento não sabe em qual categoria de lá registrar.
//
// A AMARRA É O CÓDIGO, não o nome. Nome muda ("Êxito" pode virar "Exito", ganhar
// acento, mudar de caixa) e a ligação quebraria em silêncio; o código é estável e
// foi justamente o que o Thiago padronizou para poder conferir na mão.
//
// O que fica de fora, por decisão dele (28/08):
//   · as categorias de nível 1 (4.01, 4.02, 10.01) NÃO recebem lançamento, mas
//     ficam no ContaAzul porque servem para relatório e visão no ERP;
//   · a conta financeira e a forma de pagamento NÃO têm padrão — "depende do que
//     o cliente tenha optado (pix/cartão/boleto), é negociado um a um". Por isso
//     este serviço só LISTA as opções; quem escolhe é a pessoa, no lançamento.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  listCategorias,
  listContasFinanceiras,
  listCentrosDeCusto,
  listServicos,
} from "@/lib/contaazul/client";

/** Extrai o código de "4.02.01.01 - Entrada" → "4.02.01.01". */
export function codigoDoNome(nome: string): string | null {
  const m = (nome ?? "").trim().match(/^([\d]+(?:\.[\d]+)*)\s*[-–]\s*/);
  return m ? m[1] : null;
}

export type ResultadoDePara = {
  vinculadas: number;
  jaVinculadas: number;
  desvinculadas: number;
  renomeadas: number;
  semParNoContaAzul: Array<{ codigo: string; nome: string }>;
  soNoContaAzul: Array<{ codigo: string; nome: string }>;
};

/**
 * Casa as categorias do SHV com as do ContaAzul pelo CÓDIGO e grava o id de lá.
 *
 * Idempotente: rodar de novo não duplica nem desfaz nada — só preenche o que
 * ainda falta e corrige o que mudou de id.
 *
 * NÃO cria categoria no ContaAzul. Criar plano de contas é decisão contábil do
 * escritório, e o Thiago já disse que vai "repassar para eles configurarem com o
 * nome exato". O nosso papel é ligar o que existe e apontar o que falta.
 */
export async function sincronizarCategorias(): Promise<ResultadoDePara> {
  const sb = getSupabaseAdmin();

  const { itens } = await listCategorias();
  const porCodigo = new Map<string, { id: string; nome: string }>();
  for (const c of itens ?? []) {
    const cod = codigoDoNome(String(c.nome ?? ""));
    if (cod) porCodigo.set(cod, { id: c.id, nome: String(c.nome ?? "") });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: locais } = await (sb as any)
    .from("system_fin_categorias")
    .select("id, codigo, nome, contaazul_id")
    .is("deleted_at", null);

  let vinculadas = 0;
  let jaVinculadas = 0;
  let desvinculadas = 0;
  let renomeadas = 0;
  const semPar: Array<{ codigo: string; nome: string }> = [];
  const usados = new Set<string>();

  // Todo id que existe HOJE do outro lado. Serve para detectar vínculo órfão:
  // categoria apagada ou renomeada no ContaAzul deixa o SHV apontando para o
  // nada, e o lançamento falharia na hora de usar. Aconteceu em 28/08, quando o
  // Thiago reorganizou o plano de contas e as 4 despesas 10.x sumiram de lá.
  const idsExistentes = new Set((itens ?? []).map((c) => c.id));

  for (const loc of (locais ?? []) as Array<{
    id: string;
    codigo: string;
    nome: string;
    contaazul_id: string | null;
  }>) {
    const alvo = porCodigo.get(loc.codigo);
    if (!alvo) {
      semPar.push({ codigo: loc.codigo, nome: loc.nome });
      // Perdeu o par: solta o vínculo velho em vez de deixar apontando para o
      // que não existe mais. Melhor um "falta cadastrar" claro do que um erro
      // obscuro no meio de um lançamento.
      if (loc.contaazul_id && !idsExistentes.has(loc.contaazul_id)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (sb as any)
          .from("system_fin_categorias")
          .update({ contaazul_id: null, updated_at: new Date().toISOString() })
          .eq("id", loc.id);
        desvinculadas++;
      }
      continue;
    }
    usados.add(loc.codigo);

    // O ContaAzul é a fonte da verdade do NOME: é lá que o escritório mantém o
    // plano de contas, e quem confere relatório lê o nome de lá. Quando o Thiago
    // renomeia (em 28/08, "Recuperados / Acordo / Renegociação" virou
    // "Renegociação / acordo"), o SHV acompanha em vez de mostrar o nome velho.
    // O código continua sendo a amarra — só a etiqueta segue o outro lado.
    const nomeLa = alvo.nome.replace(/^[\d.]+\s*[-–]\s*/, "").trim();
    const precisaRenomear = nomeLa && nomeLa !== loc.nome;

    if (loc.contaazul_id === alvo.id && !precisaRenomear) {
      jaVinculadas++;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any)
      .from("system_fin_categorias")
      .update({
        contaazul_id: alvo.id,
        ...(precisaRenomear ? { nome: nomeLa } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", loc.id);

    if (loc.contaazul_id === alvo.id) {
      jaVinculadas++;
      renomeadas++;
    } else {
      vinculadas++;
      if (precisaRenomear) renomeadas++;
    }
  }

  // O outro lado da conferência: código que existe lá e não existe aqui. Não é
  // erro — pode ser categoria contábil que o escritório usa e o SHV não lança —
  // mas mostrar evita a pergunta "cadê a minha categoria?".
  const soNoCA = [...porCodigo.entries()]
    .filter(([cod]) => !usados.has(cod))
    .map(([codigo, v]) => ({ codigo, nome: v.nome }));

  return {
    vinculadas,
    jaVinculadas,
    desvinculadas,
    renomeadas,
    semParNoContaAzul: semPar,
    soNoContaAzul: soNoCA,
  };
}

// ─── Listas para os seletores da tela ────────────────────────────────────────
//
// Tudo aqui é LEITURA. São as opções que a pessoa escolhe na hora do lançamento,
// já que não há padrão fixo.

export type OpcaoCatalogo = { id: string; nome: string; extra?: string };

/**
 * Contas de recebimento. A API já devolve só as ATIVAS — o painel mostra mais
 * porque inclui as desativadas (o Thiago estranhou o número: "de fato são apenas
 * 11"; pela API vêm 10, e a diferença é o "Cartão de Crédito", que é meio de
 * recebimento, não conta).
 */
export async function listarContasParaSelecao(): Promise<OpcaoCatalogo[]> {
  const { itens } = await listContasFinanceiras();
  return (itens ?? [])
    .filter((c) => c.ativo !== false)
    .map((c) => ({
      id: c.id,
      nome: String(c.nome ?? "(sem nome)"),
      extra: String(c.tipo ?? ""),
    }));
}

export async function listarCentrosDeCustoParaSelecao(): Promise<OpcaoCatalogo[]> {
  const { itens } = await listCentrosDeCusto();
  return (itens ?? [])
    .filter((c) => c.ativo !== false)
    .map((c) => ({ id: c.id, nome: String(c.nome ?? "(sem nome)"), extra: c.codigo ?? "" }));
}

export async function listarServicosParaSelecao(): Promise<OpcaoCatalogo[]> {
  const r = (await listServicos()) as unknown as {
    itens?: Array<Record<string, unknown>>;
  };
  const itens = Array.isArray(r) ? (r as Array<Record<string, unknown>>) : (r.itens ?? []);
  return itens.map((s) => ({
    id: String(s.id ?? ""),
    nome: String(s.nome ?? s.descricao ?? s.name ?? "(sem nome)"),
  }));
}
