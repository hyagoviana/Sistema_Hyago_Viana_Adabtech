// RPC (server-only, Node) — Sincronizacao SOB DEMANDA do Motor de Distribuicao.
//
// Dispara o MESMO motor puro do cron (engine/motor.distributeBatch) a partir de
// um botao na tela, sem depender da Edge Function / pg_cron. Toda a logica vive
// em src/lib/distribuicao/sync-core.ts (runSync) — reusada tambem por scripts
// (scripts/run-sincronizar.ts) e pelo cron futuro. Aqui fica so o wrapper HTTP +
// o gate de permissao.
//
// REGRA CRITICA: ZERO writeback ao ProJuris (ver sync-core).

import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { AuthError, requireModule } from "@/lib/supabase/auth-guard";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { runSync, ymd, ORG_ID, type SyncSummary } from "@/lib/distribuicao/sync-core";
import { syncTaskTypesCore, type SyncTaskTypesResult } from "@/lib/distribuicao/sync-task-types";
import { fetchProcessoDetalhe, type ProcessoDetalhe } from "@/lib/projuris/processo-detalhe";

export type { SyncSummary } from "@/lib/distribuicao/sync-core";
export type { SyncTaskTypesResult } from "@/lib/distribuicao/sync-task-types";
export type { ProcessoDetalhe } from "@/lib/projuris/processo-detalhe";

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

// ---------------------------------------------------------------------------
// R2 — DETALHE COMPLETO do processo (drawer da Lista). LÊ o ProJuris ao vivo
// (resumo + envolvidos + tarefas + documentos). Só leitura. Gate: controladoria
// (view). Degrada para { ok:false, erro } se o ProJuris estiver indisponível.
// ---------------------------------------------------------------------------
export const getProcessoDetalheFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ codigoProcesso: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<ProcessoDetalhe> => {
    try {
      await requireModule("controladoria", "view");
      return await fetchProcessoDetalhe(data.codigoProcesso);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err instanceof Error ? new Error(err.message) : new Error(String(err));
    }
  });

// ---------------------------------------------------------------------------
// R5 — KANBAN de tarefas (snapshot do sync). RBAC: admin vê TODAS; não-admin só
// as tarefas onde o seu id está em responsavel_ids. Só leitura. Gate:
// controladoria (view). A UI agrupa por situacao_col.
// ---------------------------------------------------------------------------
export type KanbanTask = {
  id: string;
  task_id: string;
  process_id: string | null;
  process_nome: string | null;
  numero_processo: string | null;
  tipo_nome: string | null;
  situacao: string | null;
  situacao_col: string;
  concluida: boolean;
  responsavel_nomes: string[];
  prazo_previsto: string | null;
  prazo_fatal: string | null;
};

export const listKanbanTasksFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<KanbanTask[]> => {
    try {
      const { id: userId, role } = await requireModule("controladoria", "view");
      const isAdmin = role === "admin";
      const sb = getSupabaseAdmin();
      let q = sb
        .from("system_distribution_kanban_tasks")
        .select(
          "id, task_id, process_id, process_nome, numero_processo, tipo_nome, situacao, situacao_col, concluida, responsavel_nomes, prazo_previsto, prazo_fatal",
        )
        .eq("organization_id", ORG_ID)
        .order("prazo_fatal", { nullsFirst: false });
      // RBAC: não-admin só vê as tarefas vinculadas ao seu nome (responsavel_ids).
      if (!isAdmin) q = q.contains("responsavel_ids", [userId]);
      const { data, error } = await q;
      if (error) throw new AuthError(error.message, 500);
      return (data ?? []) as KanbanTask[];
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err instanceof Error ? new Error(err.message) : new Error(String(err));
    }
  },
);

// ---------------------------------------------------------------------------
// CALENDÁRIO — tarefas distribuídas de UM dia (por final_date), com RBAC:
//   • admin  → vê as tarefas de TODOS os executores;
//   • demais → vê SÓ as suas (executor_id = próprio system_users.id).
// O executor_id nos resultados é FK direto p/ system_users, então o filtro por
// usuário é trivial. Só leitura. Gate: módulo controladoria (view).
// ---------------------------------------------------------------------------
export type CalendarTask = {
  id: string;
  task_id: string;
  nome_processo: string | null;
  numero_processo: string | null;
  tipo_nome: string | null;
  flow: string;
  final_date: string | null;
  executor_id: string | null;
  executor_nome: string | null;
};

export const listDistributionTasksByDayFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date deve ser YYYY-MM-DD") })
      .parse(d),
  )
  .handler(async ({ data }): Promise<CalendarTask[]> => {
    try {
      const { id: userId, role } = await requireModule("controladoria", "view");
      const isAdmin = role === "admin";
      const sb = getSupabaseAdmin();

      let q = sb
        .from("system_distribution_results")
        .select("id, task_id, flow, final_date, executor_id, raw_data")
        .eq("organization_id", ORG_ID)
        .eq("final_date", data.date)
        .eq("blocked", false)
        .order("executor_id");
      // RBAC: não-admin só enxerga as próprias tarefas.
      if (!isAdmin) q = q.eq("executor_id", userId);

      const { data: rows, error } = await q;
      if (error) throw new AuthError(error.message, 500);

      // De-para executor_id → nome (system_users). Uma query só.
      const execIds = [
        ...new Set((rows ?? []).map((r) => r.executor_id).filter((v): v is string => !!v)),
      ];
      const nameById = new Map<string, string>();
      if (execIds.length) {
        const { data: users } = await sb
          .from("system_users")
          .select("id, full_name")
          .in("id", execIds);
        for (const u of users ?? []) if (u.full_name) nameById.set(u.id, u.full_name);
      }

      return (rows ?? []).map((r) => {
        const rd = (r.raw_data ?? {}) as {
          nome_processo?: string | null;
          numero_processo?: string | null;
          tipo_nome?: string | null;
        };
        return {
          id: r.id,
          task_id: r.task_id,
          nome_processo: rd.nome_processo ?? null,
          numero_processo: rd.numero_processo ?? null,
          tipo_nome: rd.tipo_nome ?? null,
          flow: r.flow,
          final_date: r.final_date,
          executor_id: r.executor_id,
          executor_nome: r.executor_id ? (nameById.get(r.executor_id) ?? null) : null,
        };
      });
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err instanceof Error ? new Error(err.message) : new Error(String(err));
    }
  });

// ---------------------------------------------------------------------------
// CALENDÁRIO — contagem de tarefas por DIA de um mês (para pintar um selo nos
// dias que têm tarefa). Mesmo RBAC do dia: admin conta as de TODOS; demais só
// as suas. Só leitura. Gate: controladoria (view).
// ---------------------------------------------------------------------------
export const getDistributionMonthCountsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Record<string, number>> => {
    try {
      const { id: userId, role } = await requireModule("controladoria", "view");
      const isAdmin = role === "admin";
      const sb = getSupabaseAdmin();

      const mm = String(data.month).padStart(2, "0");
      const firstDay = `${data.year}-${mm}-01`;
      const lastDayNum = new Date(data.year, data.month, 0).getDate();
      const lastDay = `${data.year}-${mm}-${String(lastDayNum).padStart(2, "0")}`;

      let q = sb
        .from("system_distribution_results")
        .select("final_date")
        .eq("organization_id", ORG_ID)
        .eq("blocked", false)
        .gte("final_date", firstDay)
        .lte("final_date", lastDay);
      if (!isAdmin) q = q.eq("executor_id", userId);

      const { data: rows, error } = await q;
      if (error) throw new AuthError(error.message, 500);

      const counts: Record<string, number> = {};
      for (const r of rows ?? []) {
        if (r.final_date) counts[r.final_date] = (counts[r.final_date] ?? 0) + 1;
      }
      return counts;
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err instanceof Error ? new Error(err.message) : new Error(String(err));
    }
  });

// H6: Sincronizar TIPOS de tarefa do ProJuris (de-para por nome, so leitura no
// ProJuris; escrita apenas dos codigos/descricoes no nosso banco). Idempotente.
export const sincronizarTiposTarefaFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<SyncTaskTypesResult> => {
    try {
      await requireModule("controladoria", "edit");
      return await syncTaskTypesCore();
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err instanceof Error ? new Error(err.message) : new Error(String(err));
    }
  },
);
