# ADR-002 — Estratégia de cliente Supabase em TanStack Start

> **Formato:** MADR-light · **Owner:** @architect Winston · **Aprovado por:** @pm John
> **Data:** 2026-05-20 · **Sprint:** 1 · **Depende de:** ADR-001 · **Pré-requisito:** Spike SP-01

---

## Status

**Proposto** — finalização condicionada ao resultado de **SP-01** (1 dia útil pré-Sprint 1). Se PASS → "Aprovado"; se FAIL → revisar com Hyago.

---

## Context

`@supabase/ssr` é o pacote oficial para integrar Supabase Auth com frameworks SSR (Next.js, Remix). Ele lida com:
- Cookies httpOnly seguros (não acessíveis via `document.cookie`)
- Refresh token rotation
- Server vs browser client separados
- Hydration consistente entre server e client

**Problema:** `@supabase/ssr` foi desenhado primariamente para Next.js. Em TanStack Start + Cloudflare Workers, há 3 incertezas:

1. **Cookie handling em loaders TanStack Router** — `createServerFn` é a forma server-side; precisa acessar `request.headers.cookie` e setar `Set-Cookie` na response.
2. **Cloudflare Workers vs Node.js runtime** — `@supabase/ssr` pode usar APIs Node não disponíveis em Workers.
3. **Streaming SSR + Suspense fronteiras** — React Query hydration com loader data pode duplicar fetches se mal-feito (atende Architect S-04).

---

## Decision

### Cliente Supabase em 3 contextos

```text
src/lib/supabase/
├── client.ts        — browser client (anon key, lê cookie via SSR)
├── server.ts        — server client (anon key, usado em loaders TanStack via createServerFn)
└── middleware.ts    — refresh de sessão em cada navegação SSR
```

### Padrão: 1 PR de exemplo com `/clientes` antes de replicar nas demais rotas críticas

Atende **Architect S-04**. O fluxo validado é:
1. Loader server → `createServerFn` → `supabaseServer.from('clients').select()`
2. Hydration → React Query injection no client com `dehydrate(queryClient)`
3. Realtime subscription (Sprint 2 expande) com filtro server-side obrigatório (`organization_id=eq.X`)

### Custom claims via Auth Hook

JWT carrega `organization_id` e `roles[]` via Edge Function `auth-hook/index.ts` configurada como Auth Hook no Supabase. Validado em **SP-06** (pré-Sprint 1).

```typescript
// supabase/functions/auth-hook/index.ts
return {
  claims: {
    ...event.claims,
    organization_id: user.organization_id,
    roles: user.roles,
  }
};
```

RLS lê via `auth.org_id()` e `auth.user_role()` (PostgreSQL functions).

### Cookies httpOnly

- `sb-access-token` (TTL 30min — atende QA QR-05)
- `sb-refresh-token` (TTL 7 dias)
- Logout invalida refresh token server-side via `supabase.auth.admin.signOut(user_id)`

### Service Role Key

- **Nunca** no bundle frontend.
- Apenas em Supabase Edge Functions (que rodam em Deno, fora do Workers).
- Pre-commit hook + CI check bloqueando string que parece service key (atende Architect A-09).
- Rotação a cada 90d via `scripts/rotate-service-role-key.sh`.

---

## Consequences

### Positivas

- Aderência ao padrão Supabase oficial.
- Type-safety: loaders tipados via TanStack Router; `supabase gen types` exporta TS types.
- Security: cookies httpOnly + custom claims no JWT + RLS = 3 camadas.

### Negativas / Riscos

- **SP-01 falha** → ADR-002 inválido; precisa replanejamento (Hono ou Next.js).
- **`@supabase/ssr` upgrade** — versão fica pinada; ADR revisita a cada upgrade major.
- **Edge Functions Supabase usam Deno**, não Node. Devs precisam adaptar (atende Architect M-02).

### O que dispara revisão desta ADR

- SP-01 falha (FAIL = revisão imediata).
- `@supabase/ssr` v1.0 lança breaking change.
- TanStack Start `createServerFn` muda contrato.
- Cloudflare Workers introduz limitação que quebra o pacote.

---

## Alternatives Considered

### A. Adapter custom em loaders TanStack

Escrever wrapper próprio em vez de usar `@supabase/ssr`.

- **Pró:** Controle total; sem dependência de pacote oficial.
- **Contra:** Reinventa cookie handling + refresh rotation; aumenta superfície de bugs de segurança.
- **Rejeitada:** só usar se A não funcionar.

### B. Usar `@supabase/supabase-js` puro + localStorage

- **Pró:** Simples.
- **Contra:** XSS pode roubar tokens (não-httpOnly); sem SSR security; viola P8 LGPD.
- **Rejeitada.**

### C. Auth federada via Clerk

- **Pró:** UI/UX prontas; flows polidos.
- **Contra:** Custo +$25/mês; vendor adicional; não integra com RLS Supabase nativamente.
- **Rejeitada:** custo + complexidade desnecessária.

---

## Referências

- ADR-001 (stack)
- SP-01 (validação pré-Sprint 1)
- SP-06 (custom claims JWT)
- `_review-architect.md` §S-04 (Streaming/Suspense)
- `_review-architect.md` §A-09 (Service Role gerenciamento)
- `_review-qa.md` §QR-05 (JWT TTL)
- Master §4 (RLS examples)

---

> _Esta ADR é o coração da Story 1.4 do Sprint 1. Se quebrar, Sprint 1 trava._
