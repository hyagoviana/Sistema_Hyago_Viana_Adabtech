/**
 * Hook: useDistribuicaoDashboard — Queries para o Dashboard de Distribuicao
 * Epic 5 — Stories 5.1 a 5.5
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Distribuicoes do dia (5.1 + 5.2)
// ---------------------------------------------------------------------------

export function useDistributionResults(date: string, filters?: { executor?: string; flow?: string[]; hasAlerts?: boolean; page?: number }) {
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
        .select("*, system_distribution_results!distribution_result_id(task_id, process_id, final_date, alerts, flow)")
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
      const { data, error } = await supabase.rpc("system_count_pending_exceptions", { p_org_id: ORG_ID });
      if (error) throw error;
      return data as number;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useResolveException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; status: string; manual_executor_id?: string; override_reason?: string; ignore_reason?: string }) => {
      const { error } = await supabase
        .from("system_distribution_exceptions")
        .update({ status: params.status, manual_executor_id: params.manual_executor_id, override_reason: params.override_reason, ignore_reason: params.ignore_reason, action_at: new Date().toISOString() })
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

// ---------------------------------------------------------------------------
// Indicadores (5.5)
// ---------------------------------------------------------------------------

export function useM90() {
  return useQuery({
    queryKey: ["m90"],
    queryFn: async () => {
      const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const from = ninetyDaysAgo.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("system_distribution_results")
        .select("distribution_date, final_points")
        .eq("organization_id", ORG_ID)
        .gte("distribution_date", from)
        .eq("blocked", false);
      if (error) throw error;
      const daily = new Map<string, number>();
      for (const r of data ?? []) { daily.set(r.distribution_date, (daily.get(r.distribution_date) ?? 0) + r.final_points); }
      const daysWithProd = [...daily.values()].filter(v => v > 0);
      if (daysWithProd.length === 0) return 0;
      return Math.round(daysWithProd.reduce((s, v) => s + v, 0) / daysWithProd.length * 100) / 100;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function usePreferenceRate(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["preference-rate", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("system_get_preference_rate", { p_org_id: ORG_ID, p_start: startDate, p_end: endDate });
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
}

export function useLoadDeviation(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["load-deviation", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("system_get_load_deviation", { p_org_id: ORG_ID, p_start: startDate, p_end: endDate });
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
        .select("distribution_date, executor_id, final_points")
        .eq("organization_id", ORG_ID)
        .gte("distribution_date", startDate)
        .lte("distribution_date", endDate)
        .eq("blocked", false);
      if (error) throw error;
      return data;
    },
  });
}
