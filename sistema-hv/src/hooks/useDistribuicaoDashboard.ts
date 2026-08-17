/**
 * Hook: useDistribuicaoDashboard — Queries para o Dashboard de Distribuicao
 * Epic 5 — Stories 5.1 a 5.5
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  sincronizarDistribuicaoFn,
  getProcessoDetalheFn,
  listKanbanTasksFn,
} from "@/rpc/distribuicao";

const supabase = getSupabaseBrowserClient();

const ORG_ID = "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Sincronizacao SOB DEMANDA (botao "Sincronizar") — roda o motor no servidor
// (le ProJuris + grava system_distribution_results/batch_logs) e invalida as
// queries do painel do dia. ZERO writeback ao ProJuris.
// ---------------------------------------------------------------------------
export function useSincronizarDistribuicao() {
  const fn = useServerFn(sincronizarDistribuicaoFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { distributionDate?: string; windowDays?: number }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["distribution-results"] });
      qc.invalidateQueries({ queryKey: ["batch-log"] });
    },
  });
}

// ---------------------------------------------------------------------------
// R2 — Detalhe completo do processo (drawer da Lista). LÊ o ProJuris ao vivo.
// `enabled` só quando o drawer está aberto (evita chamada à toa).
// ---------------------------------------------------------------------------
export function useProcessoDetalhe(codigoProcesso: string | null | undefined) {
  const fn = useServerFn(getProcessoDetalheFn);
  return useQuery({
    queryKey: ["processo-detalhe", codigoProcesso],
    queryFn: () => fn({ data: { codigoProcesso: String(codigoProcesso) } }),
    enabled: !!codigoProcesso,
    staleTime: 60 * 1000,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// R5 — Kanban de tarefas (snapshot do sync, com RBAC no servidor).
// ---------------------------------------------------------------------------
export function useKanbanTasks() {
  const fn = useServerFn(listKanbanTasksFn);
  return useQuery({
    queryKey: ["kanban-tasks"],
    queryFn: () => fn(),
    staleTime: 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Distribuicoes do dia (5.1 + 5.2)
// ---------------------------------------------------------------------------

export function useDistributionResults(
  date: string,
  filters?: { executor?: string; flow?: string[]; hasAlerts?: boolean; page?: number },
) {
  const page = filters?.page ?? 0;
  const offset = page * 50;
  return useQuery({
    queryKey: ["distribution-results", date, filters],
    queryFn: async () => {
      let query = supabase
        .from("system_distribution_results")
        .select("*", { count: "exact" })
        .eq("distribution_date", date)
        .eq("organization_id", ORG_ID)
        .order("final_date")
        .range(offset, offset + 49);

      if (filters?.executor) query = query.eq("executor_id", filters.executor);
      if (filters?.flow?.length) query = query.in("flow", filters.flow);
      if (filters?.hasAlerts) query = query.not("alerts", "eq", "{}");

      const { data, error, count } = await query;
      if (error) throw error;
      return { data, count };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Agregado do DIA INTEIRO (não só a página de 50). Busca todas as linhas do dia
// (colunas mínimas) e calcula fluxo/carga/alertas — corrige o Painel, que antes
// derivava os KPIs de no máximo 50 resultados.
export type DayAggregate = {
  count: number;
  flowCounts: { ABSOLUTE: number; COMPLEX: number; GENERAL: number };
  executorLoads: Array<{ executor_id: string; points: number }>;
  alertRows: Array<{ id: string; task_id: string; alerts: string[]; final_date: string | null }>;
};

export function useDistributionDayAggregate(date: string) {
  return useQuery({
    queryKey: ["distribution-day-aggregate", date],
    queryFn: async (): Promise<DayAggregate> => {
      // A tabela de resultados só guarda NÃO-bloqueadas (as bloqueadas viram
      // exceções); por isso não há filtro de blocked aqui.
      const { data, error } = await supabase
        .from("system_distribution_results")
        .select("id, task_id, flow, executor_id, final_points, alerts, final_date")
        .eq("distribution_date", date)
        .eq("organization_id", ORG_ID);
      if (error) throw error;
      const rows = data ?? [];
      const flowCounts = { ABSOLUTE: 0, COMPLEX: 0, GENERAL: 0 };
      const loads = new Map<string, number>();
      const alertRows: DayAggregate["alertRows"] = [];
      for (const r of rows) {
        if (r.flow in flowCounts) flowCounts[r.flow as keyof typeof flowCounts]++;
        if (r.executor_id)
          loads.set(r.executor_id, (loads.get(r.executor_id) ?? 0) + r.final_points);
        if ((r.alerts?.length ?? 0) > 0) {
          alertRows.push({
            id: r.id,
            task_id: r.task_id,
            alerts: r.alerts ?? [],
            final_date: r.final_date,
          });
        }
      }
      return {
        count: rows.length,
        flowCounts,
        executorLoads: [...loads.entries()]
          .map(([executor_id, points]) => ({ executor_id, points }))
          .sort((a, b) => b.points - a.points),
        alertRows,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useBatchLog(date: string) {
  return useQuery({
    queryKey: ["batch-log", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_batch_logs")
        .select("*")
        .eq("batch_date", date)
        .eq("organization_id", ORG_ID)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Excecoes (5.3)
// ---------------------------------------------------------------------------

export function usePendingExceptions() {
  return useQuery({
    queryKey: ["pending-exceptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_exceptions")
        .select(
          "*, system_distribution_results!distribution_result_id(task_id, process_id, final_date, alerts, flow)",
        )
        .eq("organization_id", ORG_ID)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

export function usePendingExceptionCount() {
  return useQuery({
    queryKey: ["pending-exception-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("system_count_pending_exceptions", {
        p_org_id: ORG_ID,
      });
      if (error) throw error;
      return data as number;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useResolveException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      status: string;
      manual_executor_id?: string;
      override_reason?: string;
      ignore_reason?: string;
    }) => {
      // action_by = quem resolveu (auditoria); antes ficava sempre nulo.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("system_distribution_exceptions")
        .update({
          status: params.status,
          manual_executor_id: params.manual_executor_id,
          override_reason: params.override_reason,
          ignore_reason: params.ignore_reason,
          action_by: user?.id ?? null,
          action_at: new Date().toISOString(),
        })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-exceptions"] });
      qc.invalidateQueries({ queryKey: ["pending-exception-count"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Historico de batches (5.4)
// ---------------------------------------------------------------------------

export function useBatchHistory(startDate: string, endDate: string, page = 0) {
  return useQuery({
    queryKey: ["batch-history", startDate, endDate, page],
    queryFn: async () => {
      const offset = page * 30;
      const { data, error, count } = await supabase
        .from("system_distribution_batch_logs")
        .select("*", { count: "exact" })
        .gte("batch_date", startDate)
        .lte("batch_date", endDate)
        .eq("organization_id", ORG_ID)
        .order("batch_date", { ascending: false })
        .range(offset, offset + 29);
      if (error) throw error;
      return { data, count };
    },
  });
}

// KPIs do histórico sobre o PERÍODO INTEIRO (não só a página de 30). Busca só as
// colunas necessárias de todos os batches do intervalo e agrega.
export type BatchHistoryStats = {
  total: number;
  successRate: number;
  avgTasks: number;
  avgDuration: number;
};

export function useBatchHistoryStats(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["batch-history-stats", startDate, endDate],
    queryFn: async (): Promise<BatchHistoryStats> => {
      const { data, error } = await supabase
        .from("system_distribution_batch_logs")
        .select("status, total_tasks, metrics")
        .gte("batch_date", startDate)
        .lte("batch_date", endDate)
        .eq("organization_id", ORG_ID);
      if (error) throw error;
      const rows = data ?? [];
      const total = rows.length;
      if (total === 0) return { total: 0, successRate: 0, avgTasks: 0, avgDuration: 0 };
      const success = rows.filter((b) => b.status === "completed").length;
      const avgTasks = Math.round(rows.reduce((s, b) => s + (b.total_tasks ?? 0), 0) / total);
      const withDur = rows.filter(
        (b) => (b.metrics as { duration_ms?: number } | null)?.duration_ms,
      );
      const avgDuration = withDur.length
        ? Math.round(
            withDur.reduce(
              (s, b) => s + ((b.metrics as { duration_ms?: number } | null)?.duration_ms ?? 0),
              0,
            ) /
              withDur.length /
              1000,
          )
        : 0;
      return { total, successRate: Math.round((success / total) * 100), avgTasks, avgDuration };
    },
  });
}

// ---------------------------------------------------------------------------
// Indicadores (5.5)
// ---------------------------------------------------------------------------

export function useM90() {
  return useQuery({
    queryKey: ["m90"],
    queryFn: async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const from = ninetyDaysAgo.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("system_distribution_results")
        .select("distribution_date, final_points")
        .eq("organization_id", ORG_ID)
        .gte("distribution_date", from)
        .eq("blocked", false);
      if (error) throw error;
      const daily = new Map<string, number>();
      for (const r of data ?? []) {
        daily.set(r.distribution_date, (daily.get(r.distribution_date) ?? 0) + r.final_points);
      }
      const daysWithProd = [...daily.values()].filter((v) => v > 0);
      if (daysWithProd.length === 0) return 0;
      return (
        Math.round((daysWithProd.reduce((s, v) => s + v, 0) / daysWithProd.length) * 100) / 100
      );
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function usePreferenceRate(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["preference-rate", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("system_get_preference_rate", {
        p_org_id: ORG_ID,
        p_start: startDate,
        p_end: endDate,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
}

export function useLoadDeviation(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["load-deviation", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("system_get_load_deviation", {
        p_org_id: ORG_ID,
        p_start: startDate,
        p_end: endDate,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
}

export function useDailyProduction(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["daily-production", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_results")
        .select("distribution_date, executor_id, final_points, final_date")
        .eq("organization_id", ORG_ID)
        .gte("distribution_date", startDate)
        .lte("distribution_date", endDate)
        .eq("blocked", false);
      if (error) throw error;
      return data;
    },
  });
}
