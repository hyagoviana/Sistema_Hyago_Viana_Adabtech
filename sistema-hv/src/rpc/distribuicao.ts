// RPC (server-only, Node) — Sincronizacao SOB DEMANDA do Motor de Distribuicao.
//
// Dispara o MESMO motor puro do cron (engine/motor.distributeBatch) a partir de
// um botao na tela, sem depender da Edge Function / pg_cron. Fluxo (espelha o
// harness supabase/functions/projuris-sync/scripts/run-distribuicao-dryrun.ts):
//
//   auth OAuth2 no ProJuris (src/lib/projuris/client) -> POST /intimacao/consulta
//   -> por processo: GET /processo/{cod} (assunto=tema) + GET
//   /processo/{cod}/tarefa/consulta-multi-modulo (tarefas abertas) -> le
//   mappings/executores/calendario do Supabase (service role) -> buildBatchInput
//   -> distributeBatch -> grava em system_distribution_results (writeback_pending
//   = true, so as distribuidas — a coluna executor_id e NOT NULL/FK) +
//   system_distribution_batch_logs (is_simulation = true).
//
// REGRA CRITICA: ZERO writeback ao ProJuris. So LEITURA no ProJuris; ESCRITA
// apenas nas 2 tabelas acima do nosso banco. Idempotente por data: apaga os
// results da (distribution_date + org) antes de reinserir (re-sync limpo).

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ProjurisClient } from "@/lib/projuris/client";
import { distributeBatch } from "@/lib/distribuicao/engine/motor";
import { buildBatchInput } from "@/lib/distribuicao/engine/transformer";
import type {
  Task,
  Process,
  Executor,
  CalendarDay,
  PreferenceHistory,
  QueueState,
} from "@/lib/distribuicao/engine/types";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Helpers de data (puros, ISO YYYY-MM-DD)
// ---------------------------------------------------------------------------
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
/** epoch-ms | dd/MM/yyyy | ISO -> YYYY-MM-DD | null */
function msToIso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") return new Date(v).toISOString().slice(0, 10);
  if (typeof v === "string") {
    const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    if (v.includes("T")) return v.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  }
  return null;
}
/** Encontra o 1o array (em profundidade) num payload de forma desconhecida. */
function firstArrayDeep(obj: unknown): unknown[] {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === "object") {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      if (Array.isArray(val)) return val;
      if (val && typeof val === "object") {
        const inner = firstArrayDeep(val);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Resumo retornado ao front
// ---------------------------------------------------------------------------
export interface SyncSummary {
  batchDate: string;
  totalTasks: number;
  distributed: number;
  blocked: number;
  byExecutor: Array<{ executorId: string; name: string; tasks: number; points: number }>;
  alerts: Array<{ code: string; count: number }>;
}

// ---------------------------------------------------------------------------
// Nucleo (server-only): roda o motor e grava resultados. NAO exporta segredos.
// ---------------------------------------------------------------------------
async function runSync(distributionDate: string, windowDays: number): Promise<SyncSummary> {
  const supabase = getSupabaseAdmin();

  // ---- Credenciais ProJuris (client_id = api_cliente_codigo COMPLETO) ----
  const client = new ProjurisClient({
    clientId: process.env.PROJURIS_API_CLIENTE_CODIGO ?? "",
    clientSecret: process.env.PROJURIS_CLIENT_SECRET ?? "",
    username: process.env.PROJURIS_USERNAME || undefined,
    dominio: process.env.PROJURIS_DOMINIO || undefined,
    password: process.env.PROJURIS_PASSWORD || undefined,
    authUrl: process.env.PROJURIS_AUTH_URL || undefined,
    baseUrl: process.env.PROJURIS_BASE_URL || undefined,
  });

  // ---- 1) Auth OAuth2 (grant password; tenta variantes de username) ----
  await client.authenticateTryingVariants();

  // ---- 2) Intimacoes -> processos candidatos ----
  const start = addDaysIso(distributionDate, -windowDays);
  const intResp = await client.projurisPostConsulta<{
    totalRegistros?: number;
    intimacaoConsultaWs?: Array<Record<string, unknown>>;
  }>("intimacao/consulta", {
    tipoDataFiltroIntimacao: "DATA_DA_DISPONIBILIZACAO",
    dataPeriodoInicial: start,
    dataPeriodoFinal: distributionDate,
    dadosOrigemFiltro: true,
  });
  const intimacoes = intResp.intimacaoConsultaWs ?? [];
  const procCodes = [
    ...new Set(
      intimacoes.map((x) => x.codigoProcesso).filter((v): v is number => typeof v === "number"),
    ),
  ];

  // ---- 3) Por processo: assunto (tema) + tarefas abertas (multi-modulo) ----
  const rawTasks: Array<{
    task_id: string;
    process_id: string;
    tipo_codigo: string;
    prazo_fatal: string | null;
    prazo_interno: string | null;
  }> = [];
  const processAssunto = new Map<string, string>();

  const MAX_PROC = Number(process.env.DISTRIBUICAO_MAX_PROCESSOS ?? "150") || 150;
  const chosen = procCodes.slice(0, MAX_PROC);

  for (const code of chosen) {
    const pid = String(code);
    try {
      const proc = await client.projurisGet<Record<string, unknown>>(`processo/${pid}`);
      const assunto = String(proc.assunto ?? proc.nomeAssunto ?? "");
      processAssunto.set(pid, assunto);
    } catch {
      // Processo ilegivel -> pula (sem tema nao ha o que distribuir).
      continue;
    }
    try {
      const raw = await client.projurisGet<unknown>(`processo/${pid}/tarefa/consulta-multi-modulo`);
      const arr = firstArrayDeep(raw) as Array<Record<string, unknown>>;
      for (const t of arr) {
        // So tarefas ABERTAS (nao concluidas).
        if (t.flagSituacaoConcluida === true) continue;
        const tipoCodigo = String(t.codigoTarefaTipo ?? "");
        if (!tipoCodigo) continue;
        rawTasks.push({
          task_id: String(t.codigoTarefa ?? `${pid}-${tipoCodigo}`),
          process_id: pid,
          tipo_codigo: tipoCodigo,
          prazo_fatal: msToIso(t.dataLimite),
          prazo_interno: msToIso(t.dataConclusaoPrevista ?? t.dataLimite),
        });
      }
    } catch {
      // Falha nas tarefas de um processo nao derruba o batch.
    }
  }

  // ---- 4) Mapeamentos + executores + calendario (Supabase, service role) ----
  const [ttRes, thRes, exRes, usersRes, calRes] = await Promise.all([
    supabase
      .from("system_task_type_mapping")
      .select(
        "projuris_tipo_codigo, motor_task_type_id, points, complexity_level, temporal_level, exclusive_executor_id",
      )
      .eq("organization_id", ORG_ID)
      .eq("active", true),
    supabase
      .from("system_theme_mapping")
      .select(
        "projuris_tema_codigo, motor_theme_id, multiplier, temporal_level, exclusive_executor_id",
      )
      .eq("organization_id", ORG_ID)
      .eq("active", true),
    supabase
      .from("system_projuris_executor_mapping")
      .select(
        "executor_id, active, weight, eligible_complex, authorized_task_types, authorized_themes",
      )
      .eq("organization_id", ORG_ID)
      .eq("active", true),
    supabase.from("system_users").select("id, full_name, status").eq("organization_id", ORG_ID),
    supabase
      .from("system_distribution_calendar")
      .select("date, block_type, executor_id")
      .eq("organization_id", ORG_ID),
  ]);

  type TaskTypeRow = {
    projuris_tipo_codigo: string;
    motor_task_type_id: string;
    points: number;
    complexity_level: number;
    temporal_level: number;
    exclusive_executor_id: string | null;
  };
  const ttMap = new Map<string, TaskTypeRow>();
  for (const r of (ttRes.data ?? []) as TaskTypeRow[]) ttMap.set(r.projuris_tipo_codigo, r);

  type ThemeRow = {
    projuris_tema_codigo: string;
    motor_theme_id: string;
    multiplier: number;
    temporal_level: number;
    exclusive_executor_id: string | null;
  };
  const thMap = new Map<string, ThemeRow>();
  for (const r of (thRes.data ?? []) as ThemeRow[]) thMap.set(r.projuris_tema_codigo, r);

  type ExecRow = {
    executor_id: string;
    active: boolean;
    weight: number;
    eligible_complex: boolean;
    authorized_task_types: string[] | null;
    authorized_themes: string[] | null;
  };
  const execRows = (exRes.data ?? []) as ExecRow[];
  const execMappingIds = new Set(execRows.map((r) => r.executor_id));
  const execById = new Map(execRows.map((r) => [r.executor_id, r]));

  type UserRow = { id: string; full_name: string; status: string };
  const users = (usersRes.data ?? []) as UserRow[];
  const nameById = new Map(users.map((u) => [u.id, u.full_name]));

  const executors: Executor[] = users
    .filter((u) => execMappingIds.has(u.id) && u.status === "ACTIVE")
    .map((u) => {
      const m = execById.get(u.id);
      return {
        executor_id: u.id,
        active: true,
        general_weight: m?.weight ?? 1,
        complex_eligible: m?.eligible_complex ?? true,
        authorized_task_types: m?.authorized_task_types ?? [],
        authorized_themes: m?.authorized_themes ?? [],
      };
    });

  if (executors.length === 0) {
    throw new AuthError("Nenhum executor mapeado/ativo — impossivel distribuir.", 422);
  }

  // Calendario: seg-sex operacional + bloqueios (geral desliga o dia; individual
  // por executor) do banco, janela [dia .. +60].
  const generalBlocks = new Set<string>();
  const indivBlocks = new Map<string, string[]>(); // date -> executor_ids
  for (const c of (calRes.data ?? []) as Array<{
    date: string;
    block_type: string;
    executor_id: string | null;
  }>) {
    if (c.block_type === "general") generalBlocks.add(c.date);
    else if (c.block_type === "individual" && c.executor_id) {
      const arr = indivBlocks.get(c.date) ?? [];
      arr.push(c.executor_id);
      indivBlocks.set(c.date, arr);
    }
  }
  const calendar: CalendarDay[] = [];
  {
    const from = distributionDate;
    const to = addDaysIso(distributionDate, 60);
    let cur = from;
    while (cur <= to) {
      const [y, m, d] = cur.split("-").map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const isWeekday = dow >= 1 && dow <= 5;
      calendar.push({
        date: cur,
        globally_operational: isWeekday && !generalBlocks.has(cur),
        initial_team_points: 0,
        blocked_executor_ids: indivBlocks.get(cur) ?? [],
      });
      cur = addDaysIso(cur, 1);
    }
  }

  // ---- 5) Transformar em Task[]/Process[] ----
  const tasks: Task[] = [];
  const processMap = new Map<string, Process>();
  let order = 0;
  for (const rt of rawTasks) {
    const tt = ttMap.get(rt.tipo_codigo);
    if (!tt) continue; // tipo nao mapeado
    const assunto = processAssunto.get(rt.process_id) ?? "";
    const th = thMap.get(assunto);
    if (!th) continue; // tema nao mapeado

    if (!processMap.has(rt.process_id)) {
      processMap.set(rt.process_id, {
        process_id: rt.process_id,
        theme_id: th.motor_theme_id,
        collective: false,
        complexity_level: 0,
        temporal_level: 0,
        directed_executor_id: null,
      });
    }
    tasks.push({
      task_id: rt.task_id,
      process_id: rt.process_id,
      task_type_id: tt.motor_task_type_id,
      theme_id: th.motor_theme_id,
      task_type_points: tt.points > 0 ? tt.points : 1,
      theme_multiplier: th.multiplier > 0 ? th.multiplier : 1,
      task_type_complexity_level: tt.complexity_level as 0 | 1 | 2,
      task_type_temporal_level: tt.temporal_level as 0 | 1 | 2,
      task_override_complexity_level: 0,
      task_override_temporal_level: 0,
      theme_complexity_level: 0,
      theme_temporal_level: th.temporal_level as 0 | 1 | 2,
      theme_exclusive_executor_id: th.exclusive_executor_id ?? null,
      task_type_exclusive_executor_id: tt.exclusive_executor_id ?? null,
      fatal_date: rt.prazo_fatal ?? "9999-12-31",
      internal_limit_date: rt.prazo_interno ?? rt.prazo_fatal ?? "9999-12-31",
      input_order: ++order,
    });
  }

  const queueState: QueueState = {
    general_balances: {},
    complex_balances: {},
    rotating_order: executors.map((e) => e.executor_id),
  };
  const preferenceHistory: PreferenceHistory[] = [];

  const batchInput = buildBatchInput(
    crypto.randomUUID(),
    distributionDate,
    "HIGH_PRODUCTION",
    10,
    tasks,
    [...processMap.values()],
    executors,
    calendar,
    preferenceHistory,
    queueState,
  );

  // ---- 6) MOTOR ----
  const startedAt = new Date().toISOString();
  const output = distributeBatch(batchInput);

  // ---- 7) Persistir (idempotente por data) ----
  // Apaga results da data+org antes de reinserir (re-sync limpo). Requer o
  // ajuste no trigger de imutabilidade (migration 20260805000003) permitindo
  // DELETE. Se ainda nao aplicado, o delete falha (trigger append-only) e o
  // erro sobe com instrucao clara.
  const delRes = await supabase
    .from("system_distribution_results")
    .delete()
    .eq("organization_id", ORG_ID)
    .eq("distribution_date", distributionDate);
  if (delRes.error) {
    throw new AuthError(
      `Falha ao limpar distribuicao anterior de ${distributionDate}: ${delRes.error.message}. ` +
        "Aplique a migration 20260805000003 (permitir DELETE em system_distribution_results).",
      500,
    );
  }

  // So as DISTRIBUIDAS (nao-bloqueadas) vao pra results — executor_id e NOT NULL
  // e FK -> system_users; bloqueadas nao tem executor. As bloqueadas ficam
  // refletidas no batch_log (failed) e nos alertas.
  const rows = output.task_results
    .filter((r) => !r.blocked && r.executor_id)
    .map((r) => ({
      organization_id: ORG_ID,
      task_id: r.task_id,
      process_id: r.process_id,
      distribution_date: r.distribution_date,
      final_points: r.final_points,
      flow: r.flow,
      base_date: r.base_date,
      applicable_limit: r.applicable_limit,
      preferred_date: r.preferred_date,
      final_date: r.final_date,
      executor_id: r.executor_id,
      preference_applied: r.preference_applied,
      alerts: r.alerts,
      writeback_pending: true, // calculado; SEM escrita no ProJuris ainda
      blocked: false,
      raw_data: null,
    }));

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from("system_distribution_results").insert(chunk);
    if (error) throw new AuthError(`insert de resultados falhou: ${error.message}`, 500);
  }

  // batch_log (is_simulation=true — sob demanda, sem writeback). Insere direto
  // como 'completed' (a coluna is_simulation marca a origem manual).
  const alertsGenerated = Object.values(output.alerts_summary).reduce((s, n) => s + n, 0);
  const { error: logErr } = await supabase.from("system_distribution_batch_logs").insert({
    organization_id: ORG_ID,
    batch_date: distributionDate,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    status: "completed",
    total_tasks: output.metrics.total_tasks,
    successful: output.metrics.successful,
    failed: output.metrics.failed,
    alerts_generated: alertsGenerated,
    metrics: {
      duration_ms: output.metrics.duration_ms,
      window_days: windowDays,
      intimacoes: intimacoes.length,
      processos: chosen.length,
      tarefas_mapeadas: tasks.length,
      source: "on_demand_sync",
    },
    is_simulation: true,
  });
  if (logErr) throw new AuthError(`insert do batch_log falhou: ${logErr.message}`, 500);

  // ---- 8) Resumo ----
  const byExecMap = new Map<string, { tasks: number; points: number }>();
  for (const r of output.task_results) {
    if (r.blocked || !r.executor_id) continue;
    const cur = byExecMap.get(r.executor_id) ?? { tasks: 0, points: 0 };
    cur.tasks += 1;
    cur.points += r.final_points;
    byExecMap.set(r.executor_id, cur);
  }
  const byExecutor = [...byExecMap.entries()]
    .map(([executorId, v]) => ({
      executorId,
      name: nameById.get(executorId) ?? executorId,
      tasks: v.tasks,
      points: Math.round(v.points * 100) / 100,
    }))
    .sort((a, b) => b.points - a.points);

  const alerts = Object.entries(output.alerts_summary)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);

  return {
    batchDate: distributionDate,
    totalTasks: output.metrics.total_tasks,
    distributed: output.metrics.successful,
    blocked: output.metrics.failed,
    byExecutor,
    alerts,
  };
}

// ---------------------------------------------------------------------------
// Server function exposta ao front
// ---------------------------------------------------------------------------
export const sincronizarDistribuicaoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        distributionDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "distributionDate deve ser YYYY-MM-DD")
          .optional(),
        windowDays: z.number().int().min(0).max(30).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }): Promise<SyncSummary> => {
    try {
      // Gate: mesma regua da rota (modulo controladoria, acao edit).
      await requireModule("controladoria", "edit");
      const distributionDate = data.distributionDate ?? ymd(new Date());
      const windowDays = data.windowDays ?? 3;
      return await runSync(distributionDate, windowDays);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err instanceof Error ? new Error(err.message) : new Error(String(err));
    }
  });
