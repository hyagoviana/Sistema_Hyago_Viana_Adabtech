import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

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
} from "@/lib/dossie-service";

function handle<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    if (err instanceof DossieServiceError) {
      setResponseStatus(err.status);
      throw new Error(err.message);
    }
    setResponseStatus(500);
    throw err;
  });
}

// ---------------------------------------------------------------- Tarefas ----
export const listCaseTasksFn = createServerFn({ method: "GET" })
  .inputValidator((d: { caseId: string }) => d)
  .handler(async ({ data }) => handle(() => listCaseTasks(data.caseId)));

export const createCaseTaskFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      case_id: string;
      title: string;
      priority?: string;
      assignee?: string | null;
      due_date?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => handle(() => createCaseTask(data)));

export const setCaseTaskStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) => handle(() => setCaseTaskStatus(data.id, data.status)));

export const deleteCaseTaskFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => handle(() => deleteCaseTask(data.id)));

// ----------------------------------------------------------------- Prazos ----
export const listCaseDeadlinesFn = createServerFn({ method: "GET" })
  .inputValidator((d: { caseId: string }) => d)
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
  .handler(async ({ data }) => handle(() => createCaseDeadline(data)));

export const setCaseDeadlineStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) => handle(() => setCaseDeadlineStatus(data.id, data.status)));

export const deleteCaseDeadlineFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => handle(() => deleteCaseDeadline(data.id)));

// ------------------------------------------------------------ Comunicações ----
export const listCaseCommunicationsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { caseId: string }) => d)
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
  .handler(async ({ data }) => handle(() => createCaseCommunication(data)));

export const deleteCaseCommunicationFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => handle(() => deleteCaseCommunication(data.id)));

// ----------------------------------------------------- Agregação global ----
export const listAllTasksFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listAllTasks()),
);

export const listAllDeadlinesFn = createServerFn({ method: "GET" }).handler(async () =>
  handle(() => listAllDeadlines()),
);
