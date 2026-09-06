import { useMemo } from "react";

import { useCasesList } from "./useCases";
import { useAllTasks, useAllDeadlines } from "./useDossie";
import { isTaskAberta } from "@/lib/task-status-shared";

export type ExcItem = {
  id: string;
  caseId: string;
  title: string;
  subtitle: string;
  meta: string;
  tone: "danger" | "warning" | "neutral";
};

export type ExcGroup = {
  key: string;
  label: string;
  hint: string;
  tone: "danger" | "warning" | "neutral";
  items: ExcItem[];
};

function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}
const empty = (v: string | null | undefined) => !v || v.trim() === "";

/**
 * Centro de Exceções — calcula ocorrências a partir dos dados REAIS do Supabase
 * (casos, tarefas e prazos do dossiê). Não depende de ProJuris/IA.
 */
export function useExceptions(): { loading: boolean; total: number; groups: ExcGroup[] } {
  const casosQ = useCasesList();
  const tasksQ = useAllTasks();
  const deadlinesQ = useAllDeadlines();
  const loading = casosQ.isLoading || tasksQ.isLoading || deadlinesQ.isLoading;

  const groups = useMemo<ExcGroup[]>(() => {
    const cases = casosQ.data ?? [];
    const tasks = (tasksQ.data ?? []).filter((t) => isTaskAberta(t.status));
    const deadlines = (deadlinesQ.data ?? []).filter((d) => d.status === "ABERTO");

    const dl = (d: (typeof deadlines)[number], meta: string, tone: ExcItem["tone"]): ExcItem => ({
      id: d.id,
      caseId: d.case_id,
      title: d.title,
      subtitle: `${d.client_name} · ${d.case_code}`,
      meta,
      tone,
    });
    const tk = (t: (typeof tasks)[number], meta: string, tone: ExcItem["tone"]): ExcItem => ({
      id: t.id,
      caseId: t.case_id,
      title: t.title,
      subtitle: `${t.client_name} · ${t.case_code}`,
      meta,
      tone,
    });

    return [
      {
        key: "prazos_vencidos",
        label: "Prazos vencidos",
        hint: "Prazos em aberto com data fatal no passado.",
        tone: "danger",
        items: deadlines
          .filter((d) => daysUntil(d.fatal_date) < 0)
          .map((d) => dl(d, `${Math.abs(daysUntil(d.fatal_date))}d em atraso`, "danger")),
      },
      {
        key: "prazos_criticos",
        label: "Prazos críticos (≤ 3 dias)",
        hint: "Prazos que vencem nos próximos 3 dias.",
        tone: "warning",
        items: deadlines
          .filter((d) => {
            const x = daysUntil(d.fatal_date);
            return x >= 0 && x <= 3;
          })
          .map((d) => dl(d, `${daysUntil(d.fatal_date)}d restantes`, "warning")),
      },
      {
        key: "prazos_sem_resp",
        label: "Prazos sem responsável",
        hint: "Prazos em aberto sem responsável atribuído.",
        tone: "warning",
        items: deadlines
          .filter((d) => empty(d.responsible))
          .map((d) => dl(d, "sem responsável", "warning")),
      },
      {
        key: "tarefas_vencidas",
        label: "Tarefas vencidas",
        hint: "Tarefas não concluídas com vencimento no passado.",
        tone: "danger",
        items: tasks
          .filter((t) => t.due_date && daysUntil(t.due_date) < 0)
          .map((t) => tk(t, `${Math.abs(daysUntil(t.due_date))}d em atraso`, "danger")),
      },
      {
        key: "tarefas_sem_resp",
        label: "Tarefas sem responsável",
        hint: "Tarefas em aberto sem responsável.",
        tone: "neutral",
        items: tasks
          .filter((t) => empty(t.assignee))
          .map((t) => tk(t, "sem responsável", "neutral")),
      },
      {
        key: "casos_parados",
        label: "Casos parados > 30 dias",
        hint: "Casos sem mudança de etapa há mais de 30 dias.",
        tone: "warning",
        items: cases
          .filter((c) => daysSince(c.status_changed_at) > 30)
          .map((c) => ({
            id: c.id,
            caseId: c.id,
            title: c.client_name,
            subtitle: c.case_code,
            meta: `${daysSince(c.status_changed_at)}d parado`,
            tone: (daysSince(c.status_changed_at) > 45 ? "danger" : "warning") as ExcItem["tone"],
          })),
      },
    ];
  }, [casosQ.data, tasksQ.data, deadlinesQ.data]);

  const total = groups.reduce((acc, g) => acc + g.items.length, 0);
  return { loading, total, groups };
}
