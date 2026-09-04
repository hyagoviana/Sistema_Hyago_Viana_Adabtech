// S1-04 — RESPONSÁVEL DIRECIONADO: do caso para o motor.
//
// Thiago (desenho do menu de edição do caso): "Temos que conferir se o motor de
// distribuição está buscando corretamente se existe um responsável exclusivo para
// o caso que está rodando no motor (fora da regra geral). Há essa indicação na
// programação dele. O local que ele encontra essa informação, é aqui no caso."
//
// Ele estava certo: a precedência existe no `flow-selector`
// (process.directed_executor_id > tema exclusivo > tipo de tarefa exclusivo), mas
// quem montava o payload gravava `directed_executor_id: null` fixo — o nível 1
// nunca era exercido.
//
// Regra do responsável (Thiago, 04/09): "vamos manter que cada caso pode ter
// apenas 1 responsável para fins das funções do SHV". Verificado no banco: nenhum
// caso tem mais de um hoje. Se algum dia tiver (dado antigo, importação), o
// desempate é DETERMINÍSTICO — o vínculo mais antigo — em vez de "qualquer um".
//
// Só direciona para quem o motor consegue usar: se a pessoa não está no pool de
// executores elegíveis, a tarefa volta para a regra geral por pontuação, em vez
// de ficar presa num responsável que o motor não distribui.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Mapas prontos para consulta O(1) na montagem do lote. */
export type ResponsaveisDirecionados = {
  /** case_id → user_id do responsável elegível. */
  porCaso: Map<string, string>;
  /** `projuris_codigo_processo` (string) → user_id, para o caminho do ProJuris. */
  porCodigoProjuris: Map<string, string>;
  /** Casos com responsável que NÃO é executor elegível — vão para o relatório. */
  ignoradosPorElegibilidade: number;
};

/**
 * Carrega o responsável de cada caso, filtrado pelo pool de executores elegíveis.
 *
 * @param elegiveis ids que o motor pode usar (mesma régua do pool: mapeado, ativo
 *                  e peticionante). Passe o conjunto já calculado pelo chamador —
 *                  não duplicamos a régua aqui.
 */
export async function carregarResponsaveisDirecionados(
  sb: SupabaseClient,
  elegiveis: Set<string>,
): Promise<ResponsaveisDirecionados> {
  const porCaso = new Map<string, string>();
  const porCodigoProjuris = new Map<string, string>();
  let ignoradosPorElegibilidade = 0;

  // `created_at` ascendente: se um caso tiver mais de um vínculo (não deveria,
  // pela regra de 1 responsável), o primeiro cadastrado ganha — determinístico.
  const { data: vinculos, error } = await sb
    .from("system_case_responsaveis_active")
    .select("case_id, user_id, created_at")
    .order("created_at", { ascending: true });
  if (error) return { porCaso, porCodigoProjuris, ignoradosPorElegibilidade };

  const primeiroPorCaso = new Map<string, string>();
  for (const v of (vinculos ?? []) as Array<{ case_id: string; user_id: string }>) {
    if (!primeiroPorCaso.has(v.case_id)) primeiroPorCaso.set(v.case_id, v.user_id);
  }

  for (const [caseId, userId] of primeiroPorCaso) {
    if (!elegiveis.has(userId)) {
      ignoradosPorElegibilidade++;
      continue;
    }
    porCaso.set(caseId, userId);
  }

  if (porCaso.size === 0) return { porCaso, porCodigoProjuris, ignoradosPorElegibilidade };

  // De-para caso → código do processo no ProJuris (é por ele que o motor
  // identifica o "processo" no caminho da sincronização).
  const { data: casos } = await sb
    .from("system_cases")
    .select("id, projuris_codigo_processo")
    .in("id", [...porCaso.keys()])
    .is("deleted_at", null);

  for (const c of (casos ?? []) as Array<{
    id: string;
    projuris_codigo_processo: number | string | null;
  }>) {
    if (c.projuris_codigo_processo == null) continue;
    const user = porCaso.get(c.id);
    if (user) porCodigoProjuris.set(String(c.projuris_codigo_processo), user);
  }

  return { porCaso, porCodigoProjuris, ignoradosPorElegibilidade };
}
