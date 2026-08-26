// Texto de cada evento da linha do tempo do caso — FONTE ÚNICA.
//
// L1 (reunião 2026-08-26). Antes disto o `renderEventLabel` existia duplicado em
// `CaseTimeline.tsx` e `CaseFeed.tsx`, já divergindo entre si (o Feed não tinha
// vários `case` que o Timeline tinha). Com a humanização dos eventos de etapa,
// manter duas cópias garantiria que o Thiago visse a frase nova em um lugar e a
// velha no outro. Agora é um módulo só, e os dois componentes leem daqui.
//
// A tradução do SLUG da etapa entra por parâmetro (`resolve`) porque depende dos
// dados do caso (etapas do tema/board) — ver `lib/cases/stage-label.ts`.

import { formatStageSlug, type StageLabelResolver } from "@/lib/cases/stage-label";
import { taskStatusLabel } from "@/lib/task-status-shared";

export const MANUAL_ACTIONS = new Set(["nota_manual", "marco"]);

export type CaseEventLike = {
  id: string;
  action: string;
  from_macrostatus_op: string | null;
  to_macrostatus_op: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
  triggered_by_name?: string | null;
};

/** É manual (editável) só se a action for de entrada manual E `diff.manual` = true. */
export function isManualEvent(e: Pick<CaseEventLike, "action" | "diff">): boolean {
  return MANUAL_ACTIONS.has(e.action) && !!(e.diff as { manual?: boolean } | null)?.manual;
}

// Nomes dos campos que mudaram no evento de campos canônicos (reunião
// 2026-08-19): o feed dizia só "Dados do serviço atualizados", sem dizer O QUÊ.
// O `diff` do evento é o próprio patch — só faltava mostrá-lo. A partir da AU1 o
// diff passa a ter o formato { from, to }; os dois formatos são aceitos aqui.
export function describeChangedFields(d: Record<string, unknown> | null): string {
  if (!d) return "";
  const alvo =
    d.to && typeof d.to === "object"
      ? (d.to as Record<string, unknown>)
      : (d as Record<string, unknown>);
  const keys = Object.keys(alvo).filter((k) => k !== "manual" && k !== "from" && k !== "to");
  if (keys.length === 0) return "";
  const nomes = keys.slice(0, 4).map((k) => formatStageSlug(k));
  return `: ${nomes.join(", ")}${keys.length > 4 ? ` +${keys.length - 4}` : ""}`;
}

/**
 * Frase do evento. `resolve` traduz slug de etapa em rótulo; quando não é
 * passado, cai no formatador de slug (nunca deixa o texto vazio).
 */
export function renderEventLabel(e: CaseEventLike, resolve?: StageLabelResolver): string {
  const d = (e.diff as Record<string, string> | null) ?? null;
  const et = resolve ?? formatStageSlug;
  // Sufixo de rastro do workflow (W1) — só aparece quando a ação foi automática.
  const wf = d?.workflow_code ? ` · automático ${d.workflow_code}` : "";

  switch (e.action) {
    case "created":
      return "Caso criado";
    case "created_comercial":
      return "Caso criado (comercial · aguardando assinatura da procuração)";
    case "status_changed":
      return `Mudou de etapa: ${et(e.from_macrostatus_op)} → ${et(e.to_macrostatus_op)}${wf}`;
    case "fin_status_changed":
      return `Mudou de etapa (financeiro): ${et(d?.from)} → ${et(d?.to)}`;
    case "fin_stage_auto_advanced":
      return `Avançou sozinho pelo checklist (financeiro): ${et(d?.from)} → ${et(d?.to)}`;
    case "fin_enviado_conferencia":
      return `Enviado para conferência (financeiro): ${et(d?.from)} → ${et(d?.to)}`;
    case "fin_conferencia_aprovada":
      return "Conferência financeira aprovada (segunda pessoa)";
    case "updated":
      return "Caso editado";
    case "soft_deleted":
      return "Caso excluído";
    case "stage_auto_advanced":
      return `Avançou sozinho pelo checklist: ${et(d?.from)} → ${et(d?.to)}`;
    case "stage_moved_by_checkbox":
      return `Avançou pelo checkbox do caso: ${et(d?.from)} → ${et(d?.to)}`;
    case "checklist_inconsistente":
      return `Checklist inconsistente: item obrigatório "${d?.def_key ?? "·"}" da etapa ${et(d?.stage_slug)} foi desmarcado depois do avanço`;
    case "canonical_fields_updated":
      return `Dados do serviço atualizados${describeChangedFields(d)}`;
    case "note_added":
      return `Nota adicionada${d?.note_preview ? `: ${d.note_preview}` : ""}${wf}`;
    case "vinculado_a_tema":
      return "Caso transferido para outro tema";
    case "duplicado_em_tema":
      return "Caso duplicado em outro tema";
    case "board_added":
      return `Adicionado ao kanban${d?.board_label ? `: ${d.board_label}` : ""} (duplicado)`;
    case "board_moved_exclusive":
      return `Movido para o kanban${d?.board_label ? `: ${d.board_label}` : ""} (saiu do principal)`;
    case "board_removed":
      return `Removido do kanban${d?.board_label ? `: ${d.board_label}` : ""}`;
    case "board_returned_to_principal":
      return "Voltou ao kanban principal";
    case "board_stage_changed":
      return `Mudou de etapa${d?.board_label ? ` (${d.board_label})` : ""}: ${et(d?.from)} → ${et(d?.to)}${wf}`;
    case "duplicado_de_caso":
      return "Caso criado por duplicação de outro caso";
    case "andamento_importado":
      return `Andamento (importado): ${d?.descricao ?? "·"}${d?.autor_texto ? ` · ${d.autor_texto}` : ""}`;
    case "task_created":
      return `Tarefa criada: ${d?.task_title ?? "·"}${wf}`;
    case "task_started":
      return `Tarefa iniciada: ${d?.task_title ?? "·"}`;
    case "task_completed":
      // TK1 — "concluída" tem dois desfechos; sem dizer qual, a informação some.
      return `${d?.status_label ?? "Tarefa concluída"}: ${d?.task_title ?? "·"}`;
    case "task_status_changed":
      return `Tarefa "${d?.task_title ?? "·"}" → ${taskStatusLabel(d?.status)}`;
    case "task_deleted":
      return `Tarefa excluída: ${d?.task_title ?? "·"}`;
    case "doc_generated":
      return `Documento gerado: ${d?.doc_title ?? "·"}`;
    case "doc_finalized":
      return `Documento finalizado: ${d?.doc_title ?? "·"}`;
    case "doc_reopened":
      return `Documento reaberto: ${d?.doc_title ?? "·"}`;
    case "doc_sent_zapsign":
      return `Documento enviado para assinatura: ${d?.doc_title ?? "·"}`;
    case "doc_deleted":
      return `Documento excluído: ${d?.doc_title ?? "·"}`;
    case "procuracao_preparada":
      return "Procuração preparada";
    case "liberado_comercial":
      return d?.via === "manual"
        ? "Promovido para cliente (manual)"
        : `Procuração assinada · caso liberado para operação${d?.via ? ` (${d.via})` : ""}`;
    case "perdido":
      return `Caso marcado como perdido${d?.motivo ? ` · ${d.motivo}` : ""}`;
    case "deadline_created":
      return `Prazo criado: ${d?.deadline_title ?? "·"} (${d?.fatal_date ?? "·"})`;
    case "deadline_completed":
      return `Prazo cumprido: ${d?.deadline_title ?? "·"}`;
    case "deadline_missed":
      return `Prazo perdido: ${d?.deadline_title ?? "·"}`;
    case "deadline_status_changed":
      return `Prazo "${d?.deadline_title ?? "·"}" → ${d?.status ?? "·"}`;
    case "deadline_deleted":
      return `Prazo excluído: ${d?.deadline_title ?? "·"}`;
    case "communication_logged":
      return `Comunicação registrada (${d?.channel ?? "·"}): ${d?.summary ?? "·"}`;
    case "communication_deleted":
      return `Comunicação excluída: ${d?.summary ?? "·"}`;
    // Manuais (S4-04)
    case "marco":
      return d?.body ?? "Marco";
    case "nota_manual":
      return d?.body ?? "Nota";
    default:
      return e.action;
  }
}
