// ============================================================================
// S1-07 / S1-09 (S4-01) — Replay/validação da VIRADA AUTOMÁTICA lead→cliente
// em SANDBOX, SEM depender de e-mail real e SEM poluir dados de produção.
// ----------------------------------------------------------------------------
// Prova a LÓGICA do webhook de assinatura da procuração:
//   (1) evento "assinado" (doc_kind='procuracao') → doc vira ASSINADO,
//       liberarCasoComercial roda → caso vira lifecycle='CLIENTE' com evento
//       auditado (action='liberado_comercial', diff.via='webhook', triggered_by=null);
//   (2) dedupe: reenviar o MESMO token → ignorado (não promove 2x, não duplica).
//
// Usa um Supabase FAKE em memória + Drive FAKE — não escreve no banco real
// (dev=prod). Reimplementa exatamente o fluxo de decisão de processZapsignWebhook
// (webhook.ts) e a transição de liberarCasoComercial (cases-service.ts), servindo
// de contrato executável para o @qa. Rodar: npx tsx scripts/zapsign-webhook-replay.ts
// ============================================================================
import assert from "node:assert/strict";

type CaseRow = {
  id: string;
  organization_id: string;
  lifecycle: "LEAD" | "CLIENTE" | "PERDIDO";
  aguardando_assinatura_at: string | null;
  assinatura_liberada_at: string | null;
  deleted_at: string | null;
};
type DocRow = {
  id: string;
  case_id: string;
  organization_id: string;
  doc_kind: string;
  status: string;
  zapsign_doc_token: string;
  drive_file_id: string | null;
  title: string;
  deleted_at: string | null;
};

// ---- Estado em memória (fixture sandbox) ----------------------------------
const CASE_ID = "11111111-1111-1111-1111-111111111111";
const ORG = "00000000-0000-0000-0000-000000000001";
const TOKEN = "sandbox-token-abc123";

const cases: CaseRow[] = [
  {
    id: CASE_ID,
    organization_id: ORG,
    lifecycle: "LEAD",
    aguardando_assinatura_at: new Date().toISOString(),
    assinatura_liberada_at: null,
    deleted_at: null,
  },
];
const docs: DocRow[] = [
  {
    id: "doc-1",
    case_id: CASE_ID,
    organization_id: ORG,
    doc_kind: "procuracao",
    status: "ENVIADO_ZAPSIGN",
    zapsign_doc_token: TOKEN,
    drive_file_id: null,
    title: "Procuração",
    deleted_at: null,
  },
];
const events: Array<Record<string, unknown>> = [];
const dedupe = new Set<string>(); // provider:external_id

// ---- Fluxo de decisão (espelha webhook.ts + cases-service.ts) --------------
function liberarCasoComercial(caseId: string, via: "webhook" | "manual") {
  const caso = cases.find((c) => c.id === caseId && !c.deleted_at);
  assert.ok(caso, "caso deve existir");
  // Idempotente: se já não está aguardando, no-op (não promove de novo).
  if (!caso.aguardando_assinatura_at) return { alreadyLiberado: true };
  caso.aguardando_assinatura_at = null;
  caso.assinatura_liberada_at = new Date().toISOString();
  caso.lifecycle = "CLIENTE"; // S1-01: procuração assinada ⇒ CLIENTE
  events.push({
    case_id: caseId,
    action: "liberado_comercial",
    diff: { via },
    triggered_by: null,
  });
  return { ok: true };
}

function processSignedWebhook(payload: { token: string; status: string; signed_file: string }) {
  const { token, status, signed_file } = payload;
  if (status !== "signed" || !signed_file) return { action: "ignored", reason: "não assinado" };

  // Dedupe (UNIQUE provider,external_id) — 2º evento com mesmo token é ignorado.
  const key = `zapsign:${token}`;
  if (dedupe.has(key)) return { action: "ignored", reason: "dedupe" };
  dedupe.add(key);

  const doc = docs.find((d) => d.zapsign_doc_token === token && !d.deleted_at);
  if (doc?.case_id) {
    doc.status = "ASSINADO";
    doc.drive_file_id = "fake-drive-file-id"; // upload FAKE (pasta do caso)
    if (doc.doc_kind === "procuracao") liberarCasoComercial(doc.case_id, "webhook");
    return { action: "stored", target: "case" as const };
  }
  return { action: "stored", target: "inbox" as const };
}

// ---- Cenário 1: assinatura → CLIENTE (auditado) ----------------------------
const r1 = processSignedWebhook({ token: TOKEN, status: "signed", signed_file: "https://x/f.pdf" });
assert.equal(r1.action, "stored");
assert.equal((r1 as { target: string }).target, "case");
const caso = cases[0];
assert.equal(caso.lifecycle, "CLIENTE", "caso deve virar CLIENTE");
assert.equal(caso.aguardando_assinatura_at, null, "flag comercial limpa");
assert.ok(caso.assinatura_liberada_at, "assinatura carimbada");
assert.equal(docs[0].status, "ASSINADO", "doc vira ASSINADO");
assert.ok(docs[0].drive_file_id, "arquivo na pasta do caso");
const ev = events.filter((e) => e.action === "liberado_comercial");
assert.equal(ev.length, 1, "exatamente 1 evento de liberação");
assert.deepEqual((ev[0] as { diff: unknown }).diff, { via: "webhook" });
assert.equal(
  (ev[0] as { triggered_by: unknown }).triggered_by,
  null,
  "webhook → triggered_by null",
);

// ---- Cenário 2: reenvio do MESMO token → dedupe (no-op) --------------------
const r2 = processSignedWebhook({ token: TOKEN, status: "signed", signed_file: "https://x/f.pdf" });
assert.equal(r2.action, "ignored");
assert.equal((r2 as { reason: string }).reason, "dedupe");
assert.equal(
  events.filter((e) => e.action === "liberado_comercial").length,
  1,
  "não promove 2x nem duplica evento",
);

console.log("✅ S1-07/S1-09: virada automática lead→cliente (sandbox/replay) + dedupe OK");
console.log("   - assinatura da procuração → lifecycle=CLIENTE, evento auditado (via=webhook)");
console.log("   - reenvio do mesmo token → ignorado por dedupe (sem promover 2x)");
