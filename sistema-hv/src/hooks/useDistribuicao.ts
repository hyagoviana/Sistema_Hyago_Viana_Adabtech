/**
 * Hook: useDistribuicao — Queries e mutations para o Motor de Distribuicao
 *
 * Gerencia calendario, executores, mapeamentos, config e resultados.
 * Epic 4 — Stories 4.1 a 4.5
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Calendario (Story 4.1)
// ---------------------------------------------------------------------------

export function useCalendarBlocks(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  return useQuery({
    queryKey: ["distribution-calendar", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_calendar")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .eq("organization_id", ORG_ID);
      if (error) throw error;
      return data;
    },
  });
}

export function useCalendarBlocksYear(year: number) {
  return useQuery({
    queryKey: ["distribution-calendar-year", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_calendar")
        .select("*")
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`)
        .eq("organization_id", ORG_ID)
        .order("date");
      if (error) throw error;
      return data;
    },
  });
}

export function useAddCalendarBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (blocks: Array<{ date: string; block_type: string; executor_id?: string; reason?: string }>) => {
      const rows = blocks.map((b) => ({ ...b, organization_id: ORG_ID }));
      const { error } = await supabase.from("system_distribution_calendar").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["distribution-calendar"] }),
  });
}

export function useRemoveCalendarBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_distribution_calendar").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["distribution-calendar"] }),
  });
}

// ---------------------------------------------------------------------------
// Executores (Story 4.2)
// ---------------------------------------------------------------------------

export function useExecutorMappings() {
  return useQuery({
    queryKey: ["executor-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_projuris_executor_mapping")
        .select("*, system_users!executor_id(id, full_name, email)")
        .eq("organization_id", ORG_ID)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertExecutorMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mapping: Record<string, unknown>) => {
      const { error } = await supabase
        .from("system_projuris_executor_mapping")
        .upsert({ ...mapping, organization_id: ORG_ID }, { onConflict: "projuris_responsavel_id,organization_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["executor-mappings"] }),
  });
}

// ---------------------------------------------------------------------------
// Task Type Mapping (Story 4.3)
// ---------------------------------------------------------------------------

export function useTaskTypeMappings() {
  return useQuery({
    queryKey: ["task-type-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_task_type_mapping")
        .select("*")
        .eq("organization_id", ORG_ID)
        .order("projuris_tipo_codigo");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertTaskTypeMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mapping: Record<string, unknown>) => {
      const { error } = await supabase
        .from("system_task_type_mapping")
        .upsert({ ...mapping, organization_id: ORG_ID }, { onConflict: "projuris_tipo_codigo,organization_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-type-mappings"] }),
  });
}

// ---------------------------------------------------------------------------
// Theme Mapping (Story 4.4)
// ---------------------------------------------------------------------------

export function useThemeMappings() {
  return useQuery({
    queryKey: ["theme-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_theme_mapping")
        .select("*")
        .eq("organization_id", ORG_ID)
        .order("projuris_tema_codigo");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertThemeMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mapping: Record<string, unknown>) => {
      const { error } = await supabase
        .from("system_theme_mapping")
        .upsert({ ...mapping, organization_id: ORG_ID }, { onConflict: "projuris_tema_codigo,organization_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["theme-mappings"] }),
  });
}

// ---------------------------------------------------------------------------
// Configuracao Geral (Story 4.5)
// ---------------------------------------------------------------------------

export function useDistributionConfig() {
  return useQuery({
    queryKey: ["distribution-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_config")
        .select("*")
        .eq("organization_id", ORG_ID)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateDistributionConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: { mode?: string; batch_hour?: number }) => {
      const { error } = await supabase
        .from("system_distribution_config")
        .update({ ...config, updated_at: new Date().toISOString() })
        .eq("organization_id", ORG_ID);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["distribution-config"] }),
  });
}

export function useLastBatchLog() {
  return useQuery({
    queryKey: ["last-batch-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_batch_logs")
        .select("*")
        .eq("organization_id", ORG_ID)
        .order("batch_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useAlertsSummary30d() {
  return useQuery({
    queryKey: ["alerts-summary-30d"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("system_distribution_results")
        .select("alerts")
        .eq("organization_id", ORG_ID)
        .gte("distribution_date", fromDate)
        .not("alerts", "eq", "{}");
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        for (const code of row.alerts ?? []) {
          counts[code] = (counts[code] ?? 0) + 1;
        }
      }
      return counts;
    },
  });
}
