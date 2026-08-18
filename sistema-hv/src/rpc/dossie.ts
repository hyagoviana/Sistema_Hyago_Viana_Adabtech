import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  DossieServiceError,
  listCaseTasks,
  createCaseTask,
  setCaseTaskStatus,
  deleteCaseTask,
  listCaseDeadlines,
  createCaseDeadline,
  setCaseDeadlineStatus,
  deleteCaseDeadline,
  listCaseCommunications,
  createCaseCommunication,
  deleteCaseCommunication,
  listAllTasks,
  listAllDeadlines,
  listWorkItems,
} from "@/lib/dossie-service";
import { AuthError, requireAuth, requireModule } from "@/lib/supabase/auth-guard";
import { runWorkflowsFor } from "@/lib/workflow-engine";

const caseIdSchema = z.object({ caseId: z.string().uuid() });
const idSchema = z.object({ id: z.string().uuid() });

function run<T>(
  guard: () => Promise<{ id: string }>,
  fn: (userId: string) => Promise<T>,
): Promise<T> {
  return (async () => {
    try {
      const { id } = await guard();
      return await fn(id);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      if (err instanceof DossieServiceError) {
        setResponseStatus(err.status);
        throw new Error(err.message);
      }
      setResponseStatus(500);
      throw err;
    }
  })();
}

// Leitura: qualquer autenticado.
const handle = <T>(fn: (userId: string) => Promise<T>) => run(() => requireAuth(), fn);
// Escrita (criar/editar/excluir tarefa/prazo/comunicação) = operacional:edit.
const handleWrite = <T>(fn: (userId: string) => Promise<T>) =>
  run(() => requireModule("operacional", "edit"), fn);

// Agregação "Tarefas": tarefas + checklist do colaborador, com RBAC + filtros.
const workItemsSchema = z
  .object({
    assigneeId: z.string().uuid().nullish(),
    caseId: z.string().uuid().nullish(),
    status: z.string().nullish(),
    search: z.string().nullish(),
  })
  .default({});

export const listWorkItemsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => workItemsSchema.parse(d ?? {}))
  .handler(async ({ data }) => handle((userId) => listWorkItems(userId, data)));

// ---------------------------------------------------------------- Tarefas ----
export const listCaseTasksFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => caseIdSchema.parse(data))
  .handler(async ({ data }) => handle(() => listCaseTasks(data.caseId)));

export const createCaseTaskFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      case_id: string;
      title: string;
      priority?: string;
      assignee?: string | null;
      assignee_id?: string | null;
      due_date?: string | null;
    }) => d,
  )
  .handler(async ({ data }) =>
    handleWrite(async (userId) => {
      const task = await createCaseTask(data, userId);
      // #2 Workflows — gatilho task_created (1x por tarefa via event_key).
      // taskTypeId: forward-compat (a coluna de tipo ainda não existe → null; a
      // sub-opção por tipo passa a funcionar assim que o campo for criado).
      if (task?.id) {
        const taskTypeId = (task as { task_type_id?: string | null }).task_type_id ?? null;
        await runWorkflowsFor(
          task.case_id,
          "task_created",
          { taskId: task.id, taskTypeId },
          userId,
        );
      }
      return task;
    }),
  );

export const setCaseTaskStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) =>
    handleWrite(async (userId) => {
      const task = await setCaseTaskStatus(data.id, data.status, userId);
      // #2 Workflows — gatilho task_completed só na conclusão (1x por tarefa).
      if (task?.id && data.status === "CONCLUIDA") {
        const taskTypeId = (task as { task_type_id?: string | null }).task_type_id ?? null;
        await runWorkflowsFor(
          task.case_id,
          "task_completed",
          { taskId: task.id, taskTypeId },
          userId,
        );
      }
      return task;
    }),
  );

export const deleteCaseTaskFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => handleWrite((userId) => deleteCaseTask(data.id, userId)));

// ----------------------------------------------------------------- Prazos ----
export const listCaseDeadlinesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => caseIdSchema.parse(data))
  .handler(async ({ data }) => handle(() => listCaseDeadlines(data.caseId)));

export const createCaseDeadlineFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      case_id: string;
      title: string;
      fatal_date: string;
      recommended_date?: string | null;
      tipo?: string | null;
      responsible?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => handleWrite((userId) => createCaseDeadline(data, userId)));

export const setCaseDeadlineStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) =>
    handleWrite((userId) => setCaseDeadlineStatus(data.id, data.status, userId)),
  );

export const deleteCaseDeadlineFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => handleWrite((userId) => deleteCaseDeadline(data.id, userId)));

// ------------------------------------------------------------ Comunicações ----
export const listCaseCommunicationsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => caseIdSchema.parse(data))
  .handler(async ({ data }) => handle(() => listCaseCommunications(data.caseId)));

export const createCaseCommunicationFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      case_id: string;
      summary: string;
      channel?: string;
      direction?: string;
      contact?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => handleWrite((userId) => createCaseCommunication(data, userId)));

export const deleteCaseCommunicationFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => handleWrite((userId) => deleteCaseCommunication(data.id, userId)));

// ----------------------------------------------------- Agregação global ----
export const listAllTasksFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listAllTasks()),
);

export const listAllDeadlinesFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listAllDeadlines()),
);
