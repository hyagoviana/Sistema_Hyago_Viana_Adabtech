# ADR-005 — Webhook idempotency: outbox pattern + `webhook_dedupe`

> **Formato:** MADR-light · **Owner:** @architect Winston · **Aprovado por:** @pm John
> **Data:** 2026-05-20 · **Sprint:** 1 · **Atende:** Architect F-01 (BLOCKER) + QA S-01

---

## Status

**Aprovado** — implementação na Story 1.1 expandida do Sprint 1.

---

## Context

PRD Master §5.1 e §6.3 são explícitos: **toda integração externa passa por `case_outbox_events`** (idempotência + DLQ + retry). Webhooks que vamos receber:

- **ZapSign** (Sprint 6) — 3 caminhos de onboarding (A/B/C) + assinatura concluída
- **Conta Azul / Asaas** (Sprint 9) — confirmação de pagamento, baixa de boleto
- **ChatGuru** (Sprint 9) — mensagem recebida, status entrega
- **Postmark** (Sprint 6) — bounce, complaint

Sem idempotência:
- Webhook duplicado do ZapSign → caso duplicado em prod (cenário M-06).
- Webhook tardio do Conta Azul → parcela marcada PAGA 2×.
- Race condition (2 webhooks paralelos com mesmo doc_id) → erro de constraint UNIQUE em vez de skip elegante.

A v1.0 do plano F4 mencionava `case_outbox_events` no Sprint 5+ mas **não criava no Sprint 1**, gerando dependência implícita e migração tardia.

---

## Decision

### Arquitetura em duas camadas

#### Camada 1 — `webhook_dedupe` (proteção na borda)

Toda Edge Function receptora de webhook:

```typescript
// supabase/functions/zapsign-webhook/index.ts
const { provider, external_id, payload } = parsePayload(req);

// 1. Tentativa de dedupe — UNIQUE (provider, external_id)
const { error: dedupErr } = await supabase
  .from('webhook_dedupe')
  .insert({ provider, external_id, received_at: new Date() });

if (dedupErr?.code === '23505') {
  // duplicate — skip elegantemente (atende QA S-01)
  return new Response(JSON.stringify({ status: 'duplicate', skip: true }), { status: 200 });
}

// 2. Enqueue no outbox para processamento assíncrono
await supabase.rpc('enqueue_outbox', {
  source: provider,
  source_event_id: external_id,
  payload
});

return new Response(JSON.stringify({ status: 'received' }), { status: 200 });
```

**Tabela `webhook_dedupe`:**

```sql
CREATE TABLE webhook_dedupe (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider text NOT NULL,        -- 'zapsign', 'conta_azul', 'chatguru', 'postmark'
  external_id text NOT NULL,     -- doc_id, payment_id, message_id, bounce_id
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);

CREATE INDEX idx_webhook_dedupe_recent ON webhook_dedupe(received_at DESC);

-- Cleanup mensal: remove entries > 90 dias
SELECT cron.schedule('webhook_dedupe_cleanup', '0 3 1 * *',
  $$ DELETE FROM webhook_dedupe WHERE received_at < now() - interval '90 days' $$);
```

#### Camada 2 — `case_outbox_events` (processamento assíncrono)

```sql
CREATE TABLE case_outbox_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id),
  aggregate_type text NOT NULL,    -- 'case', 'parcela', 'document'
  aggregate_id uuid,
  event_type text NOT NULL,        -- 'zapsign.signed', 'payment.confirmed'
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,        -- NULL = pending
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  CHECK (attempts <= 10)
);

CREATE INDEX idx_outbox_pending ON case_outbox_events(occurred_at)
  WHERE published_at IS NULL;

CREATE INDEX idx_outbox_published ON case_outbox_events(published_at, occurred_at);
```

### Consumer: pg_cron + Edge Function

```sql
-- Roda a cada 60s
SELECT cron.schedule('outbox_publisher', '* * * * *',
  $$ SELECT net.http_post('https://[supabase-url]/functions/v1/outbox-publisher') $$);
```

```typescript
// supabase/functions/outbox-publisher/index.ts
const { data: events } = await supabase
  .from('case_outbox_events')
  .select()
  .is('published_at', null)
  .lt('attempts', 10)
  .order('occurred_at', { ascending: true })
  .limit(100);

for (const event of events) {
  try {
    await dispatch(event);  // chama handler por event_type
    await supabase
      .from('case_outbox_events')
      .update({ published_at: new Date() })
      .eq('id', event.id);
  } catch (err) {
    await supabase
      .from('case_outbox_events')
      .update({
        attempts: event.attempts + 1,
        last_error: String(err)
      })
      .eq('id', event.id);
  }
}
```

### DLQ (Dead Letter Queue)

Eventos com `attempts >= 10` ficam no outbox sem `published_at` mas com `last_error`. Dashboard admin (Sprint 11) mostra DLQ com botão "Retry manual" / "Mark resolved".

### Função `enqueue_outbox()` testada com pgTAP

```sql
CREATE OR REPLACE FUNCTION enqueue_outbox(
  p_source text,
  p_source_event_id text,
  p_payload jsonb
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO case_outbox_events (
    organization_id,
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  ) VALUES (
    (p_payload->>'organization_id')::uuid,
    (p_payload->>'aggregate_type'),
    (p_payload->>'aggregate_id')::uuid,
    p_source || '.' || (p_payload->>'event_type'),
    p_payload
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
```

### Concorrência (teste QA S-01)

5 chamadas paralelas com mesmo `doc_id`:
- 1ª: `webhook_dedupe` INSERT sucesso → enqueue → 200 `{status: 'received'}`
- 2ª-5ª: UNIQUE violation no `webhook_dedupe` → 200 `{status: 'duplicate', skip: true}`
- **Nenhum 500.**

Teste pgTAP simula via 5 statements `INSERT` em transações paralelas + `pg_sleep(0.05)`.

---

## Consequences

### Positivas

- Idempotência garantida na borda (`webhook_dedupe`) **e** no processamento (outbox UNIQUE).
- Retry com backoff implícito (cron 60s, max 10 tentativas).
- DLQ visível para operação manual.
- Sem race conditions de constraint (skip elegante).
- Defesa em profundidade: webhook duplicado de provider mal-comportado é tratado.

### Negativas / Riscos

- **Latência de processamento:** até 60s entre receber webhook e ação tomada. Aceitável para webhook assíncrono.
- **`webhook_dedupe` cresce indefinidamente** — mitigado por cleanup mensal (>90d).
- **DLQ pode acumular silenciosamente** — mitigado por dashboard admin + alerta se DLQ > 10 entries.
- **Consumer falha → backlog cresce** — mitigado por monitoring de `count(*) WHERE published_at IS NULL` e alerta se > 100.

---

## Alternatives Considered

### A. Idempotência via UNIQUE em `cases.external_id`

- **Pró:** simples, no aggregate.
- **Contra:** acopla provider ao schema; não cobre eventos sem aggregate (ex.: bounce de e-mail); race condition gera erro.
- **Rejeitada:** outbox é mais flexível.

### B. Redis para dedupe (TTL 90d)

- **Pró:** rápido.
- **Contra:** dependência adicional (mais 1 serviço); persistência custosa para 90d.
- **Rejeitada:** Postgres já tem tudo.

### C. Idempotency-Key no header (RFC 7231-like)

- **Pró:** padrão emergente.
- **Contra:** provider precisa enviar; não todos enviam; ainda precisa armazenar.
- **Rejeitada:** providers brasileiros (ZapSign, ChatGuru) não suportam consistentemente.

### D. Processamento síncrono (sem outbox)

- **Pró:** simples; resposta imediata.
- **Contra:** webhook timeout (provider desiste em 5-10s); falha = perda; sem retry.
- **Rejeitada:** viola P2 (orientação a eventos).

---

## Referências

- `_review-architect.md` §F-01 (BLOCKER)
- `_review-qa.md` §S-01 (teste de concorrência)
- `_review-qa.md` §QR-09 (DLQ)
- PRD Master §5.1 (outbox) e §6.3 (webhook pipeline)
- Story 1.1 (expandida) implementa
- Story 1.7 (VPS) hospeda workers para handlers pesados

---

> _Sem esta ADR no Sprint 1, Sprint 6 (ZapSign) e Sprint 9 (Cobrança) construiriam idempotência ad-hoc — débito técnico garantido._
