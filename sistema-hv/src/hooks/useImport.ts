import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { queryKeys } from "@/lib/queryKeys";
import type { ColumnMapping, ImportExecuteInput, ImportTemplateCreateInput } from "@/lib/validators/import";
import {
  createImportTemplateFn,
  deleteImportTemplateFn,
  executeImportFn,
  listImportRunsFn,
  listImportTemplatesFn,
} from "@/rpc/import";

// Tipos locais — serao substituidos quando regenerar types apos migration.
export type ImportTemplateRow = {
  id: string;
  name: string;
  source_system: string | null;
  target_entity: string;
  column_mappings: ColumnMapping[];
  settings: Record<string, unknown>;
  created_at: string;
};

export type ImportRunRow = {
  id: string;
  file_name: string;
  target_entity: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  error_rows: number;
  status: string;
  created_at: string;
};

// ----------------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------------
export function useImportTemplates() {
  const fn = useServerFn(listImportTemplatesFn);
  return useQuery<ImportTemplateRow[]>({
    queryKey: queryKeys.import_.templates(),
    queryFn: () => fn({ data: {} }) as Promise<ImportTemplateRow[]>,
    staleTime: 5 * 60 * 1000,
  });
}

export function useImportRuns() {
  const fn = useServerFn(listImportRunsFn);
  return useQuery<ImportRunRow[]>({
    queryKey: queryKeys.import_.runs(),
    queryFn: () => fn({ data: {} }) as Promise<ImportRunRow[]>,
    staleTime: 60 * 1000,
  });
}

// ----------------------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------------------
export function useCreateImportTemplate() {
  const fn = useServerFn(createImportTemplateFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportTemplateCreateInput) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.import_.templates() });
    },
  });
}

export function useDeleteImportTemplate() {
  const fn = useServerFn(deleteImportTemplateFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.import_.templates() });
    },
  });
}

export function useExecuteImport() {
  const fn = useServerFn(executeImportFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportExecuteInput) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clients.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.cases.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.import_.runs() });
    },
  });
}
