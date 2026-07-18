# Story R4-03: Gate de $ nos DASHBOARDS + reforço nos RPCs (`financeiro.ts`/`asaas.ts`/`contaazul.ts`)

- **Épico:** R4 — Desacoplar Financeiro (bloco B4 + E5)
- **ID:** R4-03
- **Status:** Draft
- **Estimativa relativa:** M (guard de rota do dashboard + reforço de `requireRole` em ~15 server functions)
- **Executor sugerido:** @dev · Quality gate: @architect
- **Prioridade no épico:** 3 (defesa de servidor — sem ela os gates de UI são só cosméticos)

---

## Story

**Como** administrador/financeiro,
**quero** que o dashboard financeiro (`dashboards/financeiro`) e **todos** os RPCs que retornam ou movimentam valores ($) exijam permissão financeira no servidor,
**para que** nenhum não-financeiro veja totais/relatórios nem consiga chamar as server functions de cobrança direto (a defesa não pode depender só do gate de UI).

---

## Contexto / o que JÁ EXISTE vs NOVO

- **JÁ EXISTE (o buraco):** os RPCs de $ hoje só chamam `requireAuth()` (qualquer autenticado passa), **não** `requireRole`:
  - `src/rpc/financeiro.ts:15-27` (`handle()` só faz `requireAuth`): `getDashboardFinanceiroFn`, `listAllParcelasFn`, `getRelatorioFinanceiroFn`, `syncAllPagamentosFn`.
  - `src/rpc/asaas.ts:18-31` (`handle()` só `requireAuth`): `syncClientToAsaasFn`, `createChargeFn`, `getChargeStatusFn`, `getPixQrCodeFn`, `cancelChargeFn`, `listClientChargesFn`, `syncAsaasPagamentosFn`, `asaasPingFn`.
  - `src/rpc/contaazul.ts:14-27` (`handle()` só `requireAuth`): `syncClientToContaAzulFn`, `createContaAzulChargeFn`, `syncContaAzulPagamentosFn`, `contaAzulPingFn`.
- **JÁ EXISTE (o guard certo):** `requireRole(allowed: string[])` em `src/lib/supabase/auth-guard.ts:150-170` — valida `system_users.role` ACTIVE e lança `AuthError(403)`. É a peça a plugar no `handle()`.
- **JÁ EXISTE (rota sem guard):** `dashboards.financeiro.tsx:9-11` (`createFileRoute(...)({ component })`) **sem** `beforeLoad`/gate; qualquer um com a URL vê os totais.
- **NOVO:** um `handle()` que aceite lista de papéis (ou usa `requireRole` da lista financeira) nos 3 RPCs; guard de rota no dashboard.

> **DECISÃO TRAVADA (doc-mestre §5.3:164):** "reforçar gate nos RPCs (hoje só `requireAuth`)". O gate de UI (R4-01/R4-02) esconde; o gate de RPC **impede**.

---

## DEPENDÊNCIA CRÍTICA — R3 (`permissaoEfetiva`)

- No **alvo**, o gate de servidor deve consultar `permissaoEfetiva(user, 'financeiro', action)` (view p/ leitura; edit p/ criar/cancelar cobrança) — a versão server-side de R3.
- **Ponte até R3-01 existir:** usar `requireRole([...])` com a lista de papéis financeiros. Papéis com `financeiro.manage` hoje: **`admin`, `advogado_titular`, `financeiro`** (de `ROLE_CAPABILITIES` em `rbac.ts:67-83`). Definir a constante `FINANCEIRO_ROLES = ["admin", "advogado_titular", "financeiro"]` e marcar `// TODO(R4/R3): trocar requireRole por permissaoEfetiva server-side`.
- **Cuidado:** `requireRole` exige status **ACTIVE** (rejeita INVITED) — para os RPCs de $ isso é aceitável/desejável. Documentar que difere do `requireAuth` (que aceita INVITED).

---

## Acceptance Criteria

1. `dashboards/financeiro` só carrega para papéis financeiros (admin/advogado_titular/financeiro); os demais são bloqueados (redirect ou 403), sem ver totais.
2. Todos os RPCs de leitura de $ (`getDashboardFinanceiroFn`, `listAllParcelasFn`, `getRelatorioFinanceiroFn`, `listClientChargesFn`, `getChargeStatusFn`, `getPixQrCodeFn`) retornam **403** para não-financeiro.
3. Todos os RPCs de escrita/movimentação de $ (`createChargeFn`, `createContaAzulChargeFn`, `cancelChargeFn`, `syncClientToAsaasFn`, `syncClientToContaAzulFn`, `syncAsaasPagamentosFn`, `syncContaAzulPagamentosFn`, `syncAllPagamentosFn`) exigem papel financeiro (403 caso contrário).
4. **Exceção cron:** os endpoints/cron de sync que rodam sem usuário (ex.: `api.cron.sync-contaazul`) continuam funcionando — o reforço de papel vale para as **server functions chamadas pela UI**, não para o cron (que usa segredo próprio). Verificar e não quebrar o cron das 08:30.
5. `pingFn` (health) pode manter `requireAuth` (não expõe $) — decisão documentada.

---

## Tasks / Subtasks

- [ ] **Constante de papéis** (AC: 2,3) — `const FINANCEIRO_ROLES = ["admin", "advogado_titular", "financeiro"] as const;` (num util compartilhado ou em cada RPC) — espelha `financeiro.manage` de `rbac.ts`.
- [ ] **Reforçar `handle()` em `financeiro.ts`** (AC: 1,2,3) — trocar `await requireAuth()` por `await requireRole(FINANCEIRO_ROLES)` no `handle()` (rpc/financeiro.ts:16). Mantém o mapeamento de `AuthError`→status (já trata 403).
- [ ] **Reforçar `handle()` em `asaas.ts`** (AC: 2,3) — idem (rpc/asaas.ts:19). `asaasPingFn` pode ficar com `requireAuth` (extrair um `handleAuthOnly` ou passar flag).
- [ ] **Reforçar `handle()` em `contaazul.ts`** (AC: 2,3) — idem (rpc/contaazul.ts:15). `contaAzulPingFn` idem.
- [ ] **Guard de rota do dashboard** (AC: 1) — `dashboards.financeiro.tsx`: adicionar `beforeLoad` que checa o papel (client-side via sessão) OU envolver o componente com gate `can(role,'financeiro.manage')` e mostrar bloqueio. (RPC já barra os dados; o guard evita a casca visual.)
- [ ] **[C5] Verificar cron ANTES de reforçar** (AC: 4) — **pré-requisito bloqueante**: confirmar **in loco** (ler `api.cron.sync-contaazul.tsx`) que o cron das 08:30 chama o **service** `syncContaAzulPagamentos` **diretamente** e **NÃO** o RPC `syncContaAzulPagamentosFn`. Só reforçar `requireRole` nos `*Fn` **depois** dessa confirmação — se o cron chamar o RPC, o `requireRole` (sem usuário) quebra o cron **silenciosamente** (sem erro visível na UI). Se chamar via RPC, criar antes um caminho sem `requireRole` para o cron (autenticação por segredo do cron) e só então reforçar.
- [ ] **Testes** (AC: 1-5) — chamada dos RPCs como não-financeiro → 403; como financeiro → 200; cron continua verde; `npx tsc --noEmit` / `npm run lint` verdes.

---

## Dev Notes

**RPCs a receber gate (arquivo:linha do `handle`):**
- `sistema-hv/src/rpc/financeiro.ts:14` (`handle`) → `requireRole(FINANCEIRO_ROLES)`.
- `sistema-hv/src/rpc/asaas.ts:18` (`handle`) → idem (exceto ping).
- `sistema-hv/src/rpc/contaazul.ts:14` (`handle`) → idem (exceto ping).

**Rota a receber gate:**
- `sistema-hv/src/routes/dashboards.financeiro.tsx:9` — `beforeLoad`/gate de papel.

**Guard a reusar (não recriar):**
- `requireRole` — `sistema-hv/src/lib/supabase/auth-guard.ts:150`. Já lança `AuthError(403)`, e os `handle()` já mapeiam `AuthError.status` → `setResponseStatus` (financeiro.ts:19-21 etc.). Nenhuma mudança de tratamento de erro necessária.

**Riscos de regressão / vazamento de $:**
- **Quebrar o cron:** se algum caminho de sync chamar o `*Fn` (agora com `requireRole`) sem usuário, o cron das 08:30 quebra. **Mitigação:** cron chama o **service** (`syncContaAzulPagamentos`/`syncAsaasPagamentos`), não o RPC — confirmar em `api.cron.sync-contaazul.tsx` e no service `financeiro`. Manter os `syncAllPagamentosFn`/`sync*PagamentosFn` da UI gate-ados, mas o cron por outro caminho.
- **INVITED bloqueado:** `requireRole` exige ACTIVE. Um usuário financeiro em onboarding (INVITED) perderia acesso ao $ até ativar — comportamento aceitável (documentar).
- **Falso 403 no admin:** garantir que `admin` está em `FINANCEIRO_ROLES` (está). Espelhar exatamente `financeiro.manage`.
- Não alterar `financeiro-service.ts` (lógica); só a fronteira RPC.

### Testing
- Como `operacional`: `getDashboardFinanceiroFn`, `listAllParcelasFn`, `createChargeFn` → 403.
- Como `financeiro`: mesmos → 200.
- Abrir `/dashboards/financeiro` como `operacional` → bloqueado, sem totais.
- Cron `sync-contaazul` → segue rodando (sem usuário).
- `npm run typecheck` / `npm run lint` verdes.

---

## Dependências

- **Depende de:** **R3-01** (`permissaoEfetiva` server-side no alvo); ponte `requireRole(FINANCEIRO_ROLES)`. É **defesa de R4-01/R4-02/R4-04** (sem ela os gates de UI são burláveis).
- **Habilita:** confiança para expor o painel financeiro do cliente (R4-04) e mover gerar-fatura (R4-05) sem risco de bypass por chamada direta de RPC.

---

## File List

- `sistema-hv/src/rpc/financeiro.ts` (`handle` → `requireRole`)
- `sistema-hv/src/rpc/asaas.ts` (`handle` → `requireRole`; ping exceção)
- `sistema-hv/src/rpc/contaazul.ts` (`handle` → `requireRole`; ping exceção)
- `sistema-hv/src/routes/dashboards.financeiro.tsx` (guard de papel)
- (verificar) `sistema-hv/src/routes/api.cron.sync-contaazul.tsx` (não regredir)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-07-18 | 0.1 | Draft inicial do épico R4 (B4/E5) — gate dashboards + RPCs | @sm |
| 2026-07-18 | 0.2 | C5 (QA): task de verificação do cron promovida a **pré-requisito bloqueante** — confirmar in loco que `api.cron.sync-contaazul.tsx` chama o service `syncContaAzulPagamentos` (não o RPC) ANTES de reforçar `requireRole`, senão o cron das 08:30 quebra silenciosamente. | @sm |
