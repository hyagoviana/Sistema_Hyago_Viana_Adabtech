import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import {
  listCaseTasksFn,
  createCaseTaskFn,
  setCaseTaskStatusFn,
  deleteCaseTaskFn,
  listCaseDeadlinesFn,
  createCaseDeadlineFn,
  setCaseDeadlineStatusFn,
  deleteCaseDeadlineFn,
  listCaseCommunicationsFn,
  createCaseCommunicationFn,
  deleteCaseCommunicationFn,
  listAllTasksFn,
  listAllDeadlinesFn,
  listWorkItemsFn,
} from "@/rpc/dossie";

export type WorkItemFilters = {
  assigneeId?: string | null;
  caseId?: string | null;
  status?: string | null;
  search?: string | null;
  // Doc 31.08 — filtros da tela de Tarefas.
  temaId?: string | null;
  taskTypeId?: string | null;
  priority?: string | null;
  /** Padrão false: checklist ficou só na página do caso (doc 31.08). */
  incluirChecklist?: boolean;
};

// Agregação "Tarefas": por padrão SÓ tarefas (com RBAC); checklist só se pedido.
export function useWorkItems(filters: WorkItemFilters) {
  const fn = useServerFn(listWorkItemsFn);
  return useQuery({
    queryKey: ["work-items", filters],
    queryFn: () => fn({ data: filters }),
    staleTime: 60 * 1000,
  });
}

// ----------------------------------------------- Agregação global (Tarefas) ----
export function useAllTasks() {
  const fn = useServerFn(listAllTasksFn);
  return useQuery({
    queryKey: ["all-tasks"],
    queryFn: () => fn(),
    staleTime: 3 * 60 * 1000, // 3 min — dados globais pesados
  });
}

export function useAllDeadlines() {
  const fn = useServerFn(listAllDeadlinesFn);
  return useQuery({
    queryKey: ["all-deadlines"],
    queryFn: () => fn(),
    staleTime: 3 * 60 * 1000,
  });
}

// ---------------------------------------------------------------- Tarefas ----
export function useCaseTasks(caseId: string) {
  const fn = useServerFn(listCaseTasksFn);
  return useQuery({
    queryKey: ["case-tasks", caseId],
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

export function useCreateCaseTask(caseId: string) {
  const fn = useServerFn(createCaseTaskFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      case_id: string;
      title: string;
      priority?: string;
      assignee?: string | null;
      assignee_id?: string | null;
      due_date?: string | null;
      task_type_id?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-tasks", caseId] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}

export function useSetCaseTaskStatus(caseId: string) {
  const fn = useServerFn(setCaseTaskStatusFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: string }) => fn({ data: vars }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["case-tasks", caseId] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });

      // Espelho no ProJuris (2026-08-27). Só fala quando há o que dizer: a
      // esmagadora maioria das tarefas só existe no SHV, e avisar "não foi para
      // o ProJuris" nesses casos seria ruído — não é falha, é o normal.
      const esp = (res as { espelho?: { espelhado: boolean; motivo?: string } } | null)?.espelho;
      if (!esp) return;
      if (esp.espelhado) {
        toast.success("Concluída aqui e no ProJuris");
      } else if (esp.motivo && esp.motivo !== "tarefa só existe no SHV") {
        // Aviso, não erro: a conclusão no SHV foi gravada de qualquer forma.
        toast.warning(`Concluída aqui, mas não refletiu no ProJuris: ${esp.motivo}`);
      }
    },
  });
}

export function useDeleteCaseTask(caseId: string) {
  const fn = useServerFn(deleteCaseTaskFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-tasks", caseId] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}

// ----------------------------------------------------------------- Prazos ----
export function useCaseDeadlines(caseId: string) {
  const fn = useServerFn(listCaseDeadlinesFn);
  return useQuery({
    queryKey: ["case-deadlines", caseId],
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

export function useCreateCaseDeadline(caseId: string) {
  const fn = useServerFn(createCaseDeadlineFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      case_id: string;
      title: string;
      fatal_date: string;
      recommended_date?: string | null;
      tipo?: string | null;
      responsible?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-deadlines", caseId] });
      qc.invalidateQueries({ queryKey: ["all-deadlines"] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}

export function useSetCaseDeadlineStatus(caseId: string) {
  const fn = useServerFn(setCaseDeadlineStatusFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: string }) => fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-deadlines", caseId] });
      qc.invalidateQueries({ queryKey: ["all-deadlines"] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}

export function useDeleteCaseDeadline(caseId: string) {
  const fn = useServerFn(deleteCaseDeadlineFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-deadlines", caseId] });
      qc.invalidateQueries({ queryKey: ["all-deadlines"] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}

// ------------------------------------------------------------ Comunicações ----
export function useCaseCommunications(caseId: string) {
  const fn = useServerFn(listCaseCommunicationsFn);
  return useQuery({
    queryKey: ["case-comms", caseId],
    queryFn: () => fn({ data: { caseId } }),
    enabled: !!caseId,
  });
}

export function useCreateCaseCommunication(caseId: string) {
  const fn = useServerFn(createCaseCommunicationFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      case_id: string;
      summary: string;
      channel?: string;
      direction?: string;
      contact?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-comms", caseId] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}

export function useDeleteCaseCommunication(caseId: string) {
  const fn = useServerFn(deleteCaseCommunicationFn);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case-comms", caseId] });
      qc.invalidateQueries({ queryKey: ["cases", "events", caseId] });
    },
  });
}
