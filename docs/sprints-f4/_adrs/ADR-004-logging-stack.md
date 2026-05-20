# ADR-004 — Logging stack: Logtail (Better Stack) para logs estruturados

> **Formato:** MADR-light · **Owner:** @architect Winston · **Aprovado por:** @pm John
> **Data:** 2026-05-20 · **Sprint:** 1 · **Atende:** QA F-02 (BLOCKER, parte logs)

---

## Status

**Aprovado** — implementação na Story 1.6 do Sprint 1.

---

## Context

QA F-02 identificou que **observabilidade está zerada** no plano F4. KPIs do brief §6 (P95 ≤500ms, uptime ≥99.5%) não têm como ser medidos sem instrumentação. A solução completa precisa de **4 pilares**:

1. **Errors:** Sentry (decidido — baixa concorrência de mercado).
2. **Logs estruturados:** ❓ (Axiom, Logtail/Better Stack, ou Datadog?).
3. **Product analytics:** PostHog (decidido — concorrência de mercado vence custo, free tier 1M eventos).
4. **Uptime:** UptimeRobot (decidido — concorrência de mercado, free 50 monitores).

Esta ADR foca apenas em **(2) logs estruturados**, que tem concorrência real entre 3 providers.

### Forças em jogo

- **Custo previsível:** Datadog é poderoso mas começa em ~$15/host/mês — caro para escala atual.
- **Integração Cloudflare Workers + Supabase Edge Functions + Node:** precisa SDK que rode nos 3.
- **Free tier generoso:** queremos validar com volume real antes de pagar.
- **Search + alerting nativos:** sem precisar ELK self-hosted.
- **Retention:** mínimo 7d em free, ideal 30d.

---

## Decision

**Logtail (Better Stack) — Free 1GB/mês, Pro $25/mês.**

### Por quê

| Critério | Axiom | Logtail (Better Stack) | Datadog |
|---|---|---|---|
| Free tier | 0.5GB/mês | **1GB/mês** | Trial 14d |
| Pro pricing | $25/mês (10GB) | **$25/mês (30GB)** | ~$15/host/mês (mínimo 5 hosts) |
| SDK Cloudflare Workers | Não oficial | **Sim oficial** | Via HTTP |
| SDK Deno (Edge Functions) | Não | **Sim** | Via HTTP |
| Alerting nativo | Sim | **Sim + on-call** | Sim |
| Search query | Custom (apl) | **Lucene/SQL** | Custom |
| Status pages integrado | Não | **Sim** (cross-sell com UptimeRobot competidor) | Não |

**Decisão: Logtail.** Melhor free tier, SDK oficial nos 3 runtimes, status pages nativo (futuro Sprint 11 — atende QA NEW-13).

### Schema de logs estruturados

```typescript
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  msg: string;
  request_id: string;        // gerado no edge worker
  organization_id?: string;  // do JWT
  user_id?: string;          // do JWT
  route: string;             // ex: '/api/lgpd/export-titular'
  duration_ms?: number;
  status?: number;           // HTTP status
  error?: { name: string; message: string; stack?: string };
  metadata?: Record<string, unknown>;
}
```

### Sampling

- **Staging:** 100% dos logs.
- **Prod:** 100% para `level >= warn`, 10% para `info` (para caber em Free 1GB inicialmente).

### Integração com Sentry

- Sentry continua sendo a fonte de truth para **errors com stack trace** (já tem APM, replay, release tracking).
- Logtail recebe **request logs estruturados** (request_id é a chave para correlacionar).
- Sentry pode linkar para Logtail via custom integration (Sprint 1.6 AC-5).

### Retention

- Free: 3 dias (suficiente para staging dev).
- Pro: 30 dias (suficiente para investigar incidentes em prod).

---

## Consequences

### Positivas

- Custo zero até passar de 1GB/mês.
- SDKs oficiais para os 3 runtimes (sem hack).
- Pode crescer para Better Stack completo (Logtail + UptimeRobot-like + Status Pages) se quisermos consolidar.

### Negativas / Riscos

- Vendor lock-in moderado (re-importar histórico em outro provider é dor).
- Sampling 10% em info-level pode esconder padrões em prod (compensar com PostHog).
- Free tier 3 dias retention é apertado (sobe para Pro se incidente passar 3d sem detectar).

---

## Alternatives Considered

### A. Axiom

- **Pró:** APL query language poderosa; bom para análise ad-hoc.
- **Contra:** Free tier menor (0.5GB); SDK Cloudflare Workers não oficial; sem status pages.
- **Rejeitada:** Logtail ganha em tudo exceto query language.

### B. Datadog

- **Pró:** mais completo; APM + logs + monitoring + RUM integrados.
- **Contra:** caro (~$75/mês mínimo); excessivo para escala atual.
- **Rejeitada:** revisitar se escala 10×.

### C. Self-hosted ELK na VPS Hetzner

- **Pró:** $0 vendor cost; controle total.
- **Contra:** VPS sobrecarrega (Elastic come RAM); ops overhead alto; cluster needed para HA.
- **Rejeitada:** custo de ops > $25/mês de vendor.

### D. Cloudflare Logpush + R2 + manual query

- **Pró:** integrado à plataforma; baratíssimo.
- **Contra:** zero ferramenta de query nativa; precisa montar processamento (S3 + Athena clone); rejeita Edge Functions Supabase.
- **Rejeitada:** complexidade.

### E. Better Stack alternativa: Coralogix

- **Pró:** TCO baixo via Streama2.
- **Contra:** docs em inglês incompletas para Cloudflare; setup mais complexo.
- **Rejeitada:** Logtail vence por simplicidade.

---

## Referências

- `_review-qa.md` §F-02 (BLOCKER que motiva esta ADR)
- Story 1.6 (Sprint 1) implementa
- ADR-001 (stack) — runtimes
- Brief §6 (KPIs P95, uptime)

---

> _Observabilidade é caro de adicionar tardiamente. Esta ADR resolve antes de qualquer feature de produção._
