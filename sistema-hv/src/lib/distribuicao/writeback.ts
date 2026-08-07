// Núcleo (server-only, Node) do WRITE-BACK ao ProJuris — Story H3 (RISCO ALTO).
//
// Grava no ProJuris a atribuição de responsável/tarefa que o motor calculou e um
// humano APROVOU (portão H2). Hoje o motor roda só simulação (writeback_pending=
// true / is_simulation=true); esta rotina é o único ponto que EFETIVA a escrita.
//
// ⚠️ REGRAS DURAS
//   1) DRY-RUN POR PADRÃO. Sem `confirm: true` explícito NÃO há PUT no ProJuris;
//      só montamos o plano e registramos as tentativas no log como 'pending'.
//   2) DEPENDÊNCIA DE H2. Só resultados com aprovação status='approved' na tabela
//      satélite system_distribution_approvals ficam elegíveis. Bloqueados e
//      não-aprovados/rejeitados JAMAIS entram.
//   3) IDEMPOTENTE / RETOMÁVEL via system_distribution_writeback_log: um result já
//      com log 'success' é pulado; 'pending'/'failed' são re-tentados. Sucesso
//      zera writeback_pending no result (append-only permite esse UPDATE).
//   4) IRREVERSÍVEL (R1). A efetivação muda o responsável no ProJuris de produção.
//      A UI DEVE exigir confirmação humana antes do 1º batch efetivo.
//   5) FALHA => ALT-SYNC-001 (código REAL do catálogo de alertas), warning,
//      retry pendente. Nunca derruba o batch inteiro por 1 item.
//
// SEGURANÇA: server-only. Usa service role (getSupabaseAdmin) + client ProJuris da
// config do banco (buildProjurisClientFromConfig). Nunca loga segredos.

import { AuthError } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PROJURIS_WRITEBACK_ROUTES, type ProjurisWriteBackItem } from "@/lib/projuris/client";
import { buildProjurisClientFromConfig, ORG_ID } from "@/lib/distribuicao/sync-core";

/** Código de alerta REAL emitido quando o write-back falha (ver engine/alerts). */
export const WRITEBACK_ALERT_CODE = "ALT-SYNC-001";

// ---------------------------------------------------------------------------
// Tipos de resumo
// ---------------------------------------------------------------------------

export interface WritebackItemPlan {
  resultId: string;
  taskId: string;
  executorId: string;
  projurisResponsavelId: string;
  /** 'add' (tarefa sem responsável) | 'replace' (troca de responsável). */
  operation: "add" | "replace";
  previousResponsavelId: string | null;
  /** Estado atual no log de write-back (null = ainda não tentado). */
  currentLogStatus: "pending" | "success" | "failed" | null;
}

export interface WritebackSummary {
  distributionDate: string;
  /** false = dry-run (nenhum PUT no ProJuris). true = efetivação real. */
  confirmed: boolean;
  /** Elegíveis = aprovados, não-bloqueados, ainda pendentes de write-back. */
  eligible: number;
  /** Já efetivados anteriormente (log 'success') — pulados. */
  alreadyDone: number;
  /** Efetivados NESTA execução (só quando confirmed=true). */
  effected: number;
  /** Falharam nesta execução (só quando confirmed=true) — ALT-SYNC-001. */
  failed: number;
  /** Sem mapeamento projuris_responsavel_id — não efetiváveis. */
  unmapped: number;
  alertGenerated: boolean;
  /** Plano por item (preview do dry-run e/ou resultado da efetivação). */
  plan: WritebackItemPlan[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ResultRow = {
  id: string;
  task_id: string;
  executor_id: string | null;
  blocked: boolean | null;
  writeback_pending: boolean | null;
  raw_data: { responsavel_atual?: string | null } | null;
};

type ApprovalRow = {
  distribution_result_id: string;
  status: "pending" | "approved" | "rejected";
  override_executor_id: string | null;
};

type WritebackLogRow = {
  id: string;
  distribution_result_id: string;
  status: string;
  attempt: number;
};

/**
 * Registra/atualiza a tentativa de write-back no log (idempotente por result).
 * O log é append-only (sem UNIQUE por result), então mantemos 1 linha "corrente"
 * por result: se já existe, UPDATE (status/attempt/error); senão INSERT.
 */
async function upsertWritebackLog(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  existing: WritebackLogRow | undefined,
  payload: {
    resultId: string;
    taskId: string;
    executorId: string;
    projurisResponsavelId: string;
    status: "pending" | "success" | "failed";
    error: string | null;
  },
): Promise<void> {
  if (existing) {
    const { error } = await supabase
      .from("system_distribution_writeback_log")
      .update({
        status: payload.status,
        error: payload.error,
        // attempt só incrementa quando estamos de fato tentando escrever.
        attempt: payload.status === "pending" ? existing.attempt : existing.attempt + 1,
      })
      .eq("id", existing.id);
    if (error) throw new AuthError(`Falha ao atualizar writeback_log: ${error.message}`, 500);
    return;
  }
  const { error } = await supabase.from("system_distribution_writeback_log").insert({
    organization_id: ORG_ID,
    distribution_result_id: payload.resultId,
    task_id: payload.taskId,
    executor_id: payload.executorId,
    projuris_responsavel_id: payload.projurisResponsavelId,
    error: payload.error,
    attempt: 1,
    status: payload.status,
  });
  if (error) throw new AuthError(`Falha ao inserir writeback_log: ${error.message}`, 500);
}

// ---------------------------------------------------------------------------
// Núcleo
// ---------------------------------------------------------------------------

/**
 * Executa (ou simula) o write-back das tarefas APROVADAS de uma data.
 *
 * @param distributionDate  data do batch (YYYY-MM-DD).
 * @param confirm           false (default) = DRY-RUN, nenhum PUT no ProJuris.
 *                          true = EFETIVAÇÃO REAL (irreversível, R1).
 *
 * Quando o endpoint real de escrita não puder ser validado com segurança pelo
 * owner, mantenha `PROJURIS_WRITEBACK_ENABLED` != '1' no ambiente: mesmo com
 * confirm=true a rotina PÁRA antes do PUT e registra 'pending' (segunda trava,
 * além do flag de confirmação da UI). Assim nada é escrito no ProJuris de teste
 * sem uma decisão explícita de infraestrutura.
 */
export async function runWriteback(
  distributionDate: string,
  confirm = false,
): Promise<WritebackSummary> {
  const supabase = getSupabaseAdmin();

  const summary: WritebackSummary = {
    distributionDate,
    confirmed: confirm,
    eligible: 0,
    alreadyDone: 0,
    effected: 0,
    failed: 0,
    unmapped: 0,
    alertGenerated: false,
    plan: [],
  };

  // ---- 1) Resultados da data (imutáveis) ----
  const { data: resultsData, error: rErr } = await supabase
    .from("system_distribution_results")
    .select("id, task_id, executor_id, blocked, writeback_pending, raw_data")
    .eq("organization_id", ORG_ID)
    .eq("distribution_date", distributionDate);
  if (rErr) throw new AuthError(`Falha ao ler resultados: ${rErr.message}`, 500);
  const results = (resultsData ?? []) as ResultRow[];
  if (results.length === 0) return summary;

  const resultIds = results.map((r) => r.id);

  // ---- 2) Portão H2: aprovações da data (só 'approved' é elegível) ----
  const { data: apprData, error: aErr } = await supabase
    .from("system_distribution_approvals")
    .select("distribution_result_id, status, override_executor_id")
    .eq("organization_id", ORG_ID)
    .in("distribution_result_id", resultIds);
  if (aErr) throw new AuthError(`Falha ao ler aprovações: ${aErr.message}`, 500);
  const apprByResult = new Map<string, ApprovalRow>();
  for (const a of (apprData ?? []) as ApprovalRow[]) {
    apprByResult.set(a.distribution_result_id, a);
  }

  // ---- 3) Log de write-back corrente por result (idempotência/retomada) ----
  const { data: logData, error: lErr } = await supabase
    .from("system_distribution_writeback_log")
    .select("id, distribution_result_id, status, attempt")
    .eq("organization_id", ORG_ID)
    .in("distribution_result_id", resultIds)
    .order("created_at", { ascending: false });
  if (lErr) throw new AuthError(`Falha ao ler writeback_log: ${lErr.message}`, 500);
  // Mantém a linha mais recente por result (ordenado desc acima).
  const logByResult = new Map<string, WritebackLogRow>();
  for (const l of (logData ?? []) as WritebackLogRow[]) {
    if (!logByResult.has(l.distribution_result_id)) logByResult.set(l.distribution_result_id, l);
  }

  // ---- 4) Mapa executor_id -> projuris_responsavel_id (destino da escrita) ----
  const { data: mapData, error: mErr } = await supabase
    .from("system_projuris_executor_mapping")
    .select("executor_id, projuris_responsavel_id, active")
    .eq("organization_id", ORG_ID)
    .eq("active", true);
  if (mErr) throw new AuthError(`Falha ao ler mapeamento de executores: ${mErr.message}`, 500);
  const projurisByExecutor = new Map<string, string>();
  for (const m of (mapData ?? []) as Array<{
    executor_id: string;
    projuris_responsavel_id: string;
  }>) {
    projurisByExecutor.set(m.executor_id, m.projuris_responsavel_id);
  }

  // ---- 5) Monta o PLANO (elegíveis = aprovados, não-bloqueados, pendentes) ----
  const executable: Array<{
    plan: WritebackItemPlan;
    result: ResultRow;
    log: WritebackLogRow | undefined;
  }> = [];

  for (const r of results) {
    if (r.blocked) continue;
    const appr = apprByResult.get(r.id);
    if (!appr || appr.status !== "approved") continue; // portão H2

    const log = logByResult.get(r.id);
    if (log?.status === "success") {
      // Já efetivado numa execução anterior — idempotente, pula.
      summary.alreadyDone += 1;
      continue;
    }

    summary.eligible += 1;

    // Executor efetivo: override manual (H2) tem precedência sobre o do motor.
    const effectiveExecutorId = appr.override_executor_id ?? r.executor_id ?? "";
    const projurisResp = projurisByExecutor.get(effectiveExecutorId);
    const previousResp = r.raw_data?.responsavel_atual ?? null;

    if (!projurisResp) {
      // Sem mapeamento -> não efetivável. Registra falha pendente (ALT-SYNC-001).
      summary.unmapped += 1;
      summary.alertGenerated = true;
      const plan: WritebackItemPlan = {
        resultId: r.id,
        taskId: r.task_id,
        executorId: effectiveExecutorId,
        projurisResponsavelId: "",
        operation: previousResp ? "replace" : "add",
        previousResponsavelId: previousResp,
        currentLogStatus: (log?.status as WritebackItemPlan["currentLogStatus"]) ?? null,
      };
      summary.plan.push(plan);
      await upsertWritebackLog(supabase, log, {
        resultId: r.id,
        taskId: r.task_id,
        executorId: effectiveExecutorId,
        projurisResponsavelId: "",
        status: "pending",
        error: "Executor sem mapeamento projuris_responsavel_id.",
      });
      continue;
    }

    const plan: WritebackItemPlan = {
      resultId: r.id,
      taskId: r.task_id,
      executorId: effectiveExecutorId,
      projurisResponsavelId: projurisResp,
      operation: previousResp && previousResp !== projurisResp ? "replace" : "add",
      previousResponsavelId: previousResp,
      currentLogStatus: (log?.status as WritebackItemPlan["currentLogStatus"]) ?? null,
    };
    summary.plan.push(plan);
    executable.push({ plan, result: r, log });
  }

  // ---- 6) DRY-RUN: registra tentativas como 'pending' e retorna o plano ----
  // Segunda trava de infra: mesmo com confirm=true, só efetiva se o ambiente
  // habilitar explicitamente o write-back real (validação com o owner).
  const infraEnabled = (process.env.PROJURIS_WRITEBACK_ENABLED ?? "").trim() === "1";
  const willEffect = confirm && infraEnabled;

  if (!willEffect) {
    // Marca cada elegível como 'pending' (retomável no próximo batch efetivo).
    for (const { plan, log } of executable) {
      await upsertWritebackLog(supabase, log, {
        resultId: plan.resultId,
        taskId: plan.taskId,
        executorId: plan.executorId,
        projurisResponsavelId: plan.projurisResponsavelId,
        status: "pending",
        error: null,
      });
    }
    // confirmed reflete a INTENÇÃO; se a infra travou, sinalizamos que não efetivou.
    summary.confirmed = false;
    return summary;
  }

  // ---- 7) EFETIVAÇÃO REAL (irreversível, R1) ----
  const client = await buildProjurisClientFromConfig(supabase);
  await client.authenticateTryingVariants();

  for (const { plan, log } of executable) {
    const item: ProjurisWriteBackItem = {
      codigoTarefa: plan.taskId,
      codigoResponsavel: plan.projurisResponsavelId,
      ...(plan.operation === "replace" && plan.previousResponsavelId
        ? { codigoResponsavelAnterior: plan.previousResponsavelId }
        : {}),
    };
    const route =
      plan.operation === "replace"
        ? PROJURIS_WRITEBACK_ROUTES.replaceResponsible
        : PROJURIS_WRITEBACK_ROUTES.addResponsible;

    try {
      // Um item por chamada mantém a idempotência fina por tarefa (o endpoint é
      // "em-lote", mas enviar 1 item preserva o rastreio 1:1 no log).
      await client.projurisPut(route, [item]);
      await upsertWritebackLog(supabase, log, {
        resultId: plan.resultId,
        taskId: plan.taskId,
        executorId: plan.executorId,
        projurisResponsavelId: plan.projurisResponsavelId,
        status: "success",
        error: null,
      });
      // Sucesso: zera writeback_pending no result (append-only permite este UPDATE).
      await supabase
        .from("system_distribution_results")
        .update({ writeback_pending: false })
        .eq("id", plan.resultId);
      summary.effected += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await upsertWritebackLog(supabase, log, {
        resultId: plan.resultId,
        taskId: plan.taskId,
        executorId: plan.executorId,
        projurisResponsavelId: plan.projurisResponsavelId,
        status: "failed",
        error: msg,
      });
      summary.failed += 1;
      summary.alertGenerated = true; // ALT-SYNC-001
    }
  }

  if (summary.failed > 0 || summary.unmapped > 0) {
    // ALT-SYNC-001 (warning, retry pendente) — apenas sinalização/observabilidade.
    console.warn(
      JSON.stringify({
        event: WRITEBACK_ALERT_CODE,
        severity: "warning",
        message: `Write-back: ${summary.failed} falha(s) + ${summary.unmapped} sem mapeamento. Retry pendente.`,
        distributionDate,
      }),
    );
  }

  return summary;
}
