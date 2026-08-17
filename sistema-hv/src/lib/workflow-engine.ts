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
import { moveCaseStatus } from "@/lib/cases-service";

export type WorkflowTrigger =
  | "status_changed"
  | "checklist_completed"
  | "task_created"
  | "task_completed";

type Rule = {
  id: string;
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

// Executa UMA ação. Best-effort: erros não propagam (o chamador loga).
async function runAction(
  action: Record<string, unknown>,
  caseId: string,
  actorUserId: string | null,
): Promise<void> {
  const type = asStr(action.type);
  if (type === "write_comment") {
    const body = asStr(action.body);
    // createCaseNote exige um autor; sem ator (ex.: cron) não há como atribuir.
    if (body && actorUserId) await createCaseNote(caseId, body, actorUserId, "geral");
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
        due_date: dueDays != null ? addDaysIso(dueDays) : null,
      },
      actorUserId ?? undefined,
    );
    return;
  }
  if (type === "move_stage") {
    const to = asStr(action.to_stage_slug);
    // Chama o SERVIÇO direto (não a server fn) → não re-dispara o motor.
    if (to) await moveCaseStatus(caseId, to, actorUserId ?? undefined);
    return;
  }
}

/**
 * Avalia e roda os workflows de um gatilho para um caso. NUNCA lança (best-effort).
 * ctx: dados do evento (ex.: { toStageSlug } para status_changed).
 */
export async function runWorkflowsFor(
  caseId: string,
  trigger: WorkflowTrigger,
  ctx: { toStageSlug?: string | null } = {},
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

    let q = sb
      .from("system_workflow_rules")
      .select("id, organization_id, trigger_config, actions")
      .eq("organization_id", caso.organization_id)
      .eq("trigger_type", trigger)
      .eq("active", true);
    // Regras globais (tema_id null) OU do tema do caso.
    q = caso.tema_id ? q.or(`tema_id.is.null,tema_id.eq.${caso.tema_id}`) : q.is("tema_id", null);
    const { data: rules } = await q;
    if (!rules || rules.length === 0) return;

    for (const rule of rules as Rule[]) {
      // Filtro por trigger_config + event_key (idempotência).
      let eventKey: string = trigger;
      if (trigger === "status_changed") {
        const want = asStr(rule.trigger_config?.to_stage_slug);
        // Regra restrita a uma etapa: só dispara quando entra NELA.
        if (want && want !== (ctx.toStageSlug ?? null)) continue;
        eventKey = `status:${ctx.toStageSlug ?? ""}`;
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
        for (const a of actions) {
          if (a && typeof a === "object") {
            await runAction(a as Record<string, unknown>, caseId, actorUserId);
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
