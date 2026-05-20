# ADR-001 — Stack: TanStack Start + Vite + Cloudflare + Supabase

> **Formato:** MADR-light · **Owner:** @architect Winston · **Aprovado por:** @pm John, Hyago Viana
> **Data:** 2026-05-20 · **Sprint:** 1 (pré-execução)

---

## Status

**Aprovado** — decisão já tomada antes do plano F4. Documentada aqui retrospectivamente para rastreabilidade.

---

## Context

O projeto começou com a expectativa (Brief §6, PRD Master §6) de stack **Next.js 15 + Vercel + Supabase**. Após a fase F2 (build do frontend via Lovable), o time entregou o `sistema-hv/` em **TanStack Start + TanStack Router + Vite + Tailwind v4 + shadcn/ui** rodando em **Cloudflare** (via `@cloudflare/vite-plugin`). 53 rotas já estruturadas com layout final aprovado.

Reescrever para Next.js custaria 4-6 sprints e descartaria o trabalho do Lovable. Manter Next.js no PRD e ter o frontend em TanStack gera ambiguidade.

A decisão precisa estar **registrada explicitamente** para que reviews futuros (incluindo o do @architect Winston em `_review-architect.md`) tenham ponto de referência.

### Forças em jogo

- **Aderência ao PRD original:** Next.js + Vercel = aderente; TanStack + Cloudflare = divergente. Risco: descobrir limitações tardiamente.
- **Custo de reescrita:** Next.js exigiria refazer routing, loaders, server functions, integração shadcn. Estimativa: 4-6 sprints.
- **Maturidade SSR:** Next.js App Router é estável em produção há 2 anos. TanStack Start atinge GA em 2025 — ainda evolui mensalmente.
- **Edge runtime:** Cloudflare Workers é mais limitado que Node (sem binários nativos, 10ms CPU free, 50ms paid).
- **Ecosystem fit:** `@supabase/ssr` foi desenhado para Next.js; uso em TanStack precisa validação (spike SP-01).

---

## Decision

**Mantemos TanStack Start + Vite + Cloudflare como stack de frontend.** Supabase como backend (Postgres + Auth + RLS + Storage + Realtime + Edge Functions). VPS Hetzner para processos pesados (ver ADR-003).

### Versões pinadas (Sprint 1)

- **TanStack Start:** `^1.168` (subscrever changelog — atende Architect A-10)
- **TanStack Router:** `^1.168`
- **React:** `19.x`
- **Vite:** `^7.0`
- **`@cloudflare/vite-plugin`:** latest
- **`@supabase/supabase-js`:** `^2.45`
- **`@supabase/ssr`:** `^0.5` (validado via SP-01)
- **Tailwind v4:** latest
- **shadcn/ui:** snapshot commit Lovable

### Extensions Postgres habilitadas

- `uuid-ossp` (geração UUIDs)
- `pg_trgm` (busca fuzzy)
- **`vector`** (pgvector — pinar versão na ADR; uso só no Projeto 3, mas criada agora para evitar drift — atende Architect M-01)
- `pgcrypto`
- `pg_cron`
- `pg_jsonschema` (validação `fies_data` — atende Architect A-08)

### Plano Supabase

- **Pro** ($25/mês × 2 projetos = $50/mês total) desde Sprint 1.
- Justificativa: PITR (point-in-time recovery — A-05), 500 connections (Realtime + queries — S-03), custom domain.

### Plano Cloudflare

- **Free** para staging.
- **Workers Paid** ($5/mês) a partir do go-live (limite CPU 50ms e Workers Analytics).

---

## Consequences

### Positivas

- Zero retrabalho do que Lovable já entregou (53 rotas + design system + componentes).
- Vite traz HMR muito mais rápido que Next.js (DX superior em desenvolvimento).
- Cloudflare Workers globais → latência baixa para usuários BR (mesmo backend em `sa-east-1`).
- TanStack Router tem type-safety end-to-end (rotas tipadas).

### Negativas / Riscos

- **A-01 Vendor lock-in Supabase** — sair custa caro. Mitigação: zero código usando features proprietárias quando equivalente standard existe.
- **A-10 TanStack 1.x evolui rápido** — breaking changes em 6 meses possíveis. Mitigação: pinar versão exata, subscrever changelog, ADR documenta versão.
- **Spike SP-01 obrigatório:** `@supabase/ssr` em TanStack Start em Cloudflare Workers não tem documentação massiva. Se FAIL, fallback: Hono + Vite (2-3 sprints de migração).
- **Cloudflare Workers não roda binários nativos** — LibreOffice/Playwright vão para VPS Hetzner (ADR-003).
- **Divergência do PRD original** — documentar em CHANGELOG dos PRDs para futuras releases.

### Custo mensal projetado (prod)

- Supabase Pro: $50
- Cloudflare Workers Paid: $5
- Cloudflare R2 (futuro PDFs grandes): $0-$15
- Total stack: ~$70/mês (R$420)

---

## Alternatives Considered

### A. Reescrever para Next.js 15 + Vercel

- **Pró:** Aderência ao PRD original; ecosystem mais maduro para SSR + Supabase.
- **Contra:** 4-6 sprints de reescrita; descarta Lovable; Vercel custa mais que Cloudflare (Vercel Pro $20/mês/user, Cloudflare Workers Paid $5/mês flat).
- **Rejeitada:** custo não justifica benefício marginal.

### B. Hono + Vite + React (sem TanStack Start)

- **Pró:** Mais simples; sem dependência em TanStack 1.x.
- **Contra:** Perde type-safety de routing; precisa reescrever loaders; reaproveita menos do Lovable.
- **Rejeitada:** considerada apenas como fallback se SP-01 falhar.

### C. Remix + Cloudflare Pages

- **Pró:** Maturidade SSR; suporte oficial Cloudflare; loaders/actions similares a TanStack.
- **Contra:** Sem o trabalho Lovable existir em Remix; migração equivalente a Next.js.
- **Rejeitada:** mesmo custo da A sem ganho claro.

---

## Referências

- `_review-architect.md` §"Veredito executivo" — apontou stack mismatch como risco
- `docs/project-brief.md` §6 — assumia Next.js
- `docs/prd/master-platform.md` §6 — assumia Next.js
- `docs/prd/01-plataforma-fies.md` — não trava stack
- Spike SP-01 (pré-Sprint 1) valida `@supabase/ssr` em TanStack Start
- Spike SP-02 valida bundle size no Workers
- ADR-002 detalha estratégia de cliente Supabase em loaders

---

> _Esta ADR pode ser revisitada se SP-01 falhar ou se TanStack 1.x introduzir breaking change incompatível._
