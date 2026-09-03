// Server-only — S6-01 (reunião 02/09): CASOS PRIORITÁRIOS da controladoria.
//
// Thiago (desenhos 42-50): "Vamos adicionar uma nova página vinculada a
// controladoria, em que teremos uma listagem e algumas informações de processos
// prioritários. (…) Se o caso prioritário possui mais de 1 processo judicial /
// recurso, todos eles são listados aqui 1 por 1 (compartilham a mesma informação
// de movimentação administrativa, mas a data de movimento judicial é individual
// por processo judicial vinculado). (…) Como data de última movimentação
// administrativa, vamos considerar a data de última mudança de etapa do caso.
// (…) Todas as informações já existem vinculadas ao caso, apenas temos que
// espelhar aqui. E apenas aparecem aqui aqueles marcados como casos prioritários."
//
// Decisão do owner (D5, 03/09): "marcado como prioritário" = a URGÊNCIA que já
// existe no caso (`distribution_urgency` in 'prioritario'|'urgente'), a mesma que
// o motor usa para calcular prazo. Sem campo novo.
//
// Custo: 4 consultas fixas (casos → processos → responsáveis → nomes), sem N+1.

import { getSupabaseAdmin } from "./supabase/server";
import { getVisibleCaseIds } from "./visibility";

/** Uma LINHA da tela: caso + (opcionalmente) um processo judicial dele. */
export type PrioritarioRow = {
  /** id do caso — a linha inteira navega para ele. */
  case_id: string;
  case_code: string;
  case_name: string | null;
  client_id: string | null;
  client_name: string | null;
  tema_nome: string | null;
  urgencia: "prioritario" | "urgente";
  etapa_op: string | null;
  /** Última mudança de ETAPA do caso = "última movimentação administrativa". */
  ultima_mov_administrativa: string | null;
  /** Nulo quando o caso não tem processo judicial (administrativo puro). */
  numero_processo: string | null;
  tribunal: string | null;
  /** Última movimentação DAQUELE processo (individual, não do caso). */
  ultima_mov_judicial: string | null;
  responsaveis: string[];
};

const URGENCIAS = ["prioritario", "urgente"] as const;

export async function listCasosPrioritarios(
  viewerUserId: string | null | undefined,
): Promise<PrioritarioRow[]> {
  const sb = getSupabaseAdmin();

  // Visibilidade por usuário (advogados/prestador veem só os casos deles).
  const visiveis = await getVisibleCaseIds(viewerUserId);
  if (visiveis && visiveis.length === 0) return [];

  let q = sb
    .from("system_cases")
    .select(
      "id, case_code, caso_pasta_nome, client_id, tema_id, distribution_urgency, macrostatus_op, status_changed_at",
    )
    .in("distribution_urgency", URGENCIAS as unknown as string[])
    .is("deleted_at", null);
  if (visiveis) q = q.in("id", visiveis);

  const { data: casos, error } = await q;
  if (error) throw new Error(`Falha ao listar casos prioritários: ${error.message}`);
  if (!casos || casos.length === 0) return [];

  const caseIds = casos.map((c) => c.id as string);
  const clientIds = [
    ...new Set(casos.map((c) => (c as { client_id?: string | null }).client_id).filter(Boolean)),
  ] as string[];
  const temaIds = [
    ...new Set(casos.map((c) => (c as { tema_id?: string | null }).tema_id).filter(Boolean)),
  ] as string[];

  // Uma consulta por dimensão — nada dentro de laço.
  //
  // QA (03/09): os processos vêm de DUAS tabelas, e cada uma tem metade do que a
  // tela precisa:
  //   • `system_case_projuris_processos` — é o VÍNCULO caso↔processo (211 linhas,
  //     todas com `numero_cnj`). É daqui que sai o número do processo e a
  //     quantidade de processos do caso.
  //   • `system_case_judicial_processos` — é o ESPELHO do detalhe do ProJuris
  //     (4 linhas hoje; `numero_processo` está NULL em todas). É daqui que sai a
  //     `data_ultima_modificacao`, que é a "última movimentação judicial".
  // A primeira versão lia só a segunda e a coluna Processo saía vazia — o teste
  // contra o banco pegou. As duas são casadas por
  // `codigo_processo` ↔ `projuris_codigo_processo`.
  const [vinculosRes, detalhesRes, clientesRes, temasRes, respRes] = await Promise.all([
    sb
      .from("system_case_projuris_processos")
      .select("case_id, codigo_processo, numero_cnj, principal")
      .in("case_id", caseIds),
    sb
      .from("system_case_judicial_processos")
      .select("case_id, projuris_codigo_processo, tribunal, data_ultima_modificacao")
      .in("case_id", caseIds),
    clientIds.length
      ? sb.from("system_clients").select("id, full_name").in("id", clientIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
    temaIds.length
      ? sb.from("system_temas").select("id, name").in("id", temaIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    sb.from("system_case_responsaveis_active").select("case_id, user_id").in("case_id", caseIds),
  ]);

  // Nomes dos responsáveis (uma consulta só, depois de saber quais usuários).
  const userIds = [
    ...new Set(
      ((respRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id).filter(Boolean),
    ),
  ];
  const { data: usuarios } = userIds.length
    ? await sb.from("system_users").select("id, full_name").in("id", userIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };

  const nomeUsuario = new Map(
    ((usuarios ?? []) as Array<{ id: string; full_name: string | null }>).map((u) => [
      u.id,
      u.full_name ?? "—",
    ]),
  );
  const respPorCaso = new Map<string, string[]>();
  for (const r of (respRes.data ?? []) as Array<{ case_id: string; user_id: string }>) {
    const arr = respPorCaso.get(r.case_id) ?? [];
    const nome = nomeUsuario.get(r.user_id);
    if (nome) arr.push(nome);
    respPorCaso.set(r.case_id, arr);
  }

  const nomeCliente = new Map(
    ((clientesRes.data ?? []) as Array<{ id: string; full_name: string }>).map((c) => [
      c.id,
      c.full_name,
    ]),
  );
  const nomeTema = new Map(
    ((temasRes.data ?? []) as Array<{ id: string; name: string }>).map((t) => [t.id, t.name]),
  );

  // O ProJuris devolve o CNJ com sufixo (" (CNJ)"); a tela mostra só o número.
  const limpaCnj = (v: string | null): string | null =>
    v ? v.replace(/\s*\(CNJ\)\s*$/i, "").trim() || null : null;

  // UNIÃO das duas tabelas por código do ProJuris. Um processo pode existir em
  // apenas uma delas — o teste contra o banco mostrou os dois casos:
  //   • vínculo sem espelho (211 vínculos × 4 espelhos) → sem data de movimentação;
  //   • espelho sem vínculo (o caso INADIMPLENCIAHV-2026-0422) → sem CNJ.
  // Perder qualquer um dos dois esconderia processo da controladoria, que é
  // justamente o que esta tela existe para evitar.
  type ProcInfo = {
    numero_processo: string | null;
    tribunal: string | null;
    data: string | null;
  };
  const porCasoECodigo = new Map<string, Map<string, ProcInfo>>();
  const put = (caseId: string, codigo: string, patch: Partial<ProcInfo>) => {
    const doCaso = porCasoECodigo.get(caseId) ?? new Map<string, ProcInfo>();
    const atual = doCaso.get(codigo) ?? { numero_processo: null, tribunal: null, data: null };
    doCaso.set(codigo, {
      numero_processo: patch.numero_processo ?? atual.numero_processo,
      tribunal: patch.tribunal ?? atual.tribunal,
      data: patch.data ?? atual.data,
    });
    porCasoECodigo.set(caseId, doCaso);
  };

  for (const v of (vinculosRes.data ?? []) as Array<{
    case_id: string;
    codigo_processo: number | string | null;
    numero_cnj: string | null;
  }>) {
    // `codigo_processo` é bigint aqui e texto na outra tabela — normalizar.
    const codigo = v.codigo_processo != null ? String(v.codigo_processo) : `sem-codigo-${v.case_id}`;
    put(v.case_id, codigo, { numero_processo: limpaCnj(v.numero_cnj) });
  }

  for (const d of (detalhesRes.data ?? []) as Array<{
    case_id: string;
    projuris_codigo_processo: string | null;
    tribunal: string | null;
    data_ultima_modificacao: string | null;
  }>) {
    const codigo = d.projuris_codigo_processo
      ? String(d.projuris_codigo_processo)
      : `sem-codigo-${d.case_id}`;
    put(d.case_id, codigo, { tribunal: d.tribunal, data: d.data_ultima_modificacao });
  }

  const processosPorCaso = new Map<string, ProcInfo[]>();
  for (const [caseId, doCaso] of porCasoECodigo) {
    processosPorCaso.set(caseId, [...doCaso.values()]);
  }

  const linhas: PrioritarioRow[] = [];
  for (const c of casos as Array<Record<string, unknown>>) {
    const caseId = c.id as string;
    const base = {
      case_id: caseId,
      case_code: c.case_code as string,
      case_name: (c.caso_pasta_nome as string | null) ?? null,
      client_id: (c.client_id as string | null) ?? null,
      client_name: c.client_id ? (nomeCliente.get(c.client_id as string) ?? null) : null,
      tema_nome: c.tema_id ? (nomeTema.get(c.tema_id as string) ?? null) : null,
      urgencia: c.distribution_urgency as "prioritario" | "urgente",
      etapa_op: (c.macrostatus_op as string | null) ?? null,
      // Última mudança de etapa do caso — é o que o Thiago chamou de
      // "movimentação administrativa".
      ultima_mov_administrativa: (c.status_changed_at as string | null) ?? null,
      responsaveis: respPorCaso.get(caseId) ?? [],
    };

    const processos = processosPorCaso.get(caseId) ?? [];
    if (processos.length === 0) {
      // Caso administrativo puro: uma linha, sem coluna judicial.
      linhas.push({ ...base, numero_processo: null, tribunal: null, ultima_mov_judicial: null });
      continue;
    }
    // Um caso com 3 processos vira 3 linhas — pedido explícito do Thiago.
    for (const p of processos) {
      linhas.push({
        ...base,
        numero_processo: p.numero_processo,
        tribunal: p.tribunal,
        ultima_mov_judicial: p.data,
      });
    }
  }

  // Ordena pelo MAIS PARADO: a pergunta que a tela responde é "o que está
  // esquecido?". Sem data de movimentação nenhuma = mais parado ainda (vai antes).
  const maisRecente = (r: PrioritarioRow): number => {
    const datas = [r.ultima_mov_judicial, r.ultima_mov_administrativa]
      .filter(Boolean)
      .map((d) => new Date(d as string).getTime());
    return datas.length ? Math.max(...datas) : 0;
  };
  linhas.sort((a, b) => maisRecente(a) - maisRecente(b));

  return linhas;
}
