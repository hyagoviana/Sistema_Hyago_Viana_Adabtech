import { useMemo } from "react";

import { useCasesList } from "./useCases";
import { useAllTasks, useAllDeadlines } from "./useDossie";
import { useUsers } from "./useUsers";

// ---- Tipos ----------------------------------------------------------------
export type ResponsavelSummary = {
  name: string;
  userId: string | null;
  casosCount: number;
  tarefasAbertas: number;
  tarefasVencidas: number;
  prazosAbertos: number;
  prazosVencidos: number;
};

export type ControladoriaCaso = {
  id: string;
  case_code: string;
  client_name: string;
  case_type: string;
  macrostatus_op: string;
  macrostatus_fin: string;
  responsavel: string | null;
  municipio: string | null;
  valor_centavos: number | null;
  status_changed_at: string | null;
  created_at: string;
  tarefasAbertas: number;
  tarefasVencidas: number;
  prazosAbertos: number;
  prazosVencidos: number;
  diasParado: number;
};

export type ControladoriaTarefa = {
  id: string;
  case_id: string;
  case_code: string;
  client_name: string;
  title: string;
  status: string;
  priority: string;
  assignee: string | null;
  assignee_id: string | null;
  due_date: string | null;
  created_at: string;
  diasAtraso: number;
};

export type ControladoriaKpis = {
  totalCasos: number;
  casosAtivos: number;
  casosParados30d: number;
  tarefasAbertas: number;
  tarefasVencidas: number;
  tarefasSemResponsavel: number;
  prazosAbertos: number;
  prazosVencidos: number;
  prazosCriticos: number;
};

// ---- Helpers ---------------------------------------------------------------
function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}
function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
const empty = (v: string | null | undefined) => !v || v.trim() === "";

// ---- Hook principal --------------------------------------------------------
export function useControladoria() {
  const casosQ = useCasesList();
  const tasksQ = useAllTasks();
  const deadlinesQ = useAllDeadlines();
  const usersQ = useUsers();

  const loading =
    casosQ.isLoading || tasksQ.isLoading || deadlinesQ.isLoading || usersQ.isLoading;

  const result = useMemo(() => {
    const cases = casosQ.data ?? [];
    const allTasks = tasksQ.data ?? [];
    const allDeadlines = deadlinesQ.data ?? [];
    const users = usersQ.data ?? [];

    const openTasks = allTasks.filter((t) => t.status !== "CONCLUIDA");
    const openDeadlines = allDeadlines.filter((d) => d.status === "ABERTO");

    // Mapa de tarefas/prazos por case_id
    const tasksByCase = new Map<string, typeof openTasks>();
    for (const t of openTasks) {
      const arr = tasksByCase.get(t.case_id) ?? [];
      arr.push(t);
      tasksByCase.set(t.case_id, arr);
    }
    const deadlinesByCase = new Map<string, typeof openDeadlines>();
    for (const d of openDeadlines) {
      const arr = deadlinesByCase.get(d.case_id) ?? [];
      arr.push(d);
      deadlinesByCase.set(d.case_id, arr);
    }

    // Casos enriquecidos
    const enrichedCases: ControladoriaCaso[] = cases.map((c) => {
      const ct = tasksByCase.get(c.id) ?? [];
      const cd = deadlinesByCase.get(c.id) ?? [];
      return {
        id: c.id,
        case_code: c.case_code,
        client_name: c.client_name,
        case_type: c.case_type,
        macrostatus_op: c.macrostatus_op,
        macrostatus_fin: c.macrostatus_fin,
        responsavel: c.responsavel,
        municipio: c.municipio,
        valor_centavos: c.valor_centavos,
        status_changed_at: c.status_changed_at,
        created_at: c.created_at,
        tarefasAbertas: ct.length,
        tarefasVencidas: ct.filter((t) => t.due_date && daysUntil(t.due_date) < 0).length,
        prazosAbertos: cd.length,
        prazosVencidos: cd.filter((d) => daysUntil(d.fatal_date) < 0).length,
        diasParado: daysSince(c.status_changed_at),
      };
    });

    // Tarefas enriquecidas
    const enrichedTasks: ControladoriaTarefa[] = openTasks.map((t) => ({
      id: t.id,
      case_id: t.case_id,
      case_code: t.case_code,
      client_name: t.client_name,
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignee: t.assignee,
      assignee_id: t.assignee_id,
      due_date: t.due_date,
      created_at: t.created_at,
      diasAtraso: t.due_date ? Math.max(0, -daysUntil(t.due_date)) : 0,
    }));

    // Agrupamento por responsável
    const respMap = new Map<string, ResponsavelSummary>();

    // Responsáveis dos casos
    for (const c of enrichedCases) {
      const name = c.responsavel || "Sem responsável";
      const existing = respMap.get(name) ?? {
        name,
        userId: null,
        casosCount: 0,
        tarefasAbertas: 0,
        tarefasVencidas: 0,
        prazosAbertos: 0,
        prazosVencidos: 0,
      };
      existing.casosCount++;
      existing.tarefasAbertas += c.tarefasAbertas;
      existing.tarefasVencidas += c.tarefasVencidas;
      existing.prazosAbertos += c.prazosAbertos;
      existing.prazosVencidos += c.prazosVencidos;
      respMap.set(name, existing);
    }

    // Tarefas com assignee diferente do responsável do caso
    for (const t of enrichedTasks) {
      const assigneeName = t.assignee || "Sem responsável";
      if (!respMap.has(assigneeName)) {
        respMap.set(assigneeName, {
          name: assigneeName,
          userId: t.assignee_id,
          casosCount: 0,
          tarefasAbertas: 0,
          tarefasVencidas: 0,
          prazosAbertos: 0,
          prazosVencidos: 0,
        });
      }
    }

    const responsaveis = Array.from(respMap.values()).sort(
      (a, b) => b.tarefasVencidas - a.tarefasVencidas || b.casosCount - a.casosCount,
    );

    // KPIs
    const kpis: ControladoriaKpis = {
      totalCasos: cases.length,
      casosAtivos: cases.filter(
        (c) => c.macrostatus_op !== "ENCERRADO_OPERACIONAL" && c.macrostatus_op !== "CANCELADO",
      ).length,
      casosParados30d: enrichedCases.filter((c) => c.diasParado > 30).length,
      tarefasAbertas: openTasks.length,
      tarefasVencidas: openTasks.filter((t) => t.due_date && daysUntil(t.due_date) < 0).length,
      tarefasSemResponsavel: openTasks.filter((t) => empty(t.assignee)).length,
      prazosAbertos: openDeadlines.length,
      prazosVencidos: openDeadlines.filter((d) => daysUntil(d.fatal_date) < 0).length,
      prazosCriticos: openDeadlines.filter((d) => {
        const x = daysUntil(d.fatal_date);
        return x >= 0 && x <= 3;
      }).length,
    };

    // Nomes únicos de responsáveis (para filtro)
    const responsaveisNomes = Array.from(
      new Set(cases.map((c) => c.responsavel).filter(Boolean)),
    ).sort() as string[];

    return {
      casos: enrichedCases,
      tarefas: enrichedTasks,
      prazos: openDeadlines,
      responsaveis,
      responsaveisNomes,
      users,
      kpis,
    };
  }, [casosQ.data, tasksQ.data, deadlinesQ.data, usersQ.data]);

  return { loading, ...result };
}
