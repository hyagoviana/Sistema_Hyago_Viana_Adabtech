# ADR-003 — Hosting strategy: Cloudflare Workers + Supabase + VPS Hetzner

> **Formato:** MADR-light · **Owner:** @architect Winston · **Aprovado por:** @pm John
> **Data:** 2026-05-20 · **Sprint:** 1 · **Atende:** Architect F-03 + F-04 (BLOCKERs)

---

## Status

**Aprovado** — implementação na Story 1.7 do Sprint 1.

---

## Context

A Plataforma FIES tem 3 categorias muito diferentes de carga de trabalho:

1. **Frontend SSR + APIs leves** (request-response < 100ms): rotas TanStack, autenticação, queries Supabase.
2. **Lógica de negócio próxima ao DB**: triggers, funções PL/pgSQL, webhooks de baixo CPU (ZapSign payload < 100KB).
3. **Processos pesados que exigem binários**: DOCX→PDF (LibreOffice), scraping Gov.br/SEI/CNES (Playwright), workflows visuais (n8n).

Cloudflare Workers tem **limite de 10MB bundle** (Free) ou 25MB (Paid), **50ms CPU** por request, e **não roda binários nativos**. Supabase Edge Functions rodam em Deno em isolates limitados (CPU/memória) e também não rodam binários.

Sem uma decisão consciente, o time descobriria no Sprint 5 que precisa de infra adicional, perdendo 1-2 sprints.

---

## Decision

### Distribuição em 3 camadas

#### Camada 1 — Cloudflare Workers (frontend SSR + APIs leves)

**Responsabilidades:**
- TanStack Start SSR (todas as 53 rotas)
- Loaders e mutators TanStack (`createServerFn`)
- Static assets via Cloudflare CDN
- Cookies httpOnly + middleware de auth
- Endpoint `/api/health` mínimo

**Constraint:** bundle ≤ 5MB (alerta CI), latência por request < 50ms CPU.

**Endpoints expostos:**
- `https://app.hyagoviana.adv.br` (admin)
- `https://portal.hyagoviana.adv.br` (cliente)

#### Camada 2 — Supabase Edge Functions (lógica DB + webhooks)

**Responsabilidades:**
- Auth Hook (custom claims JWT)
- `invite-user` (admin convite)
- `lgpd-export-titular`
- `outbox-publisher` (consumer chamado por pg_cron 60s)
- Webhook receivers leves (ZapSign primeira camada — apenas valida HMAC + enqueue em `case_outbox_events`)
- Endpoint `/api/health/db` (Supabase status)

**Constraint:** payload < 1MB, execução < 30s, Deno runtime.

#### Camada 3 — VPS Hetzner CX22 (processos pesados)

**Responsabilidades:**
- **n8n self-hosted** — workflows visuais editáveis pela equipe
- **LibreOffice headless** — geração DOCX→PDF determinística (Sprint 5, 8)
- **Playwright workers** — Gov.br/SEI/CNES scraping (Sprint 7)
- Workers consumindo `case_outbox_events` para processos longos

**Constraint:** mantida sob Uptime Kuma + backup diário; restore drill <2h.

**Endpoints expostos:**
- `https://n8n.hyagoviana.adv.br` (n8n UI + webhooks)
- VPS internal: workers conectam ao Supabase via Service Role

#### Diagrama de fluxo

```text
┌─────────────────────────────────────────────────────────┐
│  USUÁRIO                                                 │
│  (browser)                                               │
└────────────┬────────────────────────────────────────────┘
             │ HTTPS
             ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Workers (app.hyagoviana.adv.br)              │
│  ─ TanStack SSR + loaders                                │
│  ─ Auth middleware                                       │
│  ─ Mutators leves                                        │
└────────────┬───────────────────────────┬────────────────┘
             │ supabase-js (anon JWT)    │ webhook reverso
             ▼                           │
┌─────────────────────────────────────┐  │
│  Supabase (Postgres + Auth + RLS)    │  │
│  ─ 23+ tabelas                       │  │
│  ─ Edge Functions (lgpd, outbox)     │  │
│  ─ Storage (PDFs, anexos)            │  │
│  ─ Realtime (WebSocket)              │  │
└────────────┬─────────────────────────┘  │
             │ pg_cron 60s                │
             ▼                            │
┌─────────────────────────────────────┐   │
│  outbox-publisher (Edge Function)    │   │
│  lê case_outbox_events → dispatch    │   │
└────────────┬─────────────────────────┘   │
             │ HTTPS POST                  │
             ▼                             │
┌─────────────────────────────────────┐   │
│  VPS Hetzner (n8n.hyagoviana.adv.br) │◀──┘
│  ─ n8n (workflows visuais)           │
│  ─ LibreOffice (DOCX→PDF)            │
│  ─ Playwright (scraping)             │
│  ─ Uptime Kuma                       │
└──────────────────────────────────────┘
```

### Network / Auth entre camadas

| De → Para | Mecanismo |
|---|---|
| Cloudflare → Supabase | anon JWT (usuário) ou Service Role (Edge Function) |
| Cloudflare → VPS n8n | HTTPS POST com HMAC compartilhado |
| VPS → Cloudflare (webhook reverso) | HTTPS POST com HMAC; endpoint `/api/webhooks/vps` |
| VPS → Supabase | Service Role Key (rotada 90d) |
| Supabase Edge → VPS | HTTPS POST com HMAC |

### Custo mensal projetado

| Camada | Plano | Custo |
|---|---|---|
| Cloudflare Workers | Paid | $5 |
| Supabase | Pro × 2 (staging + prod) | $50 |
| Hetzner CX22 | x86 | ~€15 (R$90) |
| Hetzner Storage Box 100GB | Backup | ~€3 (R$20) |
| **Total infra** | | **~R$430/mês** |

---

## Consequences

### Positivas

- **Alinhamento ao Brief §6 P10** (self-hosting infra crítica).
- **Hyago pode editar workflows n8n via UI** sem precisar de PR.
- **Custos previsíveis** (R$430/mês) vs alternativas SaaS (Browserless $50-200/mês).
- **Decisão tomada antes** dos sprints 5-8 — sem retrabalho.

### Negativas / Riscos

- **VPS down → bloqueia Sprints 5-8 features** (Uptime Kuma + backup mitigam).
- **3 camadas = 3 lugares para debugar** (Sentry + Logtail centralizam — ADR-004).
- **DevOps precisa SSH expertise** para manter VPS.
- **Backup/DR da VPS** precisa virar tarefa de produção (atende QA NEW-14 — Sprint 11 drill).

### Quando revisitar esta ADR

- Se VPS Hetzner tiver >2 incidentes/mês → considerar managed (Cloud Run para LibreOffice/Playwright).
- Se Hyago não usar n8n (workflows ficam em Edge Functions) → reduzir VPS para apenas LibreOffice + Playwright.
- Se Cloudflare Workers introduzir suporte a binários → re-avaliar VPS necessidade.

---

## Alternatives Considered

### A. Tudo em Cloud Run (Google)

- **Pró:** managed; auto-scale.
- **Contra:** custo variável ($30-100/mês imprevisível); diverge do P10 self-hosting; complica DevOps (3 plataformas em vez de 1 VPS).
- **Rejeitada.**

### B. Browserless.io + n8n Cloud

- **Pró:** zero infra.
- **Contra:** custo alto ($50-200/mês); n8n Cloud limita workflows; viola P10.
- **Rejeitada.**

### C. AWS Lambda + EFS para LibreOffice

- **Pró:** ecosystem AWS.
- **Contra:** Lambda cold-start ruim com binários; vendor lock-in profundo; custo alto.
- **Rejeitada.**

### D. Tudo Cloudflare (Workers + R2 + D1)

- **Pró:** uma plataforma; latência global.
- **Contra:** D1 ainda imaturo para 17+ tabelas com RLS; sem suporte para LibreOffice/Playwright; Supabase Auth já validado.
- **Rejeitada.**

---

## Referências

- ADR-001 (stack)
- ADR-006 (DOCX→PDF) — usa LibreOffice na VPS
- `_review-architect.md` §F-03 (n8n) + §F-04 (DOCX→PDF + scraping)
- Brief §6 P10 (self-hosting)
- PRD Master §9 (n8n workflows)
- Story 1.7 (Sprint 1) implementa esta ADR

---

> _Esta ADR resolve simultaneamente F-03 e F-04. A VPS Hetzner é o "swiss-army knife" do projeto._
