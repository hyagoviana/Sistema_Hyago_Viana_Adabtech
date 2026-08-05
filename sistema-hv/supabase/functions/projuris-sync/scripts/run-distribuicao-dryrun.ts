/**
 * DRY-RUN REAL da distribuicao — usa o motor oficial (distributeBatch) sobre os
 * dados REAIS do ProJuris ADV. GRAVA em system_distribution_simulations.
 *
 * NAO faz writeback ao ProJuris (zero escrita externa). Somente:
 *   - LEITURA no ProJuris (auth OAuth2 + intimacao/consulta + processo + tarefas)
 *   - LEITURA de mapeamentos/executores/calendario no Supabase
 *   - ESCRITA apenas em system_distribution_simulations (dry-run permitido)
 *
 * Rodar (de dentro de sistema-hv/):
 *   npx --yes deno@2 run --allow-env --allow-net --allow-read \
 *     supabase/functions/projuris-sync/scripts/run-distribuicao-dryrun.ts [YYYY-MM-DD] [windowDays]
 *
 * Le credenciais do ambiente (injetadas via --env-file no wrapper, ver package
 * script / comando abaixo). Vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * PROJURIS_* (CLIENT_ID/SECRET/USERNAME/PASSWORD/AUTH_URL).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { ProjurisRestAdapter } from '../adapters/projuris-rest-adapter.ts';
import { distributeBatch } from '../engine/motor.ts';
import { buildBatchInput } from '../transformer/projuris-to-motor.ts';
import type {
  Task, Process, Executor, CalendarDay, PreferenceHistory, QueueState,
} from '../config/types.ts';

const ORG_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
function env(k: string, fallback = ''): string {
  return Deno.env.get(k) ?? fallback;
}

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function msToIso(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'number') return new Date(v).toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    if (v.includes('T')) return v.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  }
  return null;
}
function firstArrayDeep(obj: unknown): unknown[] {
  if (Array.isArray(obj)) return obj;
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object') { const inner = firstArrayDeep(v); if (inner.length) return inner; }
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const distributionDate = Deno.args[0] || ymd(new Date());
  const windowDays = Number(Deno.args[1] ?? 3) || 3;

  console.log('=== DRY-RUN DISTRIBUICAO (motor oficial, dados reais ProJuris) ===');
  console.log('  distribution_date:', distributionDate, '| janela:', windowDays, 'dias');

  // ---- Supabase (service_role) ----
  const supabaseUrl = env('SUPABASE_URL', env('VITE_SUPABASE_URL'));
  const supabase = createClient(supabaseUrl, env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  // ---- Adapter (OAuth2) ----
  const adapter = new ProjurisRestAdapter({
    PROJURIS_BASE_URL: env('PROJURIS_BASE_URL', 'https://api.projurisadv.com.br/adv-service'),
    PROJURIS_AUTH_TYPE: 'oauth2_password',
    PROJURIS_AUTH_URL: env('PROJURIS_AUTH_URL', 'https://apigw.projurisadv.com.br/auth/token'),
    PROJURIS_CLIENT_ID: env('PROJURIS_CLIENT_ID', env('PROJURIS_API_CLIENTE_CODIGO')),
    PROJURIS_CLIENT_SECRET: env('PROJURIS_CLIENT_SECRET'),
    PROJURIS_USERNAME: env('PROJURIS_USERNAME'),
    PROJURIS_PASSWORD: env('PROJURIS_PASSWORD'),
    PROJURIS_DOMINIO: env('PROJURIS_DOMINIO'),
  });

  console.log('\n[1/6] Autenticando (OAuth2 password)...');
  await adapter.ping();
  console.log('  auth OK');

  // ---- 2) Intimacoes -> processos candidatos ----
  console.log('\n[2/6] Consultando intimacoes (POST /intimacao/consulta)...');
  const start = addDays(distributionDate, -windowDays);
  const intResp = await (adapter as unknown as {
    post<T>(p: string, b: unknown): Promise<T>;
  }).post<{ totalRegistros?: number; intimacaoConsultaWs?: Array<Record<string, unknown>> }>(
    '/intimacao/consulta',
    {
      tipoDataFiltroIntimacao: 'DATA_DA_DISPONIBILIZACAO',
      dataPeriodoInicial: start,
      dataPeriodoFinal: distributionDate,
      dadosOrigemFiltro: true,
    },
  );
  const intimacoes = intResp.intimacaoConsultaWs ?? [];
  const procCodes = [...new Set(
    intimacoes.map((x) => x.codigoProcesso).filter((v): v is number => typeof v === 'number'),
  )];
  console.log(`  intimacoes=${intimacoes.length} (totalRegistros=${intResp.totalRegistros}) | processos unicos=${procCodes.length}`);

  // ---- 3) Por processo: assunto (tema) + tarefas abertas (multi-modulo) ----
  console.log('\n[3/6] Buscando processo + tarefas por processo (consulta-multi-modulo)...');
  const get = (adapter as unknown as { get<T>(p: string): Promise<T> }).get.bind(adapter);

  const rawTasks: Array<{
    task_id: string; process_id: string; tipo_codigo: string; tipo_nome: string;
    prazo_fatal: string | null; prazo_interno: string | null; responsavel_nome: string;
  }> = [];
  const processAssunto = new Map<string, string>();

  const MAX_PROC = Number(env('DRYRUN_MAX_PROCESSOS', '80')) || 80;
  const chosen = procCodes.slice(0, MAX_PROC);
  let procOk = 0;
  for (const code of chosen) {
    const pid = String(code);
    try {
      const proc = await get<Record<string, unknown>>(`/processo/${pid}`);
      const assunto = String(proc.assunto ?? proc.nomeAssunto ?? '');
      processAssunto.set(pid, assunto);
      procOk++;
    } catch (e) {
      console.log(`   (erro /processo/${pid}:`, e instanceof Error ? e.message.slice(0, 80) : e, ')');
      continue;
    }
    try {
      const raw = await get<unknown>(`/processo/${pid}/tarefa/consulta-multi-modulo`);
      const arr = firstArrayDeep(raw) as Array<Record<string, unknown>>;
      for (const t of arr) {
        // So tarefas ABERTAS (nao concluidas).
        if (t.flagSituacaoConcluida === true) continue;
        const tipoCodigo = String(t.codigoTarefaTipo ?? '');
        if (!tipoCodigo) continue;
        rawTasks.push({
          task_id: String(t.codigoTarefa ?? `${pid}-${tipoCodigo}`),
          process_id: pid,
          tipo_codigo: tipoCodigo,
          tipo_nome: String(t.nomeTarefaTipo ?? ''),
          prazo_fatal: msToIso(t.dataLimite),
          prazo_interno: msToIso(t.dataConclusaoPrevista ?? t.dataLimite),
          responsavel_nome: String(t.usuarioResponsaveis ?? ''),
        });
      }
    } catch (e) {
      console.log(`   (erro multi-modulo ${pid}:`, e instanceof Error ? e.message.slice(0, 80) : e, ')');
    }
  }
  console.log(`  processos lidos=${procOk} | tarefas abertas coletadas=${rawTasks.length}`);

  // ---- 4) Mapeamentos + executores + calendario (Supabase) ----
  console.log('\n[4/6] Carregando mapeamentos/executores/calendario do banco...');
  const [ttRes, thRes, exRes, usersRes] = await Promise.all([
    supabase.from('system_task_type_mapping')
      .select('projuris_tipo_codigo, motor_task_type_id, points, complexity_level, temporal_level, exclusive_executor_id')
      .eq('organization_id', ORG_ID).eq('active', true),
    supabase.from('system_theme_mapping')
      .select('projuris_tema_codigo, motor_theme_id, multiplier, temporal_level, exclusive_executor_id')
      .eq('organization_id', ORG_ID).eq('active', true),
    supabase.from('system_projuris_executor_mapping')
      .select('projuris_responsavel_id, executor_id, active, weight, eligible_complex')
      .eq('organization_id', ORG_ID).eq('active', true),
    supabase.from('system_users').select('id, full_name, status').eq('organization_id', ORG_ID),
  ]);

  const ttMap = new Map<string, { motor_task_type_id: string; points: number; complexity_level: number; temporal_level: number; exclusive_executor_id: string | null }>();
  for (const r of ttRes.data ?? []) ttMap.set(r.projuris_tipo_codigo, { motor_task_type_id: r.motor_task_type_id, points: Number(r.points), complexity_level: r.complexity_level, temporal_level: r.temporal_level, exclusive_executor_id: r.exclusive_executor_id ?? null });

  const thMap = new Map<string, { motor_theme_id: string; multiplier: number; temporal_level: number; exclusive_executor_id: string | null }>();
  for (const r of thRes.data ?? []) thMap.set(r.projuris_tema_codigo, { motor_theme_id: r.motor_theme_id, multiplier: Number(r.multiplier), temporal_level: r.temporal_level, exclusive_executor_id: r.exclusive_executor_id ?? null });

  // executores do motor = quem tem mapping (FK -> system_users)
  const execMappingIds = new Set((exRes.data ?? []).map((r) => r.executor_id as string));
  const execWeight = new Map<string, { weight: number; eligible_complex: boolean }>();
  for (const r of exRes.data ?? []) execWeight.set(r.executor_id as string, { weight: Number(r.weight), eligible_complex: r.eligible_complex });

  const executors: Executor[] = (usersRes.data ?? [])
    .filter((u) => execMappingIds.has(u.id) && u.status === 'ACTIVE')
    .map((u) => ({
      executor_id: u.id,
      active: true,
      general_weight: execWeight.get(u.id)?.weight ?? 1,
      complex_eligible: execWeight.get(u.id)?.eligible_complex ?? true,
      authorized_task_types: [],
      authorized_themes: [],
    }));
  console.log(`  task_types=${ttMap.size} temas=${thMap.size} executores(motor)=${executors.length}`);

  if (executors.length === 0) throw new Error('Nenhum executor mapeado -> impossivel distribuir.');

  // calendario (dias uteis, sem bloqueios) — periodo do dia ate +60
  const calendar: CalendarDay[] = [];
  {
    const from = distributionDate; const to = addDays(distributionDate, 60);
    let cur = from;
    while (cur <= to) {
      const [y, m, d] = cur.split('-').map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      calendar.push({ date: cur, globally_operational: dow >= 1 && dow <= 5, initial_team_points: 0, blocked_executor_ids: [] });
      cur = addDays(cur, 1);
    }
  }

  // ---- 5) Transformar em BatchInput ----
  console.log('\n[5/6] Transformando para o motor...');
  const tasks: Task[] = [];
  const processMap = new Map<string, Process>();
  const discarded = { semTipo: 0, semTema: 0 };

  let order = 0;
  for (const rt of rawTasks) {
    const tt = ttMap.get(rt.tipo_codigo);
    if (!tt) { discarded.semTipo++; continue; }
    const assunto = processAssunto.get(rt.process_id) ?? '';
    const th = thMap.get(assunto);
    if (!th) { discarded.semTema++; continue; }

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
      // Excecoes "executor exclusivo" (fonte SHV, ProJuris nao expoe). O engine
      // (flow-selector.detectAbsoluteResponsible) le esses campos -> fluxo ABSOLUTE.
      // process.directed_executor_id fica null (ProJuris nao mapeia direcionamento).
      theme_exclusive_executor_id: th.exclusive_executor_id ?? null,
      task_type_exclusive_executor_id: tt.exclusive_executor_id ?? null,
      fatal_date: rt.prazo_fatal ?? '9999-12-31',
      internal_limit_date: rt.prazo_interno ?? rt.prazo_fatal ?? '9999-12-31',
      input_order: ++order,
    });
  }
  console.log(`  tarefas mapeadas=${tasks.length} | descartadas(sem tipo)=${discarded.semTipo} descartadas(sem tema)=${discarded.semTema}`);

  if (tasks.length === 0) {
    console.log('\nNenhuma tarefa mapeavel no periodo -> nada a distribuir. (dry-run encerrado)');
    return;
  }

  const queueState: QueueState = { general_balances: {}, complex_balances: {}, rotating_order: executors.map((e) => e.executor_id) };
  const preferenceHistory: PreferenceHistory[] = [];

  const batchInput = buildBatchInput(
    crypto.randomUUID(), distributionDate, 'HIGH_PRODUCTION', 10,
    tasks, [...processMap.values()], executors, calendar, preferenceHistory, queueState,
  );

  // ---- 6) MOTOR + gravar simulacao ----
  console.log('\n[6/6] Executando motor (distributeBatch)...');
  const output = distributeBatch(batchInput);

  const simulationRunId = crypto.randomUUID();
  const rows = output.task_results.map((r) => ({
    organization_id: ORG_ID,
    simulation_run_id: simulationRunId,
    simulation_mode: 'dry_run_projuris_real',
    task_id: r.task_id,
    process_id: r.process_id,
    distribution_date: r.distribution_date,
    final_points: r.final_points,
    flow: r.flow,
    base_date: r.base_date,
    applicable_limit: r.applicable_limit,
    preferred_date: r.preferred_date,
    final_date: r.final_date,
    executor_id: r.executor_id || null,
    preference_applied: r.preference_applied,
    alerts: r.alerts,
    blocked: r.blocked,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from('system_distribution_simulations').insert(chunk);
    if (error) throw new Error(`insert simulacoes falhou: ${error.message}`);
  }

  // ---- Relatorio ----
  const nameById = new Map<string, string>();
  for (const u of usersRes.data ?? []) nameById.set(u.id, u.full_name);
  const byExec: Record<string, number> = {};
  const byExecPts: Record<string, number> = {};
  for (const r of output.task_results) {
    if (r.blocked || !r.executor_id) continue;
    byExec[r.executor_id] = (byExec[r.executor_id] ?? 0) + 1;
    byExecPts[r.executor_id] = (byExecPts[r.executor_id] ?? 0) + r.final_points;
  }

  console.log('\n========================= RESULTADO =========================');
  console.log('simulation_run_id:', simulationRunId);
  console.log('total_tarefas    :', output.metrics.total_tasks);
  console.log('distribuidas     :', output.metrics.successful);
  console.log('bloqueadas       :', output.metrics.failed);
  console.log('\nDistribuicao por executor (tarefas | pontos):');
  Object.entries(byExec)
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, n]) => console.log(`  ${(nameById.get(id) ?? id).padEnd(30)} ${String(n).padStart(4)} | ${(byExecPts[id] ?? 0).toFixed(2)} pts`));
  console.log('\nAlertas (codigo: contagem):');
  const alerts = Object.entries(output.alerts_summary).sort((a, b) => b[1] - a[1]);
  if (alerts.length === 0) console.log('  (nenhum)');
  else alerts.forEach(([code, n]) => console.log(`  ${code}: ${n}`));
  console.log('\nFluxos:');
  const flows: Record<string, number> = {};
  for (const r of output.task_results) if (!r.blocked) flows[r.flow] = (flows[r.flow] ?? 0) + 1;
  Object.entries(flows).forEach(([f, n]) => console.log(`  ${f}: ${n}`));
  console.log('\nGravado em system_distribution_simulations. NENHUMA escrita no ProJuris (sem writeback).');
  console.log('=============================================================');
}

main().catch((e) => { console.error('FALHA:', e instanceof Error ? e.stack : e); Deno.exit(1); });
