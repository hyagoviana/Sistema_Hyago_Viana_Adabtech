/**
 * Hook: useDistribuicao — Queries e mutations para o Motor de Distribuicao
 *
 * Gerencia calendario, executores, mapeamentos, config e resultados.
 * Epic 4 — Stories 4.1 a 4.5
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getDistributionCredsFn,
  saveDistributionCredsFn,
  updateDistributionConfigFn,
  setDistributionActiveFn,
  type DistributionCredsView,
} from "@/rpc/distribuicao-config";
import {
  sincronizarTiposTarefaFn,
  listDistributionTasksByDayFn,
  getDistributionMonthCountsFn,
  type SyncTaskTypesResult,
  type CalendarTask,
} from "@/rpc/distribuicao";
import {
  aprovarTarefaFn,
  rejeitarTarefaFn,
  editarExecutorFn,
  aprovarBatchFn,
} from "@/rpc/distribuicao-aprovacao";
import {
  previewWritebackFn,
  efetivarWritebackFn,
  type WritebackSummary,
} from "@/rpc/distribuicao-writeback";

export type { SyncTaskTypesResult };
export type { WritebackSummary };
export type { CalendarTask };

// Tarefas distribuídas de UM dia (por final_date), já filtradas por RBAC no
// servidor (admin vê todas; demais só as próprias). `enabled` liga a query só
// quando o usuário clica num dia.
export function useDistributionTasksByDay(date: string | null, enabled = true) {
  const fn = useServerFn(listDistributionTasksByDayFn);
  return useQuery({
    queryKey: ["distribution-tasks-day", date],
    queryFn: () => fn({ data: { date: date! } }),
    enabled: !!date && enabled,
  });
}

// Contagem de tarefas por dia do MÊS (RBAC no servidor) — pinta o selo nos dias
// que têm tarefa. Retorna { "YYYY-MM-DD": qtd }.
export function useDistributionMonthCounts(year: number, month: number) {
  const fn = useServerFn(getDistributionMonthCountsFn);
  return useQuery({
    queryKey: ["distribution-month-counts", year, month],
    queryFn: () => fn({ data: { year, month } }),
  });
}

const supabase = getSupabaseBrowserClient();

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
    mutationFn: async (
      blocks: Array<{ date: string; block_type: string; executor_id?: string; reason?: string }>,
    ) => {
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
        .upsert({ ...mapping, organization_id: ORG_ID } as never, {
          onConflict: "projuris_responsavel_id,organization_id",
        });
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
        .upsert({ ...mapping, organization_id: ORG_ID } as never, {
          onConflict: "projuris_tipo_codigo,organization_id",
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-type-mappings"] }),
  });
}

/**
 * H6: dispara a sincronizacao de TIPOS de tarefa do ProJuris (de-para por nome).
 * So leitura no ProJuris; escreve os codigos/descricoes no nosso banco. Idempotente.
 */
export function useSyncTaskTypes() {
  const fn = useServerFn(sincronizarTiposTarefaFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn(),
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
        .upsert({ ...mapping, organization_id: ORG_ID } as never, {
          onConflict: "projuris_tema_codigo,organization_id",
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["theme-mappings"] }),
  });
}

// ---------------------------------------------------------------------------
// Configuracao Geral (Story 4.5)
// ---------------------------------------------------------------------------

// Config GERAL (mode/batch_hour) — SEM segredos. Os campos de credencial de
// segredo (password/token/api_key) NAO sao mais lidos pelo browser client (H11):
// a leitura passa por getDistributionCredsFn (service_role), que devolve so flags
// "tem valor". Selecionamos colunas explicitas p/ garantir que nenhum segredo
// trafega pro front por esta query.
export function useDistributionConfig() {
  return useQuery({
    queryKey: ["distribution-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_distribution_config")
        .select(
          "id, organization_id, mode, batch_hour, active, updated_at, pontos_dia_controle, pontos_dia_producao, projuris_writeback_ativo",
        )
        .eq("organization_id", ORG_ID)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// mode/batch_hour agora vão por SERVER FN (updateDistributionConfigFn) com gate
// requireModule("controladoria","edit"). O browser client não escreve mais na
// config (a RLS foi fechada — ver migration de segurança).
export function useUpdateDistributionConfig() {
  const qc = useQueryClient();
  const fn = useServerFn(updateDistributionConfigFn);
  return useMutation({
    mutationFn: (config: {
      mode?: "HIGH_PRODUCTION" | "HIGH_CONTROL";
      batch_hour?: number;
      pontos_dia_controle?: number;
      pontos_dia_producao?: number;
      projuris_writeback_ativo?: boolean;
    }) => fn({ data: config }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["distribution-config"] }),
  });
}

// Liga/desliga o motor em produção (ação crítica) — server fn gateado.
export function useSetDistributionActive() {
  const qc = useQueryClient();
  const fn = useServerFn(setDistributionActiveFn);
  return useMutation({
    mutationFn: (active: boolean) => fn({ data: { active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["distribution-config"] }),
  });
}

// ---------------------------------------------------------------------------
// Credenciais ProJuris (H11) — leitura SEM segredos + gravacao write-only
// ---------------------------------------------------------------------------

export type { DistributionCredsView };

/** Le a config de credenciais SEM os segredos (so flags "tem valor"). */
export function useDistributionCreds() {
  const fn = useServerFn(getDistributionCredsFn);
  return useQuery<DistributionCredsView>({
    queryKey: ["distribution-creds"],
    queryFn: () => fn(),
  });
}

/**
 * Grava as credenciais (write-only p/ segredos, gate admin no servidor). Campos
 * de segredo em branco/ausentes NAO sobrescrevem o valor gravado; `null` limpa.
 */
export function useSaveDistributionCreds() {
  const fn = useServerFn(saveDistributionCredsFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      projuris_base_url: string;
      projuris_auth_type: string;
      projuris_username?: string | null;
      projuris_password?: string | null;
      projuris_token?: string | null;
      projuris_api_key?: string | null;
    }) => fn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["distribution-creds"] }),
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

// ---------------------------------------------------------------------------
// Aprovacao da distribuicao (Story H2) — estado satelite + mutations.
// So tarefas 'approved' ficam elegiveis a efetivacao/writeback (H3).
// ---------------------------------------------------------------------------

export type DistributionApprovalRow = {
  id: string;
  distribution_result_id: string;
  status: "pending" | "approved" | "rejected";
  decided_by: string | null;
  decided_at: string | null;
  reason: string | null;
  original_executor_id: string | null;
  override_executor_id: string | null;
};

/** Estado de aprovacao das tarefas de uma data (mapa result_id -> row). */
export function useDistributionApprovals(date: string) {
  return useQuery({
    queryKey: ["distribution-approvals", date],
    queryFn: async () => {
      // Junta approvals -> results da data (via FK) para escopar por dia sem
      // um IN(...) de ids gigante.
      const { data, error } = await supabase
        .from("system_distribution_approvals")
        .select(
          "id, distribution_result_id, status, decided_by, decided_at, reason, original_executor_id, override_executor_id, system_distribution_results!distribution_result_id(distribution_date)",
        )
        .eq("organization_id", ORG_ID);
      if (error) throw error;
      const byResultId: Record<string, DistributionApprovalRow> = {};
      for (const row of (data ?? []) as Array<
        DistributionApprovalRow & {
          system_distribution_results?: { distribution_date?: string } | null;
        }
      >) {
        if (row.system_distribution_results?.distribution_date === date) {
          byResultId[row.distribution_result_id] = row;
        }
      }
      return byResultId;
    },
    staleTime: 30 * 1000,
  });
}

function useInvalidateApprovals() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["distribution-approvals"] });
}

export function useAprovarTarefa() {
  const fn = useServerFn(aprovarTarefaFn);
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (resultId: string) => fn({ data: { resultId } }),
    onSuccess: invalidate,
  });
}

export function useRejeitarTarefa() {
  const fn = useServerFn(rejeitarTarefaFn);
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (vars: { resultId: string; reason?: string }) => fn({ data: vars }),
    onSuccess: invalidate,
  });
}

export function useEditarExecutor() {
  const fn = useServerFn(editarExecutorFn);
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (vars: { resultId: string; overrideExecutorId: string; reason?: string }) =>
      fn({ data: vars }),
    onSuccess: invalidate,
  });
}

export function useAprovarBatch() {
  const fn = useServerFn(aprovarBatchFn);
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (vars: {
      distributionDate: string;
      action: "approve" | "reject";
      reason?: string;
    }) => fn({ data: vars }),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Write-back ao ProJuris (Story H3, RISCO ALTO). Preview = dry-run (nunca
// escreve). Efetivar = irreversível (R1), exige confirmação humana (digitar a
// data). Só tarefas 'approved' (H2) entram. Invalida approvals + results.
// ---------------------------------------------------------------------------

/** Dry-run: monta o plano de write-back sem escrever no ProJuris. */
export function usePreviewWriteback() {
  const fn = useServerFn(previewWritebackFn);
  return useMutation({
    mutationFn: (distributionDate: string) => fn({ data: { distributionDate } }),
  });
}

/** Efetivação REAL (irreversível). confirmText deve ser igual à data. */
export function useEfetivarWriteback() {
  const fn = useServerFn(efetivarWritebackFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { distributionDate: string; confirmText: string }) =>
      fn({ data: { ...vars, confirm: true as const } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["distribution-approvals"] });
      qc.invalidateQueries({ queryKey: ["distribution-results"] });
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
