// Server-only — #2 (2026-08-17) — MOTOR de Workflows (automações gatilho→ação).
//
// runWorkflowsFor(caseId, trigger, ctx, actorUserId) é chamado logo APÓS um evento
// no caso (ex.: mudança de etapa). Ele:
//   1) carrega o caso (org + tema) e as REGRAS ativas do gatilho (globais ou do tema);
//   2) filtra por trigger_config (ex.: só quando entra numa etapa específica);
//   3) para cada regra, calcula um event_key e usa system_workflow_runs como
//      trava de IDEMPOTÊNCIA (não repete as ações do mesmo evento);
//   4) executa as ações reusando os serviços (nota / tarefa / mover etapa).
//
// REGRA CRÍTICA: best-effort — NUNCA derruba a operação que disparou o gatilho
// (todo erro é engolido/logado). A ação move_stage chama o serviço direto (não a
// server fn), então NÃO re-dispara o motor → sem recursão.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createCaseNote } from "@/lib/notes-service";
import { createCaseTask } from "@/lib/dossie-service";
import { moveCaseStatus, moveCaseStatusFin } from "@/lib/cases-service";
import type { MacroFin } from "@/lib/cases/constants";
import { moveCaseInBoardBySlug } from "@/lib/board-service";

export type WorkflowTrigger =
  | "status_changed"
  | "checklist_completed"
  | "task_created"
  | "task_completed";

type Rule = {
  id: string;
  // W1 — sem estes dois no SELECT o carimbo sai vazio; é o erro mais fácil aqui.
  code: string | null;
  name: string | null;
  organization_id: string;
  trigger_config: Record<string, unknown> | null;
  actions: unknown;
};

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Assinatura da automação (W1). Thiago: "gerou uma tarefa automática de tal coisa
 * por conta do workflow — tarefa gerada, o quê, e codizinho do workflow. Quando
 * ele criar isso, a gente sempre vai ter uma identificação mais de auditoria."
 */
function assinatura(rule: Rule): string {
  const cod = rule.code ?? "workflow";
  return rule.name ? `${cod} · ${rule.name}` : cod;
}

// Executa UMA ação. Best-effort: erros não propagam (o chamador loga).
async function runAction(
  action: Record<string, unknown>,
  caseId: string,
  actorUserId: string | null,
  rule: Rule,
  // Indice da acao dentro de rule.actions. Vai carimbado na tarefa criada para
  // que o ENCADEAMENTO (doc 31.08) saiba de qual acao voltar quando ela fechar.
  // -1 = acao encadeada (on_complete), que nao pode gerar outro encadeamento.
  actionIndex: number = -1,
): Promise<void> {
  const type = asStr(action.type);
  const marca = assinatura(rule);

  if (type === "write_comment") {
    const body = asStr(action.body);
    // createCaseNote exige um autor; sem ator (ex.: cron) não há como atribuir.
    if (body && actorUserId) {
      await createCaseNote(
        caseId,
        `${body}

— automático (${marca})`,
        actorUserId,
        "geral",
        rule.code,
      );
    }
    return;
  }
  if (type === "create_task") {
    const title = asStr(action.title);
    if (!title) return;
    const dueDays = typeof action.due_days === "number" ? action.due_days : null;
    await createCaseTask(
      {
        case_id: caseId,
        title,
        assignee_id: asStr(action.assignee_id),
        // Doc 31.08 — "a tarefa criada e vinculada a um tipo de tarefa ja
        // existente no sistema". O tipo tambem e o que permite ao gatilho
        // "Tarefa concluida > tipo X" reagir a ela.
        task_type_id: asStr(action.task_type_id),
        due_date: dueDays != null ? addDaysIso(dueDays) : null,
        description: `Tarefa gerada automaticamente pelo workflow ${marca}.`,
        // O rastro que permite responder "quais tarefas ESTE workflow criou?".
        created_by_workflow_id: rule.id,
        // ...e de QUAL acao dela (o encadeamento volta por aqui).
        created_by_workflow_action: actionIndex >= 0 ? actionIndex : null,
      },
      actorUserId ?? undefined,
      rule.code,
    );
    return;
  }
  if (type === "move_stage") {
    const to = asStr(action.to_stage_slug);
    if (!to) return;
    // AJ3 (Thiago, 27/08) — a ação escolhe EM QUAL kanban mover. Antes movia
    // sempre no principal; um tema com vários kanbans não tinha como automatizar
    // os outros. Mesmo vocabulário do gatilho: "op" | "fin" | boardId (custom).
    // Sem board_key = "op": regras antigas continuam se comportando igual.
    const board = asStr(action.board_key) || "op";
    // Chama o SERVIÇO direto (não a server fn) → não re-dispara o motor.
    // O `rule.code` vai nas TRÊS rotas: é ele que responde "qual workflow moveu
    // este caso?" na timeline e na auditoria.
    if (board === "op") {
      await moveCaseStatus(caseId, to, actorUserId ?? undefined, rule.code);
    } else if (board === "fin") {
      await moveCaseStatusFin(caseId, to as MacroFin, actorUserId ?? undefined, rule.code);
    } else {
      await moveCaseInBoardBySlug(caseId, board, to, actorUserId ?? undefined, rule.code);
    }
    return;
  }
}

/**
 * Contexto do evento que disparou o gatilho.
 *  - toStageSlug: etapa de destino (status_changed)
 *  - stageSlug: etapa cujo checklist foi concluído (checklist_completed)
 *  - taskId: id da tarefa criada/concluída (task_created / task_completed) — usado
 *    no event_key para que o motor dispare 1x POR TAREFA (e não 1x por caso).
 */
export type WorkflowCtx = {
  toStageSlug?: string | null;
  stageSlug?: string | null;
  taskId?: string | null;
  // Kanban de origem do evento de etapa (status_changed): "op" (principal, padrão),
  // "fin" (financeiro) ou o boardId de um kanban custom. Permite que a regra dispare
  // só no kanban certo (um tema pode ter vários kanbans com etapas homônimas).
  boardKey?: string | null;
  // Tipo da tarefa (task_created / task_completed). Permite a sub-opção "só quando a
  // tarefa é do tipo X". Forward-compat: enquanto a tarefa não carrega tipo, chega
  // null → regras SEM filtro de tipo disparam; regras COM filtro ficam inertes.
  taskTypeId?: string | null;
  // ENCADEAMENTO (doc 31.08). Quando a tarefa concluída foi criada por uma ação de
  // workflow, estes dois dizem por qual — é o caminho de volta para as ações
  // `on_complete` daquela ação. NULL nos dois = tarefa criada por gente.
  taskCreatedByWorkflowId?: string | null;
  taskCreatedByWorkflowAction?: number | null;
};

/**
 * ENCADEAMENTO (doc 31.08) — "quando a tarefa criada pela ação 1 for concluída,
 * gerar a ação 2".
 *
 * Não é uma regra nova: as ações encadeadas moram DENTRO da ação que criou a
 * tarefa (`actions[i].on_complete`). Ao concluir a tarefa, o motor volta pela
 * marca que ela carrega (created_by_workflow_id + created_by_workflow_action) e
 * roda essa lista. Um nível só: as ações de `on_complete` rodam com índice -1,
 * então a tarefa que elas criarem não encadeia de novo (sem recursão infinita).
 *
 * Best-effort e idempotente pelo mesmo mecanismo das regras (system_workflow_runs,
 * event_key `chain:<taskId>:<idx>`).
 */
async function runChain(
  caseId: string,
  ruleId: string,
  actionIndex: number,
  taskId: string | null,
  actorUserId: string | null,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data: rule } = await sb
    .from("system_workflow_rules")
    .select("id, code, name, organization_id, trigger_config, actions, active")
    .eq("id", ruleId)
    .maybeSingle();
  // Regra suspensa não encadeia: desligar o workflow tem que desligar a cadeia toda.
  if (!rule || rule.active === false) return;

  const actions = Array.isArray(rule.actions) ? rule.actions : [];
  const origem = actions[actionIndex] as Record<string, unknown> | undefined;
  const chain = origem && Array.isArray(origem.on_complete) ? origem.on_complete : [];
  if (chain.length === 0) return;

  const eventKey = `chain:${taskId ?? ""}:${actionIndex}`;
  const { data: prior } = await sb
    .from("system_workflow_runs")
    .select("id")
    .eq("rule_id", rule.id)
    .eq("case_id", caseId)
    .eq("event_key", eventKey)
    .maybeSingle();
  if (prior) return;

  let detail = "";
  try {
    for (const a of chain) {
      if (a && typeof a === "object") {
        await runAction(a as Record<string, unknown>, caseId, actorUserId, rule as Rule, -1);
      }
    }
    detail = `encadeado: ${chain.length} ação(ões)`;
  } catch (err) {
    detail = `erro: ${err instanceof Error ? err.message : String(err)}`;
  }

  await sb.from("system_workflow_runs").insert({
    organization_id: rule.organization_id,
    rule_id: rule.id,
    case_id: caseId,
    event_key: eventKey,
    status: detail.startsWith("erro") ? "error" : "done",
    detail,
  });
}

/**
 * Avalia e roda os workflows de um gatilho para um caso. NUNCA lança (best-effort).
 * ctx: dados do evento (ver WorkflowCtx).
 */
export async function runWorkflowsFor(
  caseId: string,
  trigger: WorkflowTrigger,
  ctx: WorkflowCtx = {},
  actorUserId: string | null = null,
): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const { data: caso } = await sb
      .from("system_cases")
      .select("id, organization_id, tema_id")
      .eq("id", caseId)
      .maybeSingle();
    if (!caso) return;

    // ENCADEAMENTO primeiro: independe de existir regra ATIVA com gatilho
    // "tarefa concluída", porque a cadeia mora dentro da ação que criou a tarefa.
    if (trigger === "task_completed" && ctx.taskCreatedByWorkflowId != null) {
      const idx = ctx.taskCreatedByWorkflowAction;
      if (typeof idx === "number" && idx >= 0) {
        await runChain(caseId, ctx.taskCreatedByWorkflowId, idx, ctx.taskId ?? null, actorUserId);
      }
    }

    let q = sb
      .from("system_workflow_rules")
      .select("id, code, name, organization_id, trigger_config, actions")
      .eq("organization_id", caso.organization_id)
      .eq("trigger_type", trigger)
      .eq("active", true);
    // Regras globais (tema_id null) OU do tema do caso.
    q = caso.tema_id ? q.or(`tema_id.is.null,tema_id.eq.${caso.tema_id}`) : q.is("tema_id", null);
    const { data: rules } = await q;
    if (!rules || rules.length === 0) return;

    for (const rule of rules as Rule[]) {
      // Filtro por trigger_config + event_key (idempotência). O event_key define
      // a granularidade do "não repetir": por etapa (status/checklist) ou por
      // tarefa (task_*), garantindo 1 disparo por ocorrência real.
      let eventKey: string = trigger;
      if (trigger === "status_changed") {
        // Escopo por kanban: board_key ausente = "op" (principal) — mantém as
        // regras antigas funcionando. Só dispara quando o kanban do evento casa.
        const wantBoard = asStr(rule.trigger_config?.board_key) ?? "op";
        const ctxBoard = asStr(ctx.boardKey) ?? "op";
        if (wantBoard !== ctxBoard) continue;
        const want = asStr(rule.trigger_config?.to_stage_slug);
        // Regra restrita a uma etapa: só dispara quando entra NELA.
        if (want && want !== (ctx.toStageSlug ?? null)) continue;
        eventKey = `status:${ctxBoard}:${ctx.toStageSlug ?? ""}`;
      } else if (trigger === "checklist_completed") {
        const want = asStr(rule.trigger_config?.stage_slug);
        // Regra restrita a uma etapa: só dispara quando o checklist DELA fecha.
        if (want && want !== (ctx.stageSlug ?? null)) continue;
        eventKey = `checklist:${ctx.stageSlug ?? ""}`;
      } else if (trigger === "task_created" || trigger === "task_completed") {
        // Sub-opção (Pedido A): regra restrita a um tipo de tarefa só dispara quando
        // o tipo casa. Sem task_type_id na regra = qualquer tipo (comportamento atual).
        const wantType = asStr(rule.trigger_config?.task_type_id);
        if (wantType && wantType !== (ctx.taskTypeId ?? null)) continue;
        eventKey = `${trigger}:${ctx.taskId ?? ""}`;
      }

      // Idempotência: se já rodou esse (regra, caso, evento), pula.
      const { data: prior } = await sb
        .from("system_workflow_runs")
        .select("id")
        .eq("rule_id", rule.id)
        .eq("case_id", caseId)
        .eq("event_key", eventKey)
        .maybeSingle();
      if (prior) continue;

      const actions = Array.isArray(rule.actions) ? rule.actions : [];
      let detail = "";
      try {
        for (let i = 0; i < actions.length; i++) {
          const a = actions[i];
          if (a && typeof a === "object") {
            await runAction(a as Record<string, unknown>, caseId, actorUserId, rule, i);
          }
        }
        detail = `${actions.length} ação(ões)`;
      } catch (err) {
        detail = `erro: ${err instanceof Error ? err.message : String(err)}`;
      }

      // Registra o run (trava de idempotência) — não repete no mesmo evento.
      await sb.from("system_workflow_runs").insert({
        organization_id: caso.organization_id,
        rule_id: rule.id,
        case_id: caseId,
        event_key: eventKey,
        status: detail.startsWith("erro") ? "error" : "done",
        detail,
      });
    }
  } catch (err) {
    // Best-effort: nunca derruba a operação que disparou o gatilho.
    console.error("runWorkflowsFor:", err instanceof Error ? err.message : String(err));
  }
}
