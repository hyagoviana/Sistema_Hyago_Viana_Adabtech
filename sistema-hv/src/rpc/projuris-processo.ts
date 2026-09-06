// RPC (server-only) — CADASTRAR PROCESSO JUDICIAL no ProJuris a partir do caso.
//
// Pergunta do Thiago (31/08): "é possível cadastrarmos novo processo judicial no
// ProJuris, direto pela API através do SHV?". Este é o caminho da resposta.
//
// Três server functions, na ordem em que a tela as usa:
//
//   listarApoioProcessoFn — as listas do formulário (área, justiça, situação, e as
//                           árvores de classe e assunto do CNJ). Só leitura.
//   previewProcessoFn     — monta o corpo e NÃO envia. É o que permite ver
//                           exatamente o que vai antes de gravar na base de
//                           terceiro. Sempre disponível.
//   criarProcessoFn       — ESCREVE. Cria o processo lá e, quando dá certo, já
//                           VINCULA o código ao caso daqui — senão o processo
//                           nasce órfão e alguém teria que amarrar na mão.
//
// Gate: requireModule("operacional", "edit") — mesma régua de quem mexe no caso.
// A trava de banco `projuris_writeback_ativo` continua valendo por baixo (o
// serviço a consulta), então desligar a escrita no ProJuris desliga isto também.

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  getAssuntoGeral,
  resolverAssuntoDoCaso,
  setAssuntoGeral,
  setTemaAssunto,
} from "@/lib/projuris/assunto-tema";
import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  carregarListasDeApoio,
  criarProcessoJudicial,
  dadosDoCasoParaProcesso,
  montarProcessoJudicial,
  type ListasApoioProcesso,
  type NovoProcessoJudicial,
} from "@/lib/projuris/criar-processo";

export type { ListasApoioProcesso, OpcaoProcesso } from "@/lib/projuris/criar-processo";

async function handle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err instanceof Error ? new Error(err.message) : new Error(String(err));
  }
}

/** Campos que a tela manda. Tudo opcional menos o caso e o nome da pasta. */
const entradaSchema = z.object({
  caseId: z.string().uuid(),
  numeroCnj: z.string().optional().default(""),
  nomePasta: z.string().min(1),
  assunto: z.string().min(1),
  codigoJustica: z.number().int().positive().nullish(),
  codigoArea: z.number().int().positive().nullish(),
  codigoClasseCnj: z.number().int().positive().nullish(),
  codigoAssuntoCnj: z.number().int().positive().nullish(),
  codigoSituacao: z.number().int().positive().nullish(),
  dataDistribuicao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  valorAcao: z.number().nullish(),
  segredoJustica: z.boolean().optional().default(false),
});

function paraEntrada(d: z.infer<typeof entradaSchema>): NovoProcessoJudicial {
  return {
    numeroCnj: d.numeroCnj ?? "",
    nomePasta: d.nomePasta,
    assunto: d.assunto,
    codigoJustica: d.codigoJustica ?? null,
    codigoArea: d.codigoArea ?? null,
    codigoClasseCnj: d.codigoClasseCnj ?? null,
    codigoAssuntoCnj: d.codigoAssuntoCnj ?? null,
    codigoSituacao: d.codigoSituacao ?? null,
    dataDistribuicao: d.dataDistribuicao ?? null,
    valorAcao: d.valorAcao ?? null,
    segredoJustica: d.segredoJustica ?? false,
  };
}

/** Listas do formulário. Vêm do ProJuris, então nada precisa ser digitado à mão. */
export const listarApoioProcessoFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async (): Promise<ListasApoioProcesso> => {
    await requireModule("operacional", "view");
    return carregarListasDeApoio();
  }),
);

/** O que o SHV já sabe preencher sozinho a partir do caso. */
export const sugestaoProcessoFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("operacional", "view");
      const d = await dadosDoCasoParaProcesso(data.caseId);
      // S2-03 AC3 — a tela mostra de ONDE veio o assunto ("do tema X" ou "geral")
      // para quem cria o processo saber o que vai ser gravado no ProJuris antes
      // de enviar, e poder trocar pontualmente.
      const origem = await resolverAssuntoDoCaso(data.caseId);
      return {
        nomePasta: d.nomePasta ?? "",
        assunto: d.assunto ?? "",
        numeroCnj: d.numeroCnj ?? "",
        assuntoOrigem: origem?.origem ?? null,
        assuntoTemaNome: origem?.temaNome ?? null,
      };
    }),
  );

/** Monta o corpo e devolve SEM enviar — a conferência antes de gravar. */
export const previewProcessoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => entradaSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("operacional", "view");
      const entrada = paraEntrada(data);
      entrada.codigoExterno = await codigoExternoDoCaso(data.caseId);
      // Vai como TEXTO: o corpo é um objeto livre (o contrato do ProJuris), e o
      // transporte das server functions exige tipo serializável declarado.
      return { corpoJson: JSON.stringify(montarProcessoJudicial(entrada), null, 2) };
    }),
  );

/** `codigo_externo` do lado de lá = o código do caso daqui. É o que amarra os dois. */
async function codigoExternoDoCaso(caseId: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("system_cases").select("case_code").eq("id", caseId).maybeSingle();
  return (data as { case_code?: string } | null)?.case_code ?? null;
}

/**
 * ESCREVE no ProJuris. Cria o processo e, dando certo, vincula o código ao caso.
 *
 * O vínculo vem junto de propósito: um processo criado e não amarrado é pior do
 * que nenhum — some do radar do SHV e reaparece como duplicata na próxima vez.
 */
export const criarProcessoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => entradaSchema.parse(d))
  .handler(async ({ data }) =>
    handle(async () => {
      const { id: userId } = await requireModule("operacional", "edit");
      const entrada = paraEntrada(data);
      entrada.codigoExterno = await codigoExternoDoCaso(data.caseId);

      // S2-03 AC1.3 — sem assunto resolvível, BLOQUEIA. O comportamento antigo
      // era cair no código do caso, e era isso que criava um assunto novo no
      // ProJuris a cada processo. Mensagem diz onde resolver.
      if (!entrada.assunto?.trim()) {
        setResponseStatus(422);
        throw new Error(
          "Este caso não tem assunto do ProJuris. Defina o assunto do tema em " +
            "Configurações › Temas › Integrações, ou o assunto geral na configuração " +
            "da Distribuição.",
        );
      }

      const r = await criarProcessoJudicial(entrada);
      if (!r.enviado || !r.codigo) {
        return {
          ok: false as const,
          motivo: r.motivo ?? "não enviado",
          corpoJson: JSON.stringify(r.corpo, null, 2),
        };
      }

      // Vincula o processo recém-criado ao caso e deixa rastro na linha do tempo.
      const sb = getSupabaseAdmin();
      await sb
        .from("system_cases")
        .update({
          // A coluna é numérica; o ProJuris devolve o código como texto.
          projuris_codigo_processo: Number(r.codigo),
          ...(entrada.numeroCnj ? { projuris_numero_processo: entrada.numeroCnj } : {}),
        })
        .eq("id", data.caseId);

      const { data: caso } = await sb
        .from("system_cases")
        .select("organization_id")
        .eq("id", data.caseId)
        .maybeSingle();
      if (caso) {
        await sb.from("system_case_events").insert({
          case_id: data.caseId,
          organization_id: (caso as { organization_id: string }).organization_id,
          action: "projuris_processo_criado",
          diff: { codigo_processo: r.codigo, nome_pasta: entrada.nomePasta },
          triggered_by: userId,
        });
      }

      return { ok: true as const, codigo: r.codigo, motivo: "", corpoJson: "" };
    }),
  );

// ---------------------------------------------------------------------------
// S2-02 — vínculo tema ↔ assunto do ProJuris (aba Integrações do tema)
// ---------------------------------------------------------------------------
//
// Thiago (resposta B1): o de-para é preenchido À MÃO, tema a tema — "facilita
// conforme formos criando/importando ou próximos temas, fica melhor que repassar
// a tabela agora e ter que repetir a cada próximo tema".
//
// Gate: módulo Sistema, nível Configurar — é configuração da organização, não
// operação de caso.

export const getAssuntoGeralProjurisFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(async () => {
    await requireModule("sistema", "view");
    return getAssuntoGeral();
  }),
);

export const setAssuntoGeralProjurisFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().max(80).nullish(),
        nome: z.string().max(200).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("sistema", "configure");
      return setAssuntoGeral(data);
    }),
  );

export const setTemaAssuntoProjurisFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        temaId: z.string().uuid(),
        id: z.string().max(80).nullish(),
        nome: z.string().max(200).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    handle(async () => {
      await requireModule("sistema", "configure");
      return setTemaAssunto(data.temaId, data);
    }),
  );
