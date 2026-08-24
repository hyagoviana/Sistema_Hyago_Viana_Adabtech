// Nucleo (server-only, Node) da Sincronizacao do Motor de Distribuicao.
//
// Extraido de src/rpc/distribuicao.ts para poder ser chamado tanto pela server
// function (botao "Sincronizar") quanto por scripts (ex.: scripts/run-sincronizar.ts,
// o cron futuro). NAO importa nada do TanStack — so engine puro + client + supabase.
//
// Fluxo (espelha o harness supabase/functions/projuris-sync/scripts/run-distribuicao-dryrun.ts):
//   auth OAuth2 no ProJuris (src/lib/projuris/client) -> POST /intimacao/consulta
//   -> por processo: GET /processo/{cod} (assunto=tema) + GET
//   /processo/{cod}/tarefa/consulta-multi-modulo (tarefas abertas) -> le
//   mappings/executores/calendario do Supabase (service role) -> buildBatchInput
//   -> distributeBatch -> grava em system_distribution_results (writeback_pending
//   = true, so as distribuidas — executor_id e NOT NULL/FK) +
//   system_distribution_batch_logs (is_simulation = true).
//
// REGRA CRITICA: ZERO writeback ao ProJuris. So LEITURA no ProJuris; ESCRITA
// apenas nas 2 tabelas acima do nosso banco. Idempotente por data: apaga os
// results da (distribution_date + org) antes de reinserir (re-sync limpo).

import { AuthError } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ProjurisClient } from "@/lib/projuris/client";
import {
  buildThemeMap,
  marcadorNames,
  type ThemeMapRow,
  normalizeTemaKey,
} from "@/lib/projuris/normalizer";
import { deriveFromMarcadores } from "@/lib/distribuicao/marcadores";
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

export const ORG_ID = "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Helpers de data (puros, ISO YYYY-MM-DD)
// ---------------------------------------------------------------------------
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDaysIso(iso: string, n: number): string {
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
// Client ProJuris a partir da config do BANCO (H11) — reusado por runSync e
// pela sincronizacao de tipos (H6). Precedencia banco → env POR CAMPO; a config
// e a fonte da verdade, o env e fallback. NUNCA loga a config crua nem segredos.
//
// Mapa credencial↔coluna (auth_type='oauth2_password'):
//   baseUrl      ← projuris_base_url   || PROJURIS_BASE_URL
//   username     ← projuris_username   || PROJURIS_USERNAME
//   password     ← projuris_password   || PROJURIS_PASSWORD
//   clientId     ← PROJURIS_API_CLIENTE_CODIGO   (env — segredo de app, A9)
//   clientSecret ← PROJURIS_CLIENT_SECRET        (env — segredo de app, A9)
//   authUrl      ← PROJURIS_AUTH_URL             (env; default apigw)
//   dominio      ← PROJURIS_DOMINIO              (env)
// As colunas projuris_token/projuris_api_key existem p/ outros auth_types
// (bearer/apikey) mas não são exercidas no fluxo oauth2_password de hoje.
export async function buildProjurisClientFromConfig(
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<ProjurisClient> {
  const { data: cfg } = await supabase
    .from("system_distribution_config")
    .select(
      "projuris_base_url, projuris_auth_type, projuris_username, projuris_password, projuris_token, projuris_api_key",
    )
    .eq("organization_id", ORG_ID)
    .maybeSingle();

  // Helper: banco (se não-vazio) → env (se não-vazio) → undefined.
  const pick = (dbVal: unknown, envVal: string | undefined): string | undefined => {
    const db = typeof dbVal === "string" ? dbVal.trim() : "";
    if (db) return db;
    const env = (envVal ?? "").trim();
    return env || undefined;
  };

  // client_id/secret ficam no env por decisão A9 (segredo de app).
  const clientId = process.env.PROJURIS_API_CLIENTE_CODIGO ?? "";
  const clientSecret = process.env.PROJURIS_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new AuthError("PROJURIS_API_CLIENTE_CODIGO / PROJURIS_CLIENT_SECRET ausentes.", 500);
  }

  return new ProjurisClient({
    clientId,
    clientSecret,
    username: pick(cfg?.projuris_username, process.env.PROJURIS_USERNAME),
    dominio: process.env.PROJURIS_DOMINIO || undefined,
    password: pick(cfg?.projuris_password, process.env.PROJURIS_PASSWORD),
    authUrl: process.env.PROJURIS_AUTH_URL || undefined,
    baseUrl: pick(cfg?.projuris_base_url, process.env.PROJURIS_BASE_URL),
  });
}

// R5 — extrai os NOMES dos responsáveis de uma tarefa (multi-modulo). ACHADO
// 2026-08-17: no multi-modulo, `usuarioResponsaveis` vem como STRING de nome(s)
// ("THAISE" ou "Fulano, Beltrano"), não como array de códigos. Casamos por NOME
// contra system_users (ver normalizeNome / write do snapshot).
function parseRespNames(t: Record<string, unknown>): string[] {
  const raw = t.usuarioResponsaveis;
  if (typeof raw === "string") {
    return raw
      .split(/[,;/]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw
      .map((r) =>
        r && typeof r === "object"
          ? String(
              (r as Record<string, unknown>).nome ?? (r as Record<string, unknown>).valor ?? "",
            )
          : String(r ?? ""),
      )
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

// Normaliza nome p/ casamento (minúsculo, sem acento, espaços colapsados).
function normalizeNome(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// R5 — normaliza a situação da tarefa numa das COLUNAS do Kanban (estilo
// ProJuris). Fallback determinístico: concluída→"Concluída com sucesso";
// senão "Pendente".
export const KANBAN_COLUMNS = [
  "Pendente",
  "Em execução",
  "Concluída com sucesso",
  "Concluída sem sucesso",
  "Cancelado",
  "A confirmar",
  "Revisão",
] as const;
function normalizeSituacaoCol(situacao: string | null, concluida: boolean): string {
  const s = (situacao ?? "").toLowerCase();
  if (s.includes("cancel")) return "Cancelado";
  if (s.includes("revis")) return "Revisão";
  if (s.includes("confirm")) return "A confirmar";
  if (s.includes("execu") || s.includes("andamento")) return "Em execução";
  if (s.includes("sem sucesso") || s.includes("insucesso")) return "Concluída sem sucesso";
  if (s.includes("sucesso") || s.includes("conclu")) return "Concluída com sucesso";
  if (concluida) return "Concluída com sucesso";
  return "Pendente";
}

/**
 * Gate de produção: o motor só roda AUTOMÁTICO (cron) quando o owner ligou a
 * chave em `system_distribution_config.active`. NÃO afeta o disparo MANUAL
 * (botão "Sincronizar"/"Simular"), que precisa funcionar mesmo com o motor
 * desligado — é assim que se valida antes de ligar. Ver R6/ativação segura.
 */
export async function isDistributionActive(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("system_distribution_config")
    .select("active")
    .eq("organization_id", ORG_ID)
    .maybeSingle();
  return data?.active === true;
}

export async function runSync(distributionDate: string, windowDays: number): Promise<SyncSummary> {
  const supabase = getSupabaseAdmin();

  const client = await buildProjurisClientFromConfig(supabase);

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

  // H1: de-para de PROCESSO — guarda o numeroProcesso (CNJ humano) por
  // codigoProcesso (chave interna) para exibir NOME na lista, sem novo GET.
  const numeroProcessoByCode = new Map<string, string>();
  for (const x of intimacoes) {
    const cod = typeof x.codigoProcesso === "number" ? String(x.codigoProcesso) : null;
    const num = typeof x.numeroProcesso === "string" ? x.numeroProcesso : null;
    if (cod && num && !numeroProcessoByCode.has(cod)) numeroProcessoByCode.set(cod, num);
  }

  // ---- 3) Por processo: assunto (tema) + tarefas abertas (multi-modulo) ----
  const rawTasks: Array<{
    task_id: string;
    process_id: string;
    tipo_codigo: string;
    tipo_nome: string | null; // H1: nome ProJuris do tipo (nomeTarefaTipo), p/ exibição
    prazo_fatal: string | null;
    prazo_interno: string | null;
  }> = [];
  const processAssunto = new Map<string, string>();
  // M13 — marcadores por processo (v1 de COMPLEXO/COLETIVO). Capturados no mesmo
  // GET /processo/{cod} (sem request extra), como o normalizer já faz p/ tema.
  const processMarcadores = new Map<string, string[]>();
  // DESCOBERTA (2026-08-08): agrega TODOS os marcadores CRUS vistos em qualquer
  // processo (independe de casar no MARCADOR_MAP ou de ter tema mapeado). Vai no
  // relatório (metrics.marcadores_vistos) — quando a equipe do Thiago começar a
  // preencher COMPLEXO/COLETIVO, os nomes REAIS aparecem aqui e é só adicioná-los
  // em src/lib/distribuicao/marcadores.ts (sem adivinhar).
  const marcadoresVistos = new Map<string, number>();
  // R5 — snapshot CRU de TODAS as tarefas (abertas E concluídas) p/ a aba Kanban.
  // Enriquecido (nomes/uuids dos responsáveis) e persistido no passo de escrita.
  const snapshotRaw: Array<{
    task_id: string;
    process_id: string;
    tipo_nome: string | null;
    situacao: string | null;
    concluida: boolean;
    prazo_previsto: string | null;
    prazo_fatal: string | null;
    respNames: string[];
  }> = [];

  const MAX_PROC = Number(process.env.DISTRIBUICAO_MAX_PROCESSOS ?? "150") || 150;
  const chosen = procCodes.slice(0, MAX_PROC);

  for (const code of chosen) {
    const pid = String(code);
    try {
      const proc = await client.projurisGet<Record<string, unknown>>(`processo/${pid}`);
      const assunto = String(proc.assunto ?? proc.nomeAssunto ?? "");
      processAssunto.set(pid, assunto);
      // M13 — marcadores do processo (COMPLEXO/COLETIVO v1). SÓ LEITURA.
      const marc = marcadorNames(proc.marcadorWs);
      processMarcadores.set(pid, marc);
      for (const m of marc) marcadoresVistos.set(m, (marcadoresVistos.get(m) ?? 0) + 1);
    } catch {
      // Processo ilegivel -> pula (sem tema nao ha o que distribuir).
      continue;
    }
    try {
      const raw = await client.projurisGet<unknown>(`processo/${pid}/tarefa/consulta-multi-modulo`);
      const arr = firstArrayDeep(raw) as Array<Record<string, unknown>>;
      for (const t of arr) {
        // R5 — snapshot de TODAS as tarefas (antes do filtro de abertas): a aba
        // Kanban mostra pendentes E concluídas por coluna de situação.
        const snapSituacao = typeof t.situacao === "string" ? t.situacao : null;
        snapshotRaw.push({
          task_id: String(t.codigoTarefa ?? `${pid}-${String(t.codigoTarefaTipo ?? "")}`),
          process_id: pid,
          tipo_nome: typeof t.nomeTarefaTipo === "string" ? t.nomeTarefaTipo : null,
          situacao: snapSituacao,
          concluida: t.flagSituacaoConcluida === true,
          prazo_previsto: msToIso(t.dataConclusaoPrevista),
          prazo_fatal: msToIso(t.dataLimite),
          respNames: parseRespNames(t),
        });
        // So tarefas ABERTAS (nao concluidas) entram na DISTRIBUIÇÃO.
        if (t.flagSituacaoConcluida === true) continue;
        const tipoCodigo = String(t.codigoTarefaTipo ?? "");
        if (!tipoCodigo) continue;
        rawTasks.push({
          task_id: String(t.codigoTarefa ?? `${pid}-${tipoCodigo}`),
          process_id: pid,
          tipo_codigo: tipoCodigo,
          tipo_nome: typeof t.nomeTarefaTipo === "string" ? t.nomeTarefaTipo : null,
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
        "projuris_tipo_codigo, motor_task_type_id, points, complexity_level, temporal_level, exclusive_executor_id, prazo_previsto_dias, prazo_fatal_dias",
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
    supabase
      .from("system_users")
      .select("id, full_name, status, peticionante, participa_distribuicao_padrao")
      .eq("organization_id", ORG_ID),
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
    // H6: defaults internos de prazo (fallback quando a tarefa ProJuris nao traz).
    prazo_previsto_dias: number | null;
    prazo_fatal_dias: number | null;
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
  // H4: de-para de TEMA por NOME NORMALIZADO (acento/caixa/espaco). Antes o
  // casamento era exato contra o assunto cru (thMap.get(assunto)), o que
  // derrubava qualquer variacao de grafia. resolveTemaId() casa o assunto/
  // marcador/campo contra este mapa normalizado.
  const thMap: Map<string, ThemeMapRow> = buildThemeMap((thRes.data ?? []) as ThemeRow[]);

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

  type UserRow = {
    id: string;
    full_name: string;
    status: string;
    // M8 (2026-08-07) — DUAS flags do motor.
    peticionante: boolean | null;
    participa_distribuicao_padrao: boolean | null;
  };
  const users = (usersRes.data ?? []) as UserRow[];
  const nameById = new Map(users.map((u) => [u.id, u.full_name]));

  // M8 (revisado 2026-08-08): as DUAS flags têm papéis DIFERENTES —
  //   (a) peticionante === true  → condição de ENTRAR no POOL do motor. Quem é
  //       false NEM é considerado. Quem é true PODE receber (fila geral E/OU por
  //       exceção/responsável exclusivo). Executor exclusivo (ex.: Thiago/Audiência)
  //       precisa estar no pool mesmo com participa=false — por isso o filtro do
  //       pool usa SÓ peticionante.
  //   (b) participa_distribuicao_padrao === true → controla a FILA GERAL/ordinária.
  //       false ⇒ general_weight = 0 (não entra na eleição da fila geral; só recebe
  //       por exceção). O engine já ignora general_weight=0 na fila GENERAL e honra
  //       o fluxo ABSOLUTE (exclusivo) independentemente do peso.
  // As flags nascem false na migration; até serem populadas (M15/admin/seed), o
  // pool pode ficar vazio (o guard abaixo lança 422 com mensagem clara).
  const executors: Executor[] = users
    .filter((u) => execMappingIds.has(u.id) && u.status === "ACTIVE" && u.peticionante === true)
    .map((u) => {
      const m = execById.get(u.id);
      // participa=false ⇒ fora da fila geral (peso 0), mas continua no pool p/ exceção.
      const inGeneral = u.participa_distribuicao_padrao === true;
      return {
        executor_id: u.id,
        active: true,
        general_weight: inGeneral ? (m?.weight ?? 100) : 0,
        // Complexidade: só quem tem eligible_complex=true (regra do Thiago: 4 pessoas).
        complex_eligible: m?.eligible_complex ?? false,
        authorized_task_types: m?.authorized_task_types ?? [],
        authorized_themes: m?.authorized_themes ?? [],
      };
    });

  if (executors.length === 0) {
    throw new AuthError("Nenhum executor mapeado/ativo · impossivel distribuir.", 422);
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
  // H4: alertas gerados FORA do engine (na fase de montagem), acumulados aqui
  // para entrar no resumo/batch_log em vez de sumir com `continue` silencioso.
  const preBatchAlerts: Record<string, number> = {};
  const bump = (code: string) => {
    preBatchAlerts[code] = (preBatchAlerts[code] ?? 0) + 1;
  };
  // Diagnostico (AC-6): por processo, o assunto cru e o tema resolvido/motivo.
  const temaDiag = new Map<string, { assunto: string; resolvido: string | null }>();
  // M13 — diagnóstico dos marcadores derivados por processo (auditoria do owner).
  const marcadorDiag = new Map<
    string,
    { marcadores: string[]; collective: boolean; complexity_level: number }
  >();

  // M13 (T3) — URGENTE/PRIORITÁRIO é campo NOSSO (system_cases.distribution_urgency),
  // não vem do ProJuris. Casa o caso pelo código ProJuris (projuris_codigo_processo)
  // e vira temporal_level: prioritario=1, urgente=2. Sem marca ⇒ 0 (normal).
  const urgencyByCode = new Map<string, number>();
  {
    const { data: urgRows } = await supabase
      .from("system_cases")
      .select("projuris_codigo_processo, distribution_urgency")
      .eq("organization_id", ORG_ID)
      .not("distribution_urgency", "is", null);
    for (const r of (urgRows ?? []) as {
      projuris_codigo_processo: number | null;
      distribution_urgency: string | null;
    }[]) {
      if (r.projuris_codigo_processo == null) continue;
      const lvl =
        r.distribution_urgency === "urgente" ? 2 : r.distribution_urgency === "prioritario" ? 1 : 0;
      if (lvl > 0) urgencyByCode.set(String(r.projuris_codigo_processo), lvl);
    }
  }

  const tasks: Task[] = [];
  const processMap = new Map<string, Process>();
  let order = 0;
  // Thiago (2026-08-08): tipos de tarefa que caíram no FALLBACK (sem de-para) —
  // para o relatório. A controladoria ajusta a pontuação depois no ProJuris.
  const tipoFallback = new Set<string>();
  // De-dup por task_id: tarefas sem codigoTarefa geram id `pid-tipo`, que pode
  // colidir (2 tarefas do mesmo tipo no mesmo processo). O results tem UNIQUE
  // (task_id, date, org) — sem dedup, o insert quebra.
  const seenTaskIds = new Set<string>();
  // R3 — DUPLICADOS: em vez de descartar em silêncio, o motor manda os duplicados
  // para a aba Exceções (o próprio sistema identifica e "joga ali", sem virar
  // tarefa distribuída). Coletados aqui e gravados no passo de escrita.
  const duplicateTasks: Array<{
    task_id: string;
    process_id: string;
    tipo_codigo: string;
    tipo_nome: string | null;
  }> = [];
  for (const rt of rawTasks) {
    if (seenTaskIds.has(rt.task_id)) {
      duplicateTasks.push({
        task_id: rt.task_id,
        process_id: rt.process_id,
        tipo_codigo: rt.tipo_codigo,
        tipo_nome: rt.tipo_nome,
      });
      continue;
    }
    seenTaskIds.add(rt.task_id);
    // "Puxa TODAS as tarefas do ProJuris." Se o tipo não está no de-para, usa
    // FALLBACK (pontuação padrão 1, sem complexidade/temporal/exclusivo) em vez
    // de descartar a tarefa. Assim nada é bloqueado por "tipo não mapeado".
    let tt = ttMap.get(rt.tipo_codigo);
    if (!tt) {
      tipoFallback.add(rt.tipo_codigo);
      tt = {
        projuris_tipo_codigo: rt.tipo_codigo,
        motor_task_type_id: "FALLBACK",
        points: 1,
        complexity_level: 0,
        temporal_level: 0,
        exclusive_executor_id: null,
        prazo_previsto_dias: null,
        prazo_fatal_dias: null,
      };
    }
    const assunto = processAssunto.get(rt.process_id) ?? "";
    // H4: casamento por NOME NORMALIZADO (acento/caixa/espaco) contra o de-para,
    // no lugar do get exato do assunto cru. O assunto do PROCESSO e a fonte
    // canonica confirmada no achado A9 (populada hoje).
    const th = thMap.get(normalizeTemaKey(assunto));
    if (!temaDiag.has(rt.process_id)) {
      temaDiag.set(rt.process_id, { assunto, resolvido: th ? th.motor_theme_id : null });
    }
    if (!th) {
      // H4: tema nao mapeado -> ALERTA (nao descarte silencioso). A intimacao
      // NAO entra na distribuicao (sem tema nao ha multiplier), mas e
      // CONTABILIZADA no resumo/batch_log para o owner auditar a cobertura.
      bump("ALT-TEMA-001");
      continue;
    }

    if (!processMap.has(rt.process_id)) {
      // M13 — deriva COMPLEXO/COLETIVO dos MARCADORES do processo (v1). Sem
      // marcador conhecido ⇒ individual/não-complexo (fallback determinístico).
      // temporal_level vem do URGENTE/PRIORITÁRIO nativo do caso (campo nosso).
      const marc = processMarcadores.get(rt.process_id) ?? [];
      const der = deriveFromMarcadores(marc);
      marcadorDiag.set(rt.process_id, {
        marcadores: marc,
        collective: der.collective,
        complexity_level: der.complexity_level,
      });
      processMap.set(rt.process_id, {
        process_id: rt.process_id,
        theme_id: th.motor_theme_id,
        collective: der.collective,
        complexity_level: der.complexity_level,
        temporal_level: (urgencyByCode.get(rt.process_id) ?? 0) as 0 | 1 | 2,
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
      // H6: prazo = REAL da tarefa (ProJuris) > default interno do tipo
      // (base+N dias sobre a data de distribuicao) > sentinela. A data real
      // continua autoritativa (sem regressao); o default so entra quando a
      // tarefa nao trouxe o prazo.
      fatal_date:
        rt.prazo_fatal ??
        (tt.prazo_fatal_dias != null ? addDaysIso(distributionDate, tt.prazo_fatal_dias) : null) ??
        "9999-12-31",
      internal_limit_date:
        rt.prazo_interno ??
        rt.prazo_fatal ??
        (tt.prazo_previsto_dias != null
          ? addDaysIso(distributionDate, tt.prazo_previsto_dias)
          : null) ??
        (tt.prazo_fatal_dias != null ? addDaysIso(distributionDate, tt.prazo_fatal_dias) : null) ??
        "9999-12-31",
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
  // 🔴 origem='batch': NÃO tocar nas linhas que a controladoria distribuiu à mão
  // pela tela "A distribuir" (origem='staging'). Antes deste filtro, o cron das
  // 8h apagava o trabalho humano do dia — sem erro e sem aviso.
  const delRes = await supabase
    .from("system_distribution_results")
    .delete()
    .eq("organization_id", ORG_ID)
    .eq("distribution_date", distributionDate)
    .eq("origem", "batch");
  if (delRes.error) {
    throw new AuthError(
      `Falha ao limpar distribuicao anterior de ${distributionDate}: ${delRes.error.message}. ` +
        "Aplique a migration 20260805000003 (permitir DELETE em system_distribution_results).",
      500,
    );
  }

  // H1: de-para de TIPO por task_id (código + nome ProJuris da tarefa escolhida).
  const tipoByTaskId = new Map<string, { codigo: string; nome: string | null }>();
  for (const rt of rawTasks) {
    if (!tipoByTaskId.has(rt.task_id)) {
      tipoByTaskId.set(rt.task_id, { codigo: rt.tipo_codigo, nome: rt.tipo_nome });
    }
  }

  // So as DISTRIBUIDAS (nao-bloqueadas) vao pra results — executor_id e NOT NULL
  // e FK -> system_users; bloqueadas nao tem executor. As bloqueadas ficam
  // refletidas no batch_log (failed) e nos alertas.
  //
  // H1: gravamos os dados de EXIBIÇÃO no raw_data (JSONB) NO INSERT (a tabela é
  // append-only via trigger — não dá p/ preencher por UPDATE depois). A lista lê
  // numeroProcesso/tipo daqui sem novo GET no ProJuris.
  const rows = output.task_results
    .filter((r) => !r.blocked && r.executor_id)
    .map((r) => {
      const tipo = tipoByTaskId.get(r.task_id);
      return {
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
        raw_data: {
          numero_processo: numeroProcessoByCode.get(r.process_id) ?? null,
          // Nome/descrição do processo = assunto do ProJuris (descricao/nomePasta
          // vêm quase sempre nulos; o assunto é o rótulo legível: "INDENIZAÇÃO
          // PMMB", "PREVIDENCIÁRIO"...). Coluna "Processo" da lista usa isto; o
          // CNJ vai na coluna "Número do processo".
          nome_processo: processAssunto.get(r.process_id) || null,
          tipo_codigo: tipo?.codigo ?? null,
          tipo_nome: tipo?.nome ?? null,
        },
      };
    });

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from("system_distribution_results").insert(chunk);
    if (error) throw new AuthError(`insert de resultados falhou: ${error.message}`, 500);
  }

  // batch_log (is_simulation=true — sob demanda, sem writeback). Insere direto
  // como 'completed' (a coluna is_simulation marca a origem manual).
  // H4: alertas do engine + alertas pre-batch (ex.: ALT-TEMA-001) num unico mapa.
  const mergedAlertsSummary: Record<string, number> = { ...output.alerts_summary };
  for (const [code, count] of Object.entries(preBatchAlerts)) {
    mergedAlertsSummary[code] = (mergedAlertsSummary[code] ?? 0) + count;
  }
  const alertsGenerated = Object.values(mergedAlertsSummary).reduce((s, n) => s + n, 0);
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
      // H4: quantos processos ficaram sem tema mapeado (auditoria de cobertura).
      temas_nao_mapeados: preBatchAlerts["ALT-TEMA-001"] ?? 0,
      // Thiago (2026-08-08): tipos de tarefa que caíram no FALLBACK (pontuação 1).
      // A controladoria ajusta no ProJuris; o motor NÃO descarta a tarefa.
      tipos_fallback: [...tipoFallback],
      // Descoberta de marcadores: TODOS os marcadores crus vistos (nome → qtd).
      // Quando aparecer COMPLEXO/COLETIVO real, adicionar em marcadores.ts.
      marcadores_vistos: Object.fromEntries(marcadoresVistos),
      // H4 (AC-6): amostra de diagnostico do de-para de tema (assunto cru ->
      // motor_theme_id resolvido ou null) — cap 50 p/ nao inflar o metrics.
      tema_diag: [...temaDiag.entries()]
        .slice(0, 50)
        .map(([process_id, d]) => ({ process_id, assunto: d.assunto, resolvido: d.resolvido })),
      // M13 (AC-6): amostra do de-para de MARCADOR → collective/complexity
      // derivado (para o owner auditar o casamento). Só entradas com marcador.
      marcador_diag: [...marcadorDiag.entries()]
        .filter(([, d]) => d.marcadores.length > 0)
        .slice(0, 50)
        .map(([process_id, d]) => ({
          process_id,
          marcadores: d.marcadores,
          collective: d.collective,
          complexity_level: d.complexity_level,
        })),
      source: "on_demand_sync",
    },
    is_simulation: true,
  });
  if (logErr) throw new AuthError(`insert do batch_log falhou: ${logErr.message}`, 500);

  // ---- 7b) DUPLICADOS -> aba Exceções (R3) ----
  // Idempotente: limpa as exceções de duplicado ainda PENDENTES antes de
  // reinserir (não mexe nas já resolvidas/atribuídas/ignoradas). Assim o re-sync
  // não empilha; e um duplicado que sumiu deixa de aparecer.
  {
    await supabase
      .from("system_distribution_exceptions")
      .delete()
      .eq("organization_id", ORG_ID)
      .eq("alert_code", "ALT-DUP-001")
      .eq("status", "pending");
    // Dedup por task_id (um mesmo id pode repetir várias vezes).
    const dupByTask = new Map<
      string,
      { process_id: string; tipo_codigo: string; tipo_nome: string | null }
    >();
    for (const d of duplicateTasks) {
      if (!dupByTask.has(d.task_id)) {
        dupByTask.set(d.task_id, {
          process_id: d.process_id,
          tipo_codigo: d.tipo_codigo,
          tipo_nome: d.tipo_nome,
        });
      }
    }
    const dupRows = [...dupByTask.entries()].map(([task_id, d]) => {
      const nomeProc = processAssunto.get(d.process_id) || d.process_id;
      const cnj = numeroProcessoByCode.get(d.process_id);
      return {
        organization_id: ORG_ID,
        task_id,
        alert_code: "ALT-DUP-001",
        status: "pending" as const,
        process_id: d.process_id,
        detail: `Tarefa duplicada · Tipo ${d.tipo_nome ?? d.tipo_codigo} · Processo ${nomeProc}${cnj ? ` · CNJ ${cnj}` : ""}`,
      };
    });
    if (dupRows.length > 0) {
      const { error: dupErr } = await supabase
        .from("system_distribution_exceptions")
        .insert(dupRows);
      // Não derruba o batch por causa das exceções (é enriquecimento).
      if (dupErr) console.error("insert de exceções de duplicado falhou:", dupErr.message);
    }
  }

  // ---- 7c) SNAPSHOT de tarefas -> aba Kanban (R5) ----
  // Refresh completo por org (delete + insert). Não derruba o batch em erro.
  try {
    // RBAC por NOME: o multi-modulo dá o NOME do responsável (não o código).
    // Casamos contra system_users (índice normalizado). Match: full_name exato,
    // ou startsWith, ou token exato (ex.: "THAISE" -> "Thaíse Correia").
    const users = (usersRes.data ?? []) as Array<{ id: string; full_name: string | null }>;
    const usersNorm = users
      .filter((u) => u.full_name)
      .map((u) => ({ id: u.id, norm: normalizeNome(u.full_name!) }));
    const idByFullNorm = new Map<string, string>();
    for (const u of usersNorm) if (!idByFullNorm.has(u.norm)) idByFullNorm.set(u.norm, u.id);
    const matchUserId = (name: string): string | null => {
      const n = normalizeNome(name);
      if (!n) return null;
      const exact = idByFullNorm.get(n);
      if (exact) return exact;
      const cand = usersNorm.find(
        (u) => u.norm.startsWith(n + " ") || u.norm.split(" ").includes(n),
      );
      return cand?.id ?? null;
    };
    // Dedup por task_id (a última vista vence).
    const snapByTask = new Map<string, (typeof snapshotRaw)[number]>();
    for (const s of snapshotRaw) snapByTask.set(s.task_id, s);
    const kanbanRows = [...snapByTask.values()].map((s) => {
      const ids = [
        ...new Set(s.respNames.map((nm) => matchUserId(nm)).filter((v): v is string => !!v)),
      ];
      return {
        organization_id: ORG_ID,
        task_id: s.task_id,
        process_id: s.process_id,
        process_nome: processAssunto.get(s.process_id) || null,
        numero_processo: numeroProcessoByCode.get(s.process_id) ?? null,
        tipo_nome: s.tipo_nome,
        situacao: s.situacao,
        situacao_col: normalizeSituacaoCol(s.situacao, s.concluida),
        concluida: s.concluida,
        responsavel_ids: ids,
        responsavel_nomes: s.respNames,
        prazo_previsto: s.prazo_previsto,
        prazo_fatal: s.prazo_fatal,
        synced_at: new Date().toISOString(),
      };
    });
    await supabase.from("system_distribution_kanban_tasks").delete().eq("organization_id", ORG_ID);
    for (let i = 0; i < kanbanRows.length; i += 100) {
      const chunk = kanbanRows.slice(i, i + 100);
      const { error: kErr } = await supabase.from("system_distribution_kanban_tasks").insert(chunk);
      if (kErr) {
        console.error("insert do snapshot Kanban falhou:", kErr.message);
        break;
      }
    }
  } catch (err) {
    console.error("snapshot Kanban falhou:", err instanceof Error ? err.message : String(err));
  }

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

  // H4: resumo inclui os alertas pre-batch (ALT-TEMA-001) — antes o tema nao
  // mapeado sumia sem rastro; agora aparece contabilizado no resumo do front.
  const alerts = Object.entries(mergedAlertsSummary)
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
